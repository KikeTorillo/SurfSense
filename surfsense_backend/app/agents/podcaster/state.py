"""Define the state structures for the agent."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Dialogue, Outline, SpeakerProfile


class PodcastTranscriptEntry(BaseModel):
    """
    Represents a single entry in a podcast transcript.
    """

    speaker_id: int = Field(..., description="The ID of the speaker (0 or 1)")
    dialog: str = Field(..., description="The dialog text spoken by the speaker")


class PodcastTranscripts(BaseModel):
    """
    Represents the full podcast transcript structure.
    """

    podcast_transcripts: list[PodcastTranscriptEntry] = Field(
        ..., description="List of transcript entries with alternating speakers"
    )


@dataclass
class State:
    """Defines the input state for the agent.

    See: https://langchain-ai.github.io/langgraph/concepts/low_level/#state
    """

    # Runtime context
    db_session: AsyncSession
    source_content: str

    # Legacy pipeline fields
    podcast_transcript: list[PodcastTranscriptEntry] | None = None
    final_podcast_file_path: str | None = None

    # New multi-speaker pipeline fields
    use_legacy_pipeline: bool = True
    briefing: str = ""
    num_segments: int = 3
    language: Optional[str] = None
    speaker_profile: Optional[SpeakerProfile] = None
    outline: Optional[Outline] = None
    transcript: list[Dialogue] = field(default_factory=list)
    audio_clips: list[str] = field(default_factory=list)
