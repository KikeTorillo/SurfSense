"""CRUD routes for podcast speaker and episode profiles."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import (
    Permission,
    PodcastEpisodeProfile,
    PodcastSpeakerProfile,
    User,
    get_async_session,
)
from app.schemas.podcasts import (
    EpisodeProfileCreate,
    EpisodeProfileRead,
    EpisodeProfileUpdate,
    SpeakerProfileCreate,
    SpeakerProfileRead,
    SpeakerProfileUpdate,
)
from app.users import current_active_user
from app.utils.rbac import check_permission

router = APIRouter()

# =============================================================================
# Speaker Profiles
# =============================================================================


@router.post("/podcast-profiles/speakers", response_model=SpeakerProfileRead)
async def create_speaker_profile(
    body: SpeakerProfileCreate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Create a new speaker profile."""
    await check_permission(
        session,
        user,
        body.search_space_id,
        Permission.PODCASTS_CREATE.value,
        "You don't have permission to create podcast profiles in this search space",
    )
    try:
        profile = PodcastSpeakerProfile(
            name=body.name,
            search_space_id=body.search_space_id,
            tts_provider=body.tts_provider,
            tts_model=body.tts_model,
            speakers=[s.model_dump() for s in body.speakers],
            created_by=user.id,
        )
        session.add(profile)
        await session.commit()
        await session.refresh(profile)
        return SpeakerProfileRead.from_orm_obj(profile)
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while creating speaker profile",
        ) from None


@router.get(
    "/podcast-profiles/speakers", response_model=list[SpeakerProfileRead]
)
async def list_speaker_profiles(
    search_space_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """List speaker profiles for a search space."""
    await check_permission(
        session,
        user,
        search_space_id,
        Permission.PODCASTS_READ.value,
        "You don't have permission to read podcast profiles in this search space",
    )
    try:
        result = await session.execute(
            select(PodcastSpeakerProfile)
            .filter(PodcastSpeakerProfile.search_space_id == search_space_id)
            .order_by(PodcastSpeakerProfile.created_at.desc())
        )
        profiles = result.scalars().all()
        return [SpeakerProfileRead.from_orm_obj(p) for p in profiles]
    except SQLAlchemyError:
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while listing speaker profiles",
        ) from None


@router.get(
    "/podcast-profiles/speakers/{profile_id}", response_model=SpeakerProfileRead
)
async def get_speaker_profile(
    profile_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Get a specific speaker profile."""
    try:
        result = await session.execute(
            select(PodcastSpeakerProfile).filter(
                PodcastSpeakerProfile.id == profile_id
            )
        )
        profile = result.scalars().first()
        if not profile:
            raise HTTPException(status_code=404, detail="Speaker profile not found")
        await check_permission(
            session,
            user,
            profile.search_space_id,
            Permission.PODCASTS_READ.value,
            "You don't have permission to read podcast profiles in this search space",
        )
        return SpeakerProfileRead.from_orm_obj(profile)
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while fetching speaker profile",
        ) from None


@router.put(
    "/podcast-profiles/speakers/{profile_id}", response_model=SpeakerProfileRead
)
async def update_speaker_profile(
    profile_id: int,
    body: SpeakerProfileUpdate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Update a speaker profile."""
    try:
        result = await session.execute(
            select(PodcastSpeakerProfile).filter(
                PodcastSpeakerProfile.id == profile_id
            )
        )
        profile = result.scalars().first()
        if not profile:
            raise HTTPException(status_code=404, detail="Speaker profile not found")
        await check_permission(
            session,
            user,
            profile.search_space_id,
            Permission.PODCASTS_UPDATE.value,
            "You don't have permission to update podcast profiles in this search space",
        )
        update_data = body.model_dump(exclude_unset=True)
        if "speakers" in update_data and update_data["speakers"] is not None:
            update_data["speakers"] = [s.model_dump() for s in body.speakers]
        for key, value in update_data.items():
            setattr(profile, key, value)
        profile.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(profile)
        return SpeakerProfileRead.from_orm_obj(profile)
    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while updating speaker profile",
        ) from None


@router.delete("/podcast-profiles/speakers/{profile_id}")
async def delete_speaker_profile(
    profile_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Delete a speaker profile."""
    try:
        result = await session.execute(
            select(PodcastSpeakerProfile).filter(
                PodcastSpeakerProfile.id == profile_id
            )
        )
        profile = result.scalars().first()
        if not profile:
            raise HTTPException(status_code=404, detail="Speaker profile not found")
        await check_permission(
            session,
            user,
            profile.search_space_id,
            Permission.PODCASTS_DELETE.value,
            "You don't have permission to delete podcast profiles in this search space",
        )
        await session.delete(profile)
        await session.commit()
        return {"message": "Speaker profile deleted successfully"}
    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while deleting speaker profile",
        ) from None


# =============================================================================
# Episode Profiles
# =============================================================================


@router.post("/podcast-profiles/episodes", response_model=EpisodeProfileRead)
async def create_episode_profile(
    body: EpisodeProfileCreate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Create a new episode profile."""
    await check_permission(
        session,
        user,
        body.search_space_id,
        Permission.PODCASTS_CREATE.value,
        "You don't have permission to create podcast profiles in this search space",
    )
    try:
        profile = PodcastEpisodeProfile(
            name=body.name,
            search_space_id=body.search_space_id,
            speaker_profile_id=body.speaker_profile_id,
            num_segments=body.num_segments,
            language=body.language,
            default_briefing=body.default_briefing,
            outline_prompt=body.outline_prompt,
            transcript_prompt=body.transcript_prompt,
            created_by=user.id,
        )
        session.add(profile)
        await session.commit()
        await session.refresh(profile)
        return EpisodeProfileRead.from_orm_obj(profile)
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while creating episode profile",
        ) from None


@router.get(
    "/podcast-profiles/episodes", response_model=list[EpisodeProfileRead]
)
async def list_episode_profiles(
    search_space_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """List episode profiles for a search space."""
    await check_permission(
        session,
        user,
        search_space_id,
        Permission.PODCASTS_READ.value,
        "You don't have permission to read podcast profiles in this search space",
    )
    try:
        result = await session.execute(
            select(PodcastEpisodeProfile)
            .filter(PodcastEpisodeProfile.search_space_id == search_space_id)
            .order_by(PodcastEpisodeProfile.created_at.desc())
        )
        profiles = result.scalars().all()
        return [EpisodeProfileRead.from_orm_obj(p) for p in profiles]
    except SQLAlchemyError:
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while listing episode profiles",
        ) from None


@router.get(
    "/podcast-profiles/episodes/{profile_id}", response_model=EpisodeProfileRead
)
async def get_episode_profile(
    profile_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Get a specific episode profile."""
    try:
        result = await session.execute(
            select(PodcastEpisodeProfile).filter(
                PodcastEpisodeProfile.id == profile_id
            )
        )
        profile = result.scalars().first()
        if not profile:
            raise HTTPException(status_code=404, detail="Episode profile not found")
        await check_permission(
            session,
            user,
            profile.search_space_id,
            Permission.PODCASTS_READ.value,
            "You don't have permission to read podcast profiles in this search space",
        )
        return EpisodeProfileRead.from_orm_obj(profile)
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while fetching episode profile",
        ) from None


@router.put(
    "/podcast-profiles/episodes/{profile_id}", response_model=EpisodeProfileRead
)
async def update_episode_profile(
    profile_id: int,
    body: EpisodeProfileUpdate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Update an episode profile."""
    try:
        result = await session.execute(
            select(PodcastEpisodeProfile).filter(
                PodcastEpisodeProfile.id == profile_id
            )
        )
        profile = result.scalars().first()
        if not profile:
            raise HTTPException(status_code=404, detail="Episode profile not found")
        await check_permission(
            session,
            user,
            profile.search_space_id,
            Permission.PODCASTS_UPDATE.value,
            "You don't have permission to update podcast profiles in this search space",
        )
        update_data = body.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(profile, key, value)
        profile.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(profile)
        return EpisodeProfileRead.from_orm_obj(profile)
    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while updating episode profile",
        ) from None


@router.delete("/podcast-profiles/episodes/{profile_id}")
async def delete_episode_profile(
    profile_id: int,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """Delete an episode profile."""
    try:
        result = await session.execute(
            select(PodcastEpisodeProfile).filter(
                PodcastEpisodeProfile.id == profile_id
            )
        )
        profile = result.scalars().first()
        if not profile:
            raise HTTPException(status_code=404, detail="Episode profile not found")
        await check_permission(
            session,
            user,
            profile.search_space_id,
            Permission.PODCASTS_DELETE.value,
            "You don't have permission to delete podcast profiles in this search space",
        )
        await session.delete(profile)
        await session.commit()
        return {"message": "Episode profile deleted successfully"}
    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while deleting episode profile",
        ) from None
