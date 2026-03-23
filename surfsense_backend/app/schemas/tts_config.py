"""
Pydantic schemas for TTS (text-to-speech) configuration CRUD.

TTSConfig: user-created TTS model configs for podcast audio generation.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.db import TTSProvider

# =============================================================================
# TTSConfig CRUD Schemas
# =============================================================================


class TTSConfigBase(BaseModel):
    """Base schema with fields for TTSConfig."""

    name: str = Field(
        ..., max_length=100, description="User-friendly name for the config"
    )
    description: str | None = Field(
        None, max_length=500, description="Optional description"
    )
    provider: TTSProvider = Field(
        ...,
        description="TTS provider (Kokoro, OpenAI, Azure, Vertex AI)",
    )
    custom_provider: str | None = Field(
        None, max_length=100, description="Custom provider name"
    )
    model_name: str = Field(
        ..., max_length=100, description="Model name (e.g., tts-1, kokoro)"
    )
    api_key: str | None = Field(
        None, description="API key for the provider (optional for local providers)"
    )
    api_base: str | None = Field(
        None, max_length=500, description="Optional API base URL"
    )
    litellm_params: dict[str, Any] | None = Field(
        default=None, description="Additional LiteLLM parameters"
    )


class TTSConfigCreate(TTSConfigBase):
    """Schema for creating a new TTSConfig."""

    search_space_id: int = Field(
        ..., description="Search space ID to associate the config with"
    )


class TTSConfigUpdate(BaseModel):
    """Schema for updating an existing TTSConfig. All fields optional."""

    name: str | None = Field(None, max_length=100)
    description: str | None = Field(None, max_length=500)
    provider: TTSProvider | None = None
    custom_provider: str | None = Field(None, max_length=100)
    model_name: str | None = Field(None, max_length=100)
    api_key: str | None = None
    api_base: str | None = Field(None, max_length=500)
    litellm_params: dict[str, Any] | None = None


class TTSConfigRead(TTSConfigBase):
    """Schema for reading a TTSConfig (includes id and timestamps)."""

    id: int
    created_at: datetime
    search_space_id: int
    user_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Global TTS Config (from YAML)
# =============================================================================


class GlobalTTSConfigRead(BaseModel):
    """
    Schema for reading global TTS configs from YAML.
    Global configs have negative IDs. API key is hidden.
    Auto mode (ID 0) uses LiteLLM Router for load balancing.
    """

    id: int = Field(
        ...,
        description="Config ID: 0 for Auto mode, negative for global configs",
    )
    name: str
    description: str | None = None
    provider: str
    model_name: str
    api_base: str | None = None
    litellm_params: dict[str, Any] | None = None
    is_global: bool = True
    is_auto_mode: bool = False
