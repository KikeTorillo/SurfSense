"""CRUD routes for TTS (text-to-speech) configurations."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import config
from app.db import Permission, TTSConfig, User, get_async_session
from app.schemas.tts_config import (
    GlobalTTSConfigRead,
    TTSConfigCreate,
    TTSConfigRead,
    TTSConfigUpdate,
)
from app.users import current_active_user
from app.utils.rbac import check_permission

logger = logging.getLogger(__name__)

router = APIRouter(tags=["TTS Configs"])


# =============================================================================
# Global TTS Configs (from YAML)
# =============================================================================


@router.get(
    "/global-tts-configs",
    response_model=list[GlobalTTSConfigRead],
)
async def get_global_tts_configs(
    user: User = Depends(current_active_user),
):
    """
    Get all global TTS configs. API keys are hidden.

    Includes:
    - Auto mode (ID 0): Uses LiteLLM Router for automatic load balancing
    - Global configs (negative IDs): Individual pre-configured TTS providers
    """
    try:
        global_configs = config.GLOBAL_TTS_CONFIGS
        safe_configs = []

        # Include Auto mode if there are global configs to route to
        if global_configs and len(global_configs) > 0:
            safe_configs.append(
                {
                    "id": 0,
                    "name": "Auto (Fastest)",
                    "description": "Automatically routes requests across available TTS providers for optimal performance and rate limit handling.",
                    "provider": "AUTO",
                    "model_name": "auto",
                    "api_base": None,
                    "litellm_params": {},
                    "is_global": True,
                    "is_auto_mode": True,
                }
            )

        for cfg in global_configs:
            safe_configs.append(
                {
                    "id": cfg.get("id"),
                    "name": cfg.get("name"),
                    "description": cfg.get("description"),
                    "provider": cfg.get("provider"),
                    "model_name": cfg.get("model_name"),
                    "api_base": cfg.get("api_base") or None,
                    "litellm_params": cfg.get("litellm_params", {}),
                    "is_global": True,
                    "is_auto_mode": False,
                }
            )

        return safe_configs
    except Exception as e:
        logger.exception("Failed to fetch global TTS configs")
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch configs: {e!s}"
        ) from e


# =============================================================================
# TTSConfig CRUD
# =============================================================================


@router.post("/tts-configs", response_model=TTSConfigRead)
async def create_tts_config(
    config_data: TTSConfigCreate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Create a new TTS config for a search space."""
    try:
        await check_permission(
            session,
            user,
            config_data.search_space_id,
            Permission.TTS_CONFIGS_CREATE.value,
            "You don't have permission to create TTS configs in this search space",
        )

        db_config = TTSConfig(**config_data.model_dump(), user_id=user.id)
        session.add(db_config)
        await session.commit()
        await session.refresh(db_config)
        return db_config

    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        logger.exception("Failed to create TTSConfig")
        raise HTTPException(
            status_code=500, detail=f"Failed to create config: {e!s}"
        ) from e


@router.get("/tts-configs", response_model=list[TTSConfigRead])
async def list_tts_configs(
    search_space_id: int,
    skip: int = 0,
    limit: int = 100,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """List TTS configs for a search space."""
    try:
        await check_permission(
            session,
            user,
            search_space_id,
            Permission.TTS_CONFIGS_READ.value,
            "You don't have permission to view TTS configs in this search space",
        )

        result = await session.execute(
            select(TTSConfig)
            .filter(TTSConfig.search_space_id == search_space_id)
            .order_by(TTSConfig.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list TTSConfigs")
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch configs: {e!s}"
        ) from e


@router.get("/tts-configs/{config_id}", response_model=TTSConfigRead)
async def get_tts_config(
    config_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Get a specific TTS config by ID."""
    try:
        result = await session.execute(
            select(TTSConfig).filter(TTSConfig.id == config_id)
        )
        db_config = result.scalars().first()
        if not db_config:
            raise HTTPException(status_code=404, detail="Config not found")

        await check_permission(
            session,
            user,
            db_config.search_space_id,
            Permission.TTS_CONFIGS_READ.value,
            "You don't have permission to view TTS configs in this search space",
        )
        return db_config

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get TTSConfig")
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch config: {e!s}"
        ) from e


@router.put("/tts-configs/{config_id}", response_model=TTSConfigRead)
async def update_tts_config(
    config_id: int,
    update_data: TTSConfigUpdate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Update an existing TTS config."""
    try:
        result = await session.execute(
            select(TTSConfig).filter(TTSConfig.id == config_id)
        )
        db_config = result.scalars().first()
        if not db_config:
            raise HTTPException(status_code=404, detail="Config not found")

        await check_permission(
            session,
            user,
            db_config.search_space_id,
            Permission.TTS_CONFIGS_UPDATE.value,
            "You don't have permission to update TTS configs in this search space",
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
        logger.exception("Failed to update TTSConfig")
        raise HTTPException(
            status_code=500, detail=f"Failed to update config: {e!s}"
        ) from e


@router.delete("/tts-configs/{config_id}", response_model=dict)
async def delete_tts_config(
    config_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Delete a TTS config."""
    try:
        result = await session.execute(
            select(TTSConfig).filter(TTSConfig.id == config_id)
        )
        db_config = result.scalars().first()
        if not db_config:
            raise HTTPException(status_code=404, detail="Config not found")

        await check_permission(
            session,
            user,
            db_config.search_space_id,
            Permission.TTS_CONFIGS_DELETE.value,
            "You don't have permission to delete TTS configs in this search space",
        )

        await session.delete(db_config)
        await session.commit()
        return {
            "message": "TTS config deleted successfully",
            "id": config_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        logger.exception("Failed to delete TTSConfig")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete config: {e!s}"
        ) from e
