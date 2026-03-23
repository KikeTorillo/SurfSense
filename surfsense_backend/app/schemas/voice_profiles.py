"""Voice profile schemas for the voice library API."""

from datetime import datetime
from enum import StrEnum
from typing import Optional

from pydantic import BaseModel


class VoiceTypeEnum(StrEnum):
    PRESET = "preset"
    DESIGN = "design"
    CLONE = "clone"


class VoiceProfileCreate(BaseModel):
    name: str
    search_space_id: int
    voice_type: VoiceTypeEnum
    preset_voice_id: Optional[str] = None
    design_instructions: Optional[str] = None
    clone_ref_text: Optional[str] = None
    style_instructions: Optional[str] = None
    language: Optional[str] = None


class VoiceProfileUpdate(BaseModel):
    name: Optional[str] = None
    style_instructions: Optional[str] = None
    language: Optional[str] = None
    design_instructions: Optional[str] = None
    clone_ref_text: Optional[str] = None


class VoiceProfileRead(BaseModel):
    id: int
    name: str
    search_space_id: int
    voice_type: VoiceTypeEnum
    preset_voice_id: Optional[str] = None
    design_instructions: Optional[str] = None
    clone_profile_id: Optional[str] = None
    clone_ref_text: Optional[str] = None
    style_instructions: Optional[str] = None
    language: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class VoicePreviewRequest(BaseModel):
    text: str = "Hola, esta es una prueba de voz."
