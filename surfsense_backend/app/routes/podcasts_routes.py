"""
Podcast routes for CRUD operations and audio streaming.

These routes support the podcast generation feature in new-chat.
Frontend polls GET /podcasts/{podcast_id} to check status field.
"""

import logging
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import (
    Permission,
    Podcast,
    PodcastStatus,
    SearchSpace,
    SearchSpaceMembership,
    User,
    get_async_session,
)
from app.schemas import PodcastGenerateRequest, PodcastRead
from app.users import current_active_user
from app.utils.rbac import check_permission

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/podcasts", response_model=list[PodcastRead])
async def read_podcasts(
    skip: int = 0,
    limit: int = 100,
    search_space_id: int | None = None,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """
    List podcasts the user has access to.
    Requires PODCASTS_READ permission for the search space(s).
    """
    if skip < 0 or limit < 1:
        raise HTTPException(status_code=400, detail="Invalid pagination parameters")
    try:
        if search_space_id is not None:
            # Check permission for specific search space
            await check_permission(
                session,
                user,
                search_space_id,
                Permission.PODCASTS_READ.value,
                "You don't have permission to read podcasts in this search space",
            )
            result = await session.execute(
                select(Podcast)
                .filter(Podcast.search_space_id == search_space_id)
                .offset(skip)
                .limit(limit)
            )
        else:
            # Get podcasts from all search spaces user has membership in
            result = await session.execute(
                select(Podcast)
                .join(SearchSpace)
                .join(SearchSpaceMembership)
                .filter(SearchSpaceMembership.user_id == user.id)
                .offset(skip)
                .limit(limit)
            )
        return result.scalars().all()
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=500, detail="Database error occurred while fetching podcasts"
        ) from None


@router.get("/podcasts/{podcast_id}", response_model=PodcastRead)
async def read_podcast(
    podcast_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """
    Get a specific podcast by ID.

    Requires authentication with PODCASTS_READ permission.
    For public podcast access, use /public/{share_token}/podcasts/{podcast_id}/stream
    """
    try:
        result = await session.execute(select(Podcast).filter(Podcast.id == podcast_id))
        podcast = result.scalars().first()

        if not podcast:
            raise HTTPException(
                status_code=404,
                detail="Podcast not found",
            )

        await check_permission(
            session,
            user,
            podcast.search_space_id,
            Permission.PODCASTS_READ.value,
            "You don't have permission to read podcasts in this search space",
        )

        return PodcastRead.from_orm_with_entries(podcast)
    except HTTPException as he:
        raise he
    except SQLAlchemyError:
        raise HTTPException(
            status_code=500, detail="Database error occurred while fetching podcast"
        ) from None


@router.delete("/podcasts/{podcast_id}", response_model=dict)
async def delete_podcast(
    podcast_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """
    Delete a podcast.
    Requires PODCASTS_DELETE permission for the search space.
    """
    try:
        result = await session.execute(select(Podcast).filter(Podcast.id == podcast_id))
        db_podcast = result.scalars().first()

        if not db_podcast:
            raise HTTPException(status_code=404, detail="Podcast not found")

        # Check permission for the search space
        await check_permission(
            session,
            user,
            db_podcast.search_space_id,
            Permission.PODCASTS_DELETE.value,
            "You don't have permission to delete podcasts in this search space",
        )

        # Clean up audio file from disk
        file_path = db_podcast.file_location
        if file_path and os.path.isfile(file_path):
            try:
                os.remove(file_path)
            except OSError:
                logger.warning("Failed to remove podcast file: %s", file_path)

        await session.delete(db_podcast)
        await session.commit()
        return {"message": "Podcast deleted successfully"}
    except HTTPException as he:
        raise he
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=500, detail="Database error occurred while deleting podcast"
        ) from None


@router.post("/podcasts/generate")
async def generate_podcast(
    body: PodcastGenerateRequest,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """
    Generate a podcast from source content.

    Creates a podcast record and dispatches a Celery task.
    Returns the podcast_id for polling.
    """
    await check_permission(
        session,
        user,
        body.search_space_id,
        Permission.PODCASTS_CREATE.value,
        "You don't have permission to create podcasts in this search space",
    )

    from app.agents.new_chat.tools.podcast import (
        get_generating_podcast_id,
        set_generating_podcast,
    )

    generating_id = get_generating_podcast_id(body.search_space_id)
    if generating_id:
        return {
            "status": "generating",
            "podcast_id": generating_id,
            "title": body.title,
            "message": "A podcast is already being generated. Please wait for it to complete.",
        }

    try:
        podcast = Podcast(
            title=body.title,
            status=PodcastStatus.PENDING,
            search_space_id=body.search_space_id,
            speaker_profile_id=body.speaker_profile_id,
            episode_profile_id=body.episode_profile_id,
            source_content=body.source_content,
            user_prompt=body.user_prompt,
        )
        session.add(podcast)
        await session.commit()
        await session.refresh(podcast)

        from app.tasks.celery_tasks.podcast_tasks import (
            generate_content_podcast_task,
        )

        generate_content_podcast_task.delay(
            podcast_id=podcast.id,
            source_content=body.source_content,
            search_space_id=body.search_space_id,
            user_prompt=body.user_prompt,
            speaker_profile_id=body.speaker_profile_id,
            episode_profile_id=body.episode_profile_id,
        )

        set_generating_podcast(body.search_space_id, podcast.id)

        return {
            "status": "pending",
            "podcast_id": podcast.id,
            "title": body.title,
            "message": "Podcast generation started. This may take a few minutes.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting podcast generation: {e!s}")


@router.post("/podcasts/{podcast_id}/retry")
async def retry_podcast(
    podcast_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """
    Retry a failed podcast generation.

    Re-dispatches the Celery task using the stored source_content.
    Only works on podcasts with status FAILED.
    """
    try:
        result = await session.execute(select(Podcast).filter(Podcast.id == podcast_id))
        db_podcast = result.scalars().first()

        if not db_podcast:
            raise HTTPException(status_code=404, detail="Podcast not found")

        await check_permission(
            session,
            user,
            db_podcast.search_space_id,
            Permission.PODCASTS_CREATE.value,
            "You don't have permission to create podcasts in this search space",
        )

        if db_podcast.status != PodcastStatus.FAILED:
            raise HTTPException(status_code=400, detail="Only failed podcasts can be retried")

        if not db_podcast.source_content:
            raise HTTPException(
                status_code=400,
                detail="Source content not available for retry",
            )

        from app.agents.new_chat.tools.podcast import (
            get_generating_podcast_id,
            set_generating_podcast,
        )

        generating_id = get_generating_podcast_id(db_podcast.search_space_id)
        if generating_id:
            return {
                "status": "generating",
                "podcast_id": generating_id,
                "message": "A podcast is already being generated. Please wait for it to complete.",
            }

        db_podcast.status = PodcastStatus.PENDING
        db_podcast.file_location = None
        db_podcast.podcast_transcript = None
        await session.commit()

        from app.tasks.celery_tasks.podcast_tasks import (
            generate_content_podcast_task,
        )

        generate_content_podcast_task.delay(
            podcast_id=db_podcast.id,
            source_content=db_podcast.source_content,
            search_space_id=db_podcast.search_space_id,
            user_prompt=db_podcast.user_prompt,
            speaker_profile_id=db_podcast.speaker_profile_id,
            episode_profile_id=db_podcast.episode_profile_id,
        )

        set_generating_podcast(db_podcast.search_space_id, db_podcast.id)

        return {
            "status": "pending",
            "podcast_id": db_podcast.id,
            "title": db_podcast.title,
            "message": "Podcast retry started. This may take a few minutes.",
        }
    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=500, detail="Database error occurred while retrying podcast"
        ) from None
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error retrying podcast: {e!s}"
        )


@router.get("/podcasts/{podcast_id}/stream")
@router.get("/podcasts/{podcast_id}/audio")
async def stream_podcast(
    podcast_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """
    Stream a podcast audio file.

    Requires authentication with PODCASTS_READ permission.
    For public podcast access, use /public/{share_token}/podcasts/{podcast_id}/stream

    Note: Both /stream and /audio endpoints are supported for compatibility.
    """
    try:
        result = await session.execute(select(Podcast).filter(Podcast.id == podcast_id))
        podcast = result.scalars().first()

        if not podcast:
            raise HTTPException(status_code=404, detail="Podcast not found")

        await check_permission(
            session,
            user,
            podcast.search_space_id,
            Permission.PODCASTS_READ.value,
            "You don't have permission to access podcasts in this search space",
        )

        file_path = podcast.file_location

        if not file_path or not os.path.isfile(file_path):
            raise HTTPException(status_code=404, detail="Podcast audio file not found")

        def iterfile():
            with open(file_path, mode="rb") as file_like:
                yield from file_like

        return StreamingResponse(
            iterfile(),
            media_type="audio/mpeg",
            headers={
                "Accept-Ranges": "bytes",
                "Content-Disposition": f"inline; filename={Path(file_path).name}",
            },
        )

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error streaming podcast: {e!s}"
        ) from e
