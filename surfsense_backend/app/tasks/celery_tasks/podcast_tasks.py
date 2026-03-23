"""Celery tasks for podcast generation."""

import asyncio
import logging
import sys
from typing import Optional

from sqlalchemy import select

from app.agents.podcaster.graph import graph as podcaster_graph
from app.agents.podcaster.models import SpeakerProfile
from app.agents.podcaster.state import State as PodcasterState
from app.celery_app import celery_app
from app.config import config
from app.db import (
    Podcast,
    PodcastEpisodeProfile,
    PodcastSpeakerProfile,
    PodcastStatus,
    SearchSpace,
    TTSConfig,
    VoiceProfile,
)
from app.tasks.celery_tasks import get_celery_session_maker

logger = logging.getLogger(__name__)

if sys.platform.startswith("win"):
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except AttributeError:
        logger.warning(
            "WindowsProactorEventLoopPolicy is unavailable; async subprocess support may fail."
        )


# =============================================================================
# Content-based podcast generation (for new-chat)
# =============================================================================


def _clear_generating_podcast(search_space_id: int) -> None:
    """Clear the generating podcast marker from Redis when task completes."""
    import redis

    try:
        client = redis.from_url(config.REDIS_APP_URL, decode_responses=True)
        key = f"podcast:generating:{search_space_id}"
        client.delete(key)
        logger.info(
            f"Cleared generating podcast key for search_space_id={search_space_id}"
        )
    except Exception as e:
        logger.warning(f"Could not clear generating podcast key: {e}")


@celery_app.task(name="generate_content_podcast", bind=True)
def generate_content_podcast_task(
    self,
    podcast_id: int,
    source_content: str,
    search_space_id: int,
    user_prompt: str | None = None,
    speaker_profile_id: Optional[int] = None,
    episode_profile_id: Optional[int] = None,
) -> dict:
    """
    Celery task to generate podcast from source content.
    Updates existing podcast record created by the tool.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        result = loop.run_until_complete(
            _generate_content_podcast(
                podcast_id,
                source_content,
                search_space_id,
                user_prompt,
                speaker_profile_id,
                episode_profile_id,
            )
        )
        loop.run_until_complete(loop.shutdown_asyncgens())
        return result
    except Exception as e:
        logger.error(f"Error generating content podcast: {e!s}")
        loop.run_until_complete(_mark_podcast_failed(podcast_id))
        return {"status": "failed", "podcast_id": podcast_id}
    finally:
        _clear_generating_podcast(search_space_id)
        asyncio.set_event_loop(None)
        loop.close()


async def _mark_podcast_failed(podcast_id: int) -> None:
    """Mark a podcast as failed in the database."""
    async with get_celery_session_maker()() as session:
        try:
            result = await session.execute(
                select(Podcast).filter(Podcast.id == podcast_id)
            )
            podcast = result.scalars().first()
            if podcast:
                podcast.status = PodcastStatus.FAILED
                await session.commit()
        except Exception as e:
            logger.error(f"Failed to mark podcast as failed: {e}")


async def _load_profiles(
    session,
    speaker_profile_id: Optional[int],
    episode_profile_id: Optional[int],
) -> tuple[Optional[SpeakerProfile], Optional[object], bool]:
    """Load speaker/episode profiles from DB. Returns (SpeakerProfile, episode_row, use_legacy)."""
    speaker_profile = None
    episode_row = None

    if speaker_profile_id:
        result = await session.execute(
            select(PodcastSpeakerProfile).filter(
                PodcastSpeakerProfile.id == speaker_profile_id
            )
        )
        sp_row = result.scalars().first()
        if sp_row:
            speaker_profile = SpeakerProfile(
                tts_provider=sp_row.tts_provider or "",
                tts_model=sp_row.tts_model or "",
                speakers=sp_row.speakers or [],
            )

    if episode_profile_id:
        result = await session.execute(
            select(PodcastEpisodeProfile).filter(
                PodcastEpisodeProfile.id == episode_profile_id
            )
        )
        episode_row = result.scalars().first()

        # If episode has a speaker_profile_id and we don't have one yet, load it
        if episode_row and episode_row.speaker_profile_id and not speaker_profile:
            result = await session.execute(
                select(PodcastSpeakerProfile).filter(
                    PodcastSpeakerProfile.id == episode_row.speaker_profile_id
                )
            )
            sp_row = result.scalars().first()
            if sp_row:
                speaker_profile = SpeakerProfile(
                    tts_provider=sp_row.tts_provider or "",
                    tts_model=sp_row.tts_model or "",
                    speakers=sp_row.speakers or [],
                )

    use_legacy = speaker_profile is None
    return speaker_profile, episode_row, use_legacy


async def _load_voice_profiles_map(
    session, speaker_profile: Optional[SpeakerProfile]
) -> Optional[dict[int, dict]]:
    """Load voice profiles referenced by speakers into a lookup map."""
    if not speaker_profile:
        return None

    profile_ids = [
        s.voice_profile_id
        for s in speaker_profile.speakers
        if s.voice_profile_id
    ]
    if not profile_ids:
        return None

    result = await session.execute(
        select(VoiceProfile).filter(VoiceProfile.id.in_(profile_ids))
    )
    rows = result.scalars().all()
    return {
        row.id: {
            "voice_type": row.voice_type.value if row.voice_type else None,
            "preset_voice_id": row.preset_voice_id,
            "design_instructions": row.design_instructions,
            "clone_profile_id": row.clone_profile_id,
            "clone_ref_text": row.clone_ref_text,
            "style_instructions": row.style_instructions,
            "language": row.language,
        }
        for row in rows
    }


_TTS_PROVIDER_TO_LITELLM = {
    "OPENAI": "openai",
    "AZURE": "azure",
    "VERTEX_AI": "vertex_ai",
}


async def _load_search_space_tts_config(
    session, search_space_id: int
) -> Optional[dict]:
    """Load the TTSConfig assigned to a search space, if any.

    Supports:
    - ID 0: Auto mode (uses TTS Router for load balancing)
    - Negative IDs: Global YAML configs
    - Positive IDs: DB TTSConfig
    """
    result = await session.execute(
        select(SearchSpace).filter(SearchSpace.id == search_space_id)
    )
    search_space = result.scalars().first()
    if not search_space or search_space.tts_config_id is None:
        return None

    tts_config_id = search_space.tts_config_id

    # Auto mode (ID 0) — use TTS Router
    if tts_config_id == 0:
        return {"is_auto_mode": True}

    # Global config (negative ID) — read from YAML
    if tts_config_id < 0:
        for cfg in config.GLOBAL_TTS_CONFIGS:
            if cfg.get("id") == tts_config_id:
                return {
                    "provider_string": cfg.get("model_name", ""),
                    "api_base": cfg.get("api_base") or None,
                    "api_key": cfg.get("api_key") or None,
                }
        return None

    # DB config (positive ID)
    result = await session.execute(
        select(TTSConfig).filter(TTSConfig.id == tts_config_id)
    )
    tts_cfg = result.scalars().first()
    if not tts_cfg:
        return None

    provider_str = _TTS_PROVIDER_TO_LITELLM.get(
        tts_cfg.provider.value if tts_cfg.provider else "", ""
    )
    model_string = f"{provider_str}/{tts_cfg.model_name}" if provider_str else tts_cfg.model_name

    return {
        "provider_string": model_string,
        "api_base": tts_cfg.api_base,
        "api_key": tts_cfg.api_key,
    }


async def _generate_content_podcast(
    podcast_id: int,
    source_content: str,
    search_space_id: int,
    user_prompt: str | None = None,
    speaker_profile_id: Optional[int] = None,
    episode_profile_id: Optional[int] = None,
) -> dict:
    """Generate content-based podcast and update existing record."""
    async with get_celery_session_maker()() as session:
        result = await session.execute(select(Podcast).filter(Podcast.id == podcast_id))
        podcast = result.scalars().first()

        if not podcast:
            raise ValueError(f"Podcast {podcast_id} not found")

        try:
            podcast.status = PodcastStatus.GENERATING
            await session.commit()

            # Load profiles if provided
            speaker_profile, episode_row, use_legacy = await _load_profiles(
                session, speaker_profile_id, episode_profile_id
            )

            # Determine settings from episode profile or defaults
            num_segments = 3
            language = "en"
            briefing = ""

            if episode_row:
                num_segments = episode_row.num_segments or 3
                language = episode_row.language or "en"
                briefing = episode_row.default_briefing or ""

            # Load TTS config from search space
            search_space_tts_config = await _load_search_space_tts_config(
                session, search_space_id
            )

            graph_config = {
                "configurable": {
                    "podcast_title": podcast.title,
                    "search_space_id": search_space_id,
                    "user_prompt": user_prompt,
                    "speaker_profile_id": speaker_profile_id,
                    "episode_profile_id": episode_profile_id,
                    "num_speakers": len(speaker_profile.speakers) if speaker_profile else 2,
                    "language": language,
                }
            }

            voice_profiles_map = await _load_voice_profiles_map(
                session, speaker_profile
            )

            initial_state = PodcasterState(
                source_content=source_content,
                db_session=session,
                use_legacy_pipeline=use_legacy,
                briefing=briefing,
                num_segments=num_segments,
                language=language,
                speaker_profile=speaker_profile,
                search_space_tts_config=search_space_tts_config,
                voice_profiles_map=voice_profiles_map,
            )

            graph_result = await podcaster_graph.ainvoke(
                initial_state, config=graph_config
            )

            podcast_transcript = graph_result.get("podcast_transcript", [])
            file_path = graph_result.get("final_podcast_file_path", "")

            # Serialize transcript (handles both legacy and new format)
            serializable_transcript = []
            for entry in podcast_transcript:
                if hasattr(entry, "speaker_id"):
                    serializable_transcript.append(
                        {"speaker_id": entry.speaker_id, "dialog": entry.dialog}
                    )
                elif isinstance(entry, dict):
                    serializable_transcript.append(entry)
                else:
                    serializable_transcript.append(
                        {"speaker": str(entry), "dialogue": ""}
                    )

            podcast.podcast_transcript = serializable_transcript
            podcast.file_location = file_path
            podcast.status = PodcastStatus.READY

            # Save new pipeline metadata
            if not use_legacy:
                outline = graph_result.get("outline")
                if outline and hasattr(outline, "model_dump"):
                    podcast.outline = outline.model_dump()
                elif outline and isinstance(outline, dict):
                    podcast.outline = outline
                podcast.num_speakers = len(speaker_profile.speakers) if speaker_profile else 2
                podcast.language = language
                podcast.speaker_profile_id = speaker_profile_id
                podcast.episode_profile_id = episode_profile_id

            await session.commit()

            logger.info(f"Successfully generated podcast: {podcast.id}")

            return {
                "status": "ready",
                "podcast_id": podcast.id,
                "title": podcast.title,
                "transcript_entries": len(serializable_transcript),
            }

        except Exception as e:
            logger.error(f"Error in _generate_content_podcast: {e!s}")
            podcast.status = PodcastStatus.FAILED
            await session.commit()
            raise
