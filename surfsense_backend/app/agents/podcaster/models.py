"""Domain models for multi-speaker podcast generation pipeline."""

import re
from typing import Any, Dict, List, Literal, Optional

from langchain_core.output_parsers.pydantic import PydanticOutputParser
from pydantic import BaseModel, Field, field_validator

# Compile regex pattern once for better performance
THINK_PATTERN = re.compile(r"<think>(.*?)</think>", re.DOTALL)

# Language map (no pycountry dependency)
LANGUAGE_MAP: dict[str, str] = {
    "en": "English",
    "es": "Spanish",
    "pt": "Portuguese",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "nl": "Dutch",
    "pl": "Polish",
    "ru": "Russian",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
    "ar": "Arabic",
    "hi": "Hindi",
    "tr": "Turkish",
    "sv": "Swedish",
    "da": "Danish",
    "fi": "Finnish",
    "no": "Norwegian",
    "uk": "Ukrainian",
}


def resolve_language_name(code: str) -> str:
    """Resolve a language code (ISO 639-1 or BCP 47) to its full English name."""
    if not code or not code.strip():
        raise ValueError("Language code cannot be empty")
    base = code.strip().split("-")[0].lower()
    name = LANGUAGE_MAP.get(base)
    if name is None:
        raise ValueError(
            f"Unsupported language code: '{code}'. "
            f"Supported: {', '.join(sorted(LANGUAGE_MAP.keys()))}"
        )
    return name


# ---------------------------------------------------------------------------
# Speaker / Profile models
# ---------------------------------------------------------------------------


class Speaker(BaseModel):
    """Individual speaker in a podcast."""

    name: str = Field(..., description="Speaker's display name")
    voice_id: str = Field(..., description="Voice ID for TTS generation")
    backstory: str = Field(..., description="Speaker's background and expertise")
    personality: str = Field(..., description="Speaking style and personality traits")
    tts_provider: Optional[str] = Field(
        None, description="Override TTS provider for this speaker"
    )
    tts_model: Optional[str] = Field(
        None, description="Override TTS model for this speaker"
    )
    tts_config: Optional[Dict[str, Any]] = Field(
        None, description="Override TTS config (e.g. api_base) for this speaker"
    )
    voice_profile_id: Optional[int] = Field(
        None, description="Reference to a voice profile in the voice library"
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or len(v.strip()) == 0:
            raise ValueError("Speaker name cannot be empty")
        return v.strip()


class SpeakerProfile(BaseModel):
    """Collection of 1-4 speakers with shared TTS defaults."""

    tts_provider: str = Field(..., description="Default TTS provider")
    tts_model: str = Field(..., description="Default TTS model")
    speakers: List[Speaker] = Field(..., description="List of speakers")

    @field_validator("speakers")
    @classmethod
    def validate_speakers(cls, v: list[Speaker]) -> list[Speaker]:
        if len(v) < 1 or len(v) > 4:
            raise ValueError("Must have between 1 and 4 speakers")
        names = [s.name for s in v]
        if len(names) != len(set(names)):
            raise ValueError("Speaker names must be unique")
        # Only enforce unique voice_ids when no voice profiles are used
        # (voice profiles can share the same voice_id like "voice_design")
        speakers_without_profiles = [s for s in v if not s.voice_profile_id]
        if speakers_without_profiles:
            voice_ids = [s.voice_id for s in speakers_without_profiles]
            if len(voice_ids) != len(set(voice_ids)):
                raise ValueError("Voice IDs must be unique")
        return v

    def get_speaker_names(self) -> List[str]:
        return [s.name for s in self.speakers]

    def get_voice_mapping(self) -> Dict[str, str]:
        return {s.name: s.voice_id for s in self.speakers}

    def get_speaker_by_name(self, name: str) -> Speaker:
        for s in self.speakers:
            if s.name == name:
                return s
        raise ValueError(f"Speaker '{name}' not found in profile")


# ---------------------------------------------------------------------------
# Outline / Transcript models
# ---------------------------------------------------------------------------


class Segment(BaseModel):
    name: str = Field(..., description="Name of the segment")
    description: str = Field(..., description="Description of the segment")
    size: Literal["short", "medium", "long"] = Field(
        default="medium", description="Size of the segment"
    )


class Outline(BaseModel):
    segments: list[Segment] = Field(..., description="List of segments")


class Dialogue(BaseModel):
    speaker: str = Field(..., description="Speaker name")
    dialogue: str = Field(..., description="Dialogue text")

    @field_validator("speaker")
    @classmethod
    def validate_speaker_name(cls, v: str) -> str:
        if not v or len(v.strip()) == 0:
            raise ValueError("Speaker name cannot be empty")
        return v.strip()


class Transcript(BaseModel):
    transcript: list[Dialogue] = Field(..., description="Transcript entries")


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------

outline_parser = PydanticOutputParser(pydantic_object=Outline)


def create_validated_transcript_parser(
    valid_speaker_names: List[str],
) -> PydanticOutputParser:
    """Create a transcript parser that validates speaker names against a whitelist."""

    class ValidatedDialogue(BaseModel):
        speaker: str = Field(..., description="Speaker name")
        dialogue: str = Field(..., description="Dialogue")

        @field_validator("speaker")
        @classmethod
        def validate_speaker_name(cls, v: str) -> str:
            if not v or len(v.strip()) == 0:
                raise ValueError("Speaker name cannot be empty")
            cleaned = v.strip()
            if cleaned not in valid_speaker_names:
                raise ValueError(
                    f"Invalid speaker name '{cleaned}'. "
                    f"Must be one of: {', '.join(valid_speaker_names)}"
                )
            return cleaned

    class ValidatedTranscript(BaseModel):
        transcript: list[ValidatedDialogue] = Field(..., description="Transcript")

    return PydanticOutputParser(pydantic_object=ValidatedTranscript)


# ---------------------------------------------------------------------------
# Helpers for LLM response cleaning
# ---------------------------------------------------------------------------


def clean_thinking_content(content: str) -> str:
    """Remove <think> blocks from AI responses."""
    if not isinstance(content, str) or len(content) > 100_000:
        return content if isinstance(content, str) else str(content or "")
    cleaned = THINK_PATTERN.sub("", content)
    if "<think>" in cleaned:
        idx = cleaned.index("<think>")
        cleaned = cleaned[:idx]
    return re.sub(r"\n\s*\n\s*\n", "\n\n", cleaned).strip()


def extract_text_content(content) -> str:
    """Normalize AIMessage content (handles list-of-dicts from Gemini/DeepSeek)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, dict) and "text" in part:
                parts.append(part["text"])
            elif isinstance(part, str):
                parts.append(part)
        return "".join(parts)
    if content is None:
        return ""
    return str(content)
