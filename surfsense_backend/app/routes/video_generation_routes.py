"""
Video Generation routes:
- CRUD for VideoGenerationConfig (user-created video model configs)
- Global video gen configs endpoint (from YAML)
- Video generation execution (calls proxy API directly via aiohttp)
- CRUD for VideoGeneration records (results)
- Video serving endpoint (serves .mp4 files from disk, protected by signed tokens)
"""

import base64
import logging
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.db import (
    Permission,
    SearchSpace,
    SearchSpaceMembership,
    User,
    VideoGeneration,
    VideoGenerationConfig,
    get_async_session,
)
from app.schemas import (
    GlobalVideoGenConfigRead,
    VideoGenerationConfigCreate,
    VideoGenerationConfigRead,
    VideoGenerationConfigUpdate,
    VideoGenerationCreate,
    VideoGenerationListRead,
    VideoGenerationRead,
)
from app.services.video_gen_service import VideoGenService
from app.users import current_active_user
from app.utils.rbac import check_permission
from app.utils.signed_image_urls import generate_image_token, verify_image_token

router = APIRouter()
logger = logging.getLogger(__name__)

# Directory for storing generated video files
VIDEO_GENERATION_DIR = Path("/shared_tmp/video_generation")


def _get_global_video_gen_config(config_id: int) -> dict | None:
    """Get a global video generation configuration by ID (negative IDs)."""
    if config_id > 0:
        return None
    for cfg in config.GLOBAL_VIDEO_GEN_CONFIGS:
        if cfg.get("id") == config_id:
            return cfg
    return None


async def _execute_video_generation(
    session: AsyncSession,
    video_gen: VideoGeneration,
    search_space: SearchSpace,
) -> None:
    """
    Call the video generation API with the appropriate config.

    Resolution order:
    1. Explicit video_generation_config_id on the request
    2. Search space's video_generation_config_id preference
    3. First global config as fallback
    """
    config_id = video_gen.video_generation_config_id
    if config_id is None:
        config_id = search_space.video_generation_config_id
    if config_id is None:
        # Fallback to first global config
        global_configs = config.GLOBAL_VIDEO_GEN_CONFIGS
        if global_configs:
            config_id = global_configs[0].get("id")
    if config_id is None:
        raise ValueError(
            "No video generation config available. "
            "Add a config in Settings > Video Models."
        )
    video_gen.video_generation_config_id = config_id

    # Resolve config details
    if config_id < 0:
        # Global config from YAML
        cfg = _get_global_video_gen_config(config_id)
        if not cfg:
            raise ValueError(f"Global video generation config {config_id} not found")
        api_base = cfg.get("api_base", "")
        api_key = cfg.get("api_key", "")
        default_model = cfg.get("model_name", "ltx-2.3-t2v")
        extra = cfg.get("extra_params", {}) or {}
    else:
        # Positive ID = DB VideoGenerationConfig
        result = await session.execute(
            select(VideoGenerationConfig).filter(VideoGenerationConfig.id == config_id)
        )
        db_cfg = result.scalars().first()
        if not db_cfg:
            raise ValueError(f"Video generation config {config_id} not found")
        api_base = db_cfg.api_base or ""
        api_key = db_cfg.api_key
        default_model = db_cfg.model_name
        extra = db_cfg.extra_params or {}

    if not api_base:
        raise ValueError("Video generation config is missing api_base")

    # Determine generation parameters (request overrides > config defaults)
    model = video_gen.model or default_model
    size = video_gen.size or extra.get("size", "768x512")
    frames = video_gen.frames or extra.get("frames", 97)

    # Call the video generation API
    response = await VideoGenService.generate_video(
        api_base=api_base,
        api_key=api_key,
        prompt=video_gen.prompt,
        model=model,
        size=size,
        frames=frames,
        image_base64=None,  # i2v handled via request body
    )

    # Extract video data from response
    data = response.get("data", [])
    if not data or not data[0].get("b64_json"):
        raise ValueError("No video data in response")

    # Decode base64 video and save to disk
    VIDEO_GENERATION_DIR.mkdir(parents=True, exist_ok=True)
    video_bytes = base64.b64decode(data[0]["b64_json"])
    video_filename = f"{video_gen.id}.mp4"
    video_path = VIDEO_GENERATION_DIR / video_filename

    video_path.write_bytes(video_bytes)

    # Store path (not the b64 data) in DB
    video_gen.video_path = str(video_path)
    video_gen.model = model

    # Store revised_prompt if available
    revised = data[0].get("revised_prompt")
    if revised and revised != video_gen.prompt:
        video_gen.model = f"{model}"  # model already set above


# =============================================================================
# Global Video Generation Configs (from YAML)
# =============================================================================


@router.get(
    "/global-video-generation-configs",
    response_model=list[GlobalVideoGenConfigRead],
)
async def get_global_video_gen_configs(
    user: User = Depends(current_active_user),
):
    """Get all global video generation configs. API keys are hidden."""
    try:
        global_configs = config.GLOBAL_VIDEO_GEN_CONFIGS
        safe_configs = []

        for cfg in global_configs:
            safe_configs.append(
                {
                    "id": cfg.get("id"),
                    "name": cfg.get("name"),
                    "description": cfg.get("description"),
                    "provider": cfg.get("provider"),
                    "custom_provider": cfg.get("custom_provider"),
                    "model_name": cfg.get("model_name"),
                    "api_base": cfg.get("api_base") or None,
                    "extra_params": cfg.get("extra_params", {}),
                    "is_global": True,
                }
            )

        return safe_configs
    except Exception as e:
        logger.exception("Failed to fetch global video generation configs")
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch configs: {e!s}"
        ) from e


# =============================================================================
# VideoGenerationConfig CRUD
# =============================================================================


@router.post("/video-generation-configs", response_model=VideoGenerationConfigRead)
async def create_video_gen_config(
    config_data: VideoGenerationConfigCreate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Create a new video generation config for a search space."""
    try:
        await check_permission(
            session,
            user,
            config_data.search_space_id,
            Permission.VIDEO_GENERATIONS_CREATE.value,
            "You don't have permission to create video generation configs in this search space",
        )

        db_config = VideoGenerationConfig(**config_data.model_dump(), user_id=user.id)
        session.add(db_config)
        await session.commit()
        await session.refresh(db_config)
        return db_config

    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        logger.exception("Failed to create VideoGenerationConfig")
        raise HTTPException(
            status_code=500, detail=f"Failed to create config: {e!s}"
        ) from e


@router.get("/video-generation-configs", response_model=list[VideoGenerationConfigRead])
async def list_video_gen_configs(
    search_space_id: int,
    skip: int = 0,
    limit: int = 100,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """List video generation configs for a search space."""
    try:
        await check_permission(
            session,
            user,
            search_space_id,
            Permission.VIDEO_GENERATIONS_READ.value,
            "You don't have permission to view video generation configs in this search space",
        )

        result = await session.execute(
            select(VideoGenerationConfig)
            .filter(VideoGenerationConfig.search_space_id == search_space_id)
            .order_by(VideoGenerationConfig.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list VideoGenerationConfigs")
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch configs: {e!s}"
        ) from e


@router.get(
    "/video-generation-configs/{config_id}", response_model=VideoGenerationConfigRead
)
async def get_video_gen_config(
    config_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Get a specific video generation config by ID."""
    try:
        result = await session.execute(
            select(VideoGenerationConfig).filter(VideoGenerationConfig.id == config_id)
        )
        db_config = result.scalars().first()
        if not db_config:
            raise HTTPException(status_code=404, detail="Config not found")

        await check_permission(
            session,
            user,
            db_config.search_space_id,
            Permission.VIDEO_GENERATIONS_READ.value,
            "You don't have permission to view video generation configs in this search space",
        )
        return db_config

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get VideoGenerationConfig")
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch config: {e!s}"
        ) from e


@router.put(
    "/video-generation-configs/{config_id}", response_model=VideoGenerationConfigRead
)
async def update_video_gen_config(
    config_id: int,
    update_data: VideoGenerationConfigUpdate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Update an existing video generation config."""
    try:
        result = await session.execute(
            select(VideoGenerationConfig).filter(VideoGenerationConfig.id == config_id)
        )
        db_config = result.scalars().first()
        if not db_config:
            raise HTTPException(status_code=404, detail="Config not found")

        await check_permission(
            session,
            user,
            db_config.search_space_id,
            Permission.VIDEO_GENERATIONS_UPDATE.value,
            "You don't have permission to update video generation configs in this search space",
        )

        for key, value in update_data.model_dump(exclude_unset=True).items():
            setattr(db_config, key, value)

        await session.commit()
        await session.refresh(db_config)
        return db_config

    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        logger.exception("Failed to update VideoGenerationConfig")
        raise HTTPException(
            status_code=500, detail=f"Failed to update config: {e!s}"
        ) from e


@router.delete("/video-generation-configs/{config_id}", response_model=dict)
async def delete_video_gen_config(
    config_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Delete a video generation config."""
    try:
        result = await session.execute(
            select(VideoGenerationConfig).filter(VideoGenerationConfig.id == config_id)
        )
        db_config = result.scalars().first()
        if not db_config:
            raise HTTPException(status_code=404, detail="Config not found")

        await check_permission(
            session,
            user,
            db_config.search_space_id,
            Permission.VIDEO_GENERATIONS_DELETE.value,
            "You don't have permission to delete video generation configs in this search space",
        )

        await session.delete(db_config)
        await session.commit()
        return {
            "message": "Video generation config deleted successfully",
            "id": config_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        logger.exception("Failed to delete VideoGenerationConfig")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete config: {e!s}"
        ) from e


# =============================================================================
# Video Generation Execution + Results CRUD
# =============================================================================


@router.post("/video-generations", response_model=VideoGenerationRead)
async def create_video_generation(
    data: VideoGenerationCreate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Create and execute a video generation request."""
    try:
        await check_permission(
            session,
            user,
            data.search_space_id,
            Permission.VIDEO_GENERATIONS_CREATE.value,
            "You don't have permission to create video generations in this search space",
        )

        result = await session.execute(
            select(SearchSpace).filter(SearchSpace.id == data.search_space_id)
        )
        search_space = result.scalars().first()
        if not search_space:
            raise HTTPException(status_code=404, detail="Search space not found")

        # Generate access token for video serving
        access_token = generate_image_token()

        db_video_gen = VideoGeneration(
            prompt=data.prompt,
            model=data.model,
            mode=data.mode,
            size=data.size,
            frames=data.frames,
            video_generation_config_id=data.video_generation_config_id,
            search_space_id=data.search_space_id,
            created_by_id=user.id,
            access_token=access_token,
        )
        session.add(db_video_gen)
        await session.flush()

        try:
            await _execute_video_generation(session, db_video_gen, search_space)
        except Exception as e:
            logger.exception("Video generation call failed")
            db_video_gen.error_message = str(e)

        await session.commit()
        await session.refresh(db_video_gen)
        return db_video_gen

    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=500, detail="Database error during video generation"
        ) from None
    except Exception as e:
        await session.rollback()
        logger.exception("Failed to create video generation")
        raise HTTPException(
            status_code=500, detail=f"Video generation failed: {e!s}"
        ) from e


@router.get("/video-generations", response_model=list[VideoGenerationListRead])
async def list_video_generations(
    search_space_id: int | None = None,
    skip: int = 0,
    limit: int = 50,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """List video generations."""
    if skip < 0 or limit < 1:
        raise HTTPException(status_code=400, detail="Invalid pagination parameters")
    if limit > 100:
        limit = 100

    try:
        if search_space_id is not None:
            await check_permission(
                session,
                user,
                search_space_id,
                Permission.VIDEO_GENERATIONS_READ.value,
                "You don't have permission to read video generations in this search space",
            )
            result = await session.execute(
                select(VideoGeneration)
                .filter(VideoGeneration.search_space_id == search_space_id)
                .order_by(VideoGeneration.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
        else:
            result = await session.execute(
                select(VideoGeneration)
                .join(SearchSpace)
                .join(SearchSpaceMembership)
                .filter(SearchSpaceMembership.user_id == user.id)
                .order_by(VideoGeneration.created_at.desc())
                .offset(skip)
                .limit(limit)
            )

        return [
            VideoGenerationListRead.from_orm_with_status(vid)
            for vid in result.scalars().all()
        ]

    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=500, detail="Database error fetching video generations"
        ) from None


@router.get("/video-generations/{video_gen_id}", response_model=VideoGenerationRead)
async def get_video_generation(
    video_gen_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Get a specific video generation by ID."""
    try:
        result = await session.execute(
            select(VideoGeneration).filter(VideoGeneration.id == video_gen_id)
        )
        video_gen = result.scalars().first()
        if not video_gen:
            raise HTTPException(status_code=404, detail="Video generation not found")

        await check_permission(
            session,
            user,
            video_gen.search_space_id,
            Permission.VIDEO_GENERATIONS_READ.value,
            "You don't have permission to read video generations in this search space",
        )
        return video_gen

    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=500, detail="Database error fetching video generation"
        ) from None


@router.delete("/video-generations/{video_gen_id}", response_model=dict)
async def delete_video_generation(
    video_gen_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Delete a video generation record and its file on disk."""
    try:
        result = await session.execute(
            select(VideoGeneration).filter(VideoGeneration.id == video_gen_id)
        )
        db_video_gen = result.scalars().first()
        if not db_video_gen:
            raise HTTPException(status_code=404, detail="Video generation not found")

        await check_permission(
            session,
            user,
            db_video_gen.search_space_id,
            Permission.VIDEO_GENERATIONS_DELETE.value,
            "You don't have permission to delete video generations in this search space",
        )

        # Cleanup file on disk
        if db_video_gen.video_path:
            try:
                os.remove(db_video_gen.video_path)
            except OSError:
                logger.warning("Failed to delete video file: %s", db_video_gen.video_path)

        await session.delete(db_video_gen)
        await session.commit()
        return {"message": "Video generation deleted successfully"}

    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=500, detail="Database error deleting video generation"
        ) from None


# =============================================================================
# Video Serving (serves .mp4 files from disk, protected by signed tokens)
# =============================================================================


@router.get("/video-generations/{video_gen_id}/video")
async def serve_generated_video(
    video_gen_id: int,
    token: str = Query(..., description="Signed access token"),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Serve a generated video by ID, protected by a signed token.

    The token is generated when the video record is created and ensures
    only users with access can view the video without auth headers
    (which <video> tags cannot pass).
    """
    try:
        result = await session.execute(
            select(VideoGeneration).filter(VideoGeneration.id == video_gen_id)
        )
        video_gen = result.scalars().first()
        if not video_gen:
            raise HTTPException(status_code=404, detail="Video generation not found")

        # Verify the access token
        if not verify_image_token(video_gen.access_token, token):
            raise HTTPException(status_code=403, detail="Invalid video access token")

        if not video_gen.video_path:
            raise HTTPException(status_code=404, detail="No video data available")

        video_file = Path(video_gen.video_path)
        if not video_file.exists():
            raise HTTPException(status_code=404, detail="Video file not found on disk")

        return FileResponse(
            path=str(video_file),
            media_type="video/mp4",
            filename=f"generated-{video_gen_id}.mp4",
            headers={
                "Cache-Control": "public, max-age=86400",
                "Accept-Ranges": "bytes",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to serve generated video")
        raise HTTPException(
            status_code=500, detail=f"Failed to serve video: {e!s}"
        ) from e
