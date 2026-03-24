"""
Pydantic schemas for Video Generation configs and generation requests.

VideoGenerationConfig: CRUD schemas for user-created video gen model configs.
VideoGeneration: Schemas for the actual video generation requests/results.
GlobalVideoGenConfigRead: Schema for admin-configured YAML configs.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.db import VideoGenProvider

# =============================================================================
# VideoGenerationConfig CRUD Schemas
# =============================================================================


class VideoGenerationConfigBase(BaseModel):
    """Base schema with fields for VideoGenerationConfig."""

    name: str = Field(
        ..., max_length=100, description="User-friendly name for the config"
    )
    description: str | None = Field(
        None, max_length=500, description="Optional description"
    )
    provider: VideoGenProvider = Field(
        ...,
        description="Video generation provider (currently only OpenAI-compatible)",
    )
    custom_provider: str | None = Field(
        None, max_length=100, description="Custom provider name"
    )
    model_name: str = Field(
        ..., max_length=100, description="Model name (e.g., ltx-2.3-t2v, ltx-2.3-i2v)"
    )
    api_key: str = Field(..., description="API key for the provider")
    api_base: str | None = Field(
        None, max_length=500, description="API base URL (required for local proxies)"
    )
    extra_params: dict[str, Any] | None = Field(
        default=None, description="Additional parameters (size, frames, etc.)"
    )


class VideoGenerationConfigCreate(VideoGenerationConfigBase):
    """Schema for creating a new VideoGenerationConfig."""

    search_space_id: int = Field(
        ..., description="Search space ID to associate the config with"
    )


class VideoGenerationConfigUpdate(BaseModel):
    """Schema for updating an existing VideoGenerationConfig. All fields optional."""

    name: str | None = Field(None, max_length=100)
    description: str | None = Field(None, max_length=500)
    provider: VideoGenProvider | None = None
    custom_provider: str | None = Field(None, max_length=100)
    model_name: str | None = Field(None, max_length=100)
    api_key: str | None = None
    api_base: str | None = Field(None, max_length=500)
    extra_params: dict[str, Any] | None = None


class VideoGenerationConfigRead(VideoGenerationConfigBase):
    """Schema for reading a VideoGenerationConfig (includes id and timestamps)."""

    id: int
    created_at: datetime
    search_space_id: int
    user_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# VideoGeneration (request/result) Schemas
# =============================================================================


class VideoGenerationCreate(BaseModel):
    """Schema for creating a video generation request."""

    prompt: str = Field(
        ...,
        min_length=1,
        max_length=4000,
        description="A text description of the desired video",
    )
    model: str | None = Field(
        None,
        max_length=200,
        description="The model to use (e.g., 'ltx-2.3-t2v'). Overrides the config model.",
    )
    mode: str = Field(
        "t2v",
        max_length=10,
        description="Generation mode: 't2v' (text-to-video) or 'i2v' (image-to-video)",
    )
    size: str | None = Field(None, max_length=50, description="Video size (e.g., '768x512')")
    frames: int | None = Field(
        None,
        ge=1,
        le=257,
        description="Number of frames to generate (1-257)",
    )
    image_base64: str | None = Field(
        None,
        description="Base64-encoded image for i2v mode",
    )
    search_space_id: int = Field(
        ..., description="Search space ID to associate the generation with"
    )
    video_generation_config_id: int | None = Field(
        None,
        description=(
            "Video generation config ID. "
            "Negative = global YAML config, positive = DB config. "
            "If not provided, uses the search space's video_generation_config_id preference."
        ),
    )


class VideoGenerationRead(BaseModel):
    """Schema for reading a video generation record."""

    id: int
    prompt: str
    model: str | None = None
    mode: str | None = None
    size: str | None = None
    frames: int | None = None
    video_generation_config_id: int | None = None
    video_path: str | None = None
    error_message: str | None = None
    access_token: str | None = None
    search_space_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VideoGenerationListRead(BaseModel):
    """Lightweight schema for listing video generations (without video_path)."""

    id: int
    prompt: str
    model: str | None = None
    mode: str | None = None
    size: str | None = None
    frames: int | None = None
    search_space_id: int
    created_at: datetime
    is_success: bool

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_with_status(cls, obj: Any) -> "VideoGenerationListRead":
        """Create VideoGenerationListRead with computed fields."""
        return cls(
            id=obj.id,
            prompt=obj.prompt,
            model=obj.model,
            mode=obj.mode,
            size=obj.size,
            frames=obj.frames,
            search_space_id=obj.search_space_id,
            created_at=obj.created_at,
            is_success=obj.video_path is not None,
        )


# =============================================================================
# Global Video Gen Config (from YAML)
# =============================================================================


class GlobalVideoGenConfigRead(BaseModel):
    """
    Schema for reading global video generation configs from YAML.
    Global configs have negative IDs. API key is hidden.
    """

    id: int = Field(
        ...,
        description="Config ID: negative for global configs",
    )
    name: str
    description: str | None = None
    provider: str
    custom_provider: str | None = None
    model_name: str
    api_base: str | None = None
    extra_params: dict[str, Any] | None = None
    is_global: bool = True
