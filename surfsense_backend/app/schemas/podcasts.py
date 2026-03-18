"""Podcast schemas for API responses."""

from datetime import datetime
from enum import StrEnum
from typing import Any, Optional

from pydantic import BaseModel, Field


class PodcastStatusEnum(StrEnum):
    PENDING = "pending"
    GENERATING = "generating"
    READY = "ready"
    FAILED = "failed"


# =============================================================================
# Podcast CRUD schemas (existing)
# =============================================================================


class PodcastBase(BaseModel):
    """Base podcast schema."""

    title: str
    podcast_transcript: list[dict[str, Any]] | None = None
    file_location: str | None = None
    search_space_id: int


class PodcastCreate(PodcastBase):
    """Schema for creating a podcast."""

    pass


class PodcastUpdate(BaseModel):
    """Schema for updating a podcast."""

    title: str | None = None
    podcast_transcript: list[dict[str, Any]] | None = None
    file_location: str | None = None


class PodcastRead(PodcastBase):
    """Schema for reading a podcast."""

    id: int
    status: PodcastStatusEnum = PodcastStatusEnum.READY
    created_at: datetime
    transcript_entries: int | None = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_entries(cls, obj):
        """Create PodcastRead with transcript_entries computed."""
        data = {
            "id": obj.id,
            "title": obj.title,
            "podcast_transcript": obj.podcast_transcript,
            "file_location": obj.file_location,
            "search_space_id": obj.search_space_id,
            "status": obj.status,
            "created_at": obj.created_at,
            "transcript_entries": len(obj.podcast_transcript)
            if obj.podcast_transcript
            else None,
        }
        return cls(**data)


# =============================================================================
# Speaker schemas
# =============================================================================


class SpeakerSchema(BaseModel):
    """Schema for a single speaker within a profile."""

    name: str
    voice_id: str
    backstory: str
    personality: str
    tts_provider: Optional[str] = None
    tts_model: Optional[str] = None
    tts_config: Optional[dict[str, Any]] = None


# =============================================================================
# Speaker Profile CRUD schemas
# =============================================================================


class SpeakerProfileCreate(BaseModel):
    name: str
    search_space_id: int
    tts_provider: str
    tts_model: str
    speakers: list[SpeakerSchema]


class SpeakerProfileUpdate(BaseModel):
    name: Optional[str] = None
    tts_provider: Optional[str] = None
    tts_model: Optional[str] = None
    speakers: Optional[list[SpeakerSchema]] = None


class SpeakerProfileRead(BaseModel):
    id: int
    name: str
    search_space_id: int
    tts_provider: Optional[str] = None
    tts_model: Optional[str] = None
    speakers: list[SpeakerSchema]
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_obj(cls, obj):
        speakers = obj.speakers or []
        return cls(
            id=obj.id,
            name=obj.name,
            search_space_id=obj.search_space_id,
            tts_provider=obj.tts_provider,
            tts_model=obj.tts_model,
            speakers=[SpeakerSchema(**s) for s in speakers],
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )


# =============================================================================
# Episode Profile CRUD schemas
# =============================================================================


class EpisodeProfileCreate(BaseModel):
    name: str
    search_space_id: int
    speaker_profile_id: Optional[int] = None
    num_segments: int = Field(default=3, ge=1, le=10)
    language: str = "en"
    default_briefing: Optional[str] = None
    outline_prompt: Optional[str] = None
    transcript_prompt: Optional[str] = None


class EpisodeProfileUpdate(BaseModel):
    name: Optional[str] = None
    speaker_profile_id: Optional[int] = None
    num_segments: Optional[int] = Field(default=None, ge=1, le=10)
    language: Optional[str] = None
    default_briefing: Optional[str] = None
    outline_prompt: Optional[str] = None
    transcript_prompt: Optional[str] = None


class EpisodeProfileRead(BaseModel):
    id: int
    name: str
    search_space_id: int
    speaker_profile_id: Optional[int] = None
    num_segments: int
    language: str
    default_briefing: Optional[str] = None
    outline_prompt: Optional[str] = None
    transcript_prompt: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_obj(cls, obj):
        return cls(
            id=obj.id,
            name=obj.name,
            search_space_id=obj.search_space_id,
            speaker_profile_id=obj.speaker_profile_id,
            num_segments=obj.num_segments,
            language=obj.language,
            default_briefing=obj.default_briefing,
            outline_prompt=obj.outline_prompt,
            transcript_prompt=obj.transcript_prompt,
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )


# =============================================================================
# Podcast generation request
# =============================================================================


class PodcastGenerateRequest(BaseModel):
    """Request body for POST /podcasts/generate."""

    source_content: str
    title: str = "SurfSense Podcast"
    user_prompt: Optional[str] = None
    search_space_id: int
    speaker_profile_id: Optional[int] = None
    episode_profile_id: Optional[int] = None
