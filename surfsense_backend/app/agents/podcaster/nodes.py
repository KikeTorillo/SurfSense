import asyncio
import json
import logging
import os
import uuid
from pathlib import Path
from typing import Any

from ffmpeg.asyncio import FFmpeg
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from litellm import aspeech

from app.config import config as app_config
from app.services.kokoro_tts_service import get_kokoro_tts_service
from app.services.llm_service import get_agent_llm

from .configuration import Configuration
from .models import (
    Dialogue,
    Outline,
    clean_thinking_content,
    create_validated_transcript_parser,
    extract_text_content,
    outline_parser,
    resolve_language_name,
)
from .prompts import get_outline_prompt, get_podcast_generation_prompt, get_transcript_segment_prompt
from .state import PodcastTranscriptEntry, PodcastTranscripts, State
from .utils import get_voice_for_provider, resolve_speaker_voice

logger = logging.getLogger(__name__)


async def create_podcast_transcript(
    state: State, config: RunnableConfig
) -> dict[str, Any]:
    """Each node does work."""

    # Get configuration from runnable config
    configuration = Configuration.from_runnable_config(config)
    search_space_id = configuration.search_space_id
    user_prompt = configuration.user_prompt

    # Get search space's document summary LLM
    llm = await get_agent_llm(state.db_session, search_space_id)
    if not llm:
        error_message = (
            f"No document summary LLM configured for search space {search_space_id}"
        )
        print(error_message)
        raise RuntimeError(error_message)

    # Get the prompt
    prompt = get_podcast_generation_prompt(user_prompt)

    # Create the messages
    messages = [
        SystemMessage(content=prompt),
        HumanMessage(
            content=f"<source_content>{state.source_content}</source_content>"
        ),
    ]

    # Generate the podcast transcript
    llm_response = await llm.ainvoke(messages)

    # First try the direct approach
    try:
        podcast_transcript = PodcastTranscripts.model_validate(
            json.loads(llm_response.content)
        )
    except (json.JSONDecodeError, ValueError) as e:
        print(f"Direct JSON parsing failed, trying fallback approach: {e!s}")

        # Fallback: Parse the JSON response manually
        try:
            # Extract JSON content from the response
            content = llm_response.content

            # Find the JSON in the content (handle case where LLM might add additional text)
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                json_str = content[json_start:json_end]

                # Parse the JSON string
                parsed_data = json.loads(json_str)

                # Convert to Pydantic model
                podcast_transcript = PodcastTranscripts.model_validate(parsed_data)

                print("Successfully parsed podcast transcript using fallback approach")
            else:
                # If JSON structure not found, raise a clear error
                error_message = f"Could not find valid JSON in LLM response. Raw response: {content}"
                print(error_message)
                raise ValueError(error_message)

        except (json.JSONDecodeError, ValueError) as e2:
            # Log the error and re-raise it
            error_message = f"Error parsing LLM response (fallback also failed): {e2!s}"
            print(f"Error parsing LLM response: {e2!s}")
            print(f"Raw response: {llm_response.content}")
            raise

    return {"podcast_transcript": podcast_transcript.podcast_transcripts}


async def create_merged_podcast_audio(
    state: State, config: RunnableConfig
) -> dict[str, Any]:
    """Generate audio for each transcript and merge them into a single podcast file."""

    # configuration = Configuration.from_runnable_config(config)

    starting_transcript = PodcastTranscriptEntry(
        speaker_id=1, dialog="Welcome to Surfsense Podcast."
    )

    transcript = state.podcast_transcript

    # Merge the starting transcript with the podcast transcript
    # Check if transcript is a PodcastTranscripts object or already a list
    if hasattr(transcript, "podcast_transcripts"):
        transcript_entries = transcript.podcast_transcripts
    else:
        transcript_entries = transcript

    merged_transcript = [starting_transcript, *transcript_entries]

    # Create a temporary directory for audio files (use shared volume for Docker)
    shared_base = Path(os.environ.get("TMPDIR", "/shared_tmp"))
    temp_dir = shared_base / "temp_audio"
    temp_dir.mkdir(parents=True, exist_ok=True)

    # Generate a unique session ID for this podcast
    session_id = str(uuid.uuid4())
    podcast_dir = shared_base / "podcasts"
    podcast_dir.mkdir(parents=True, exist_ok=True)
    output_path = str(podcast_dir / f"{session_id}_podcast.mp3")

    # Resolve TTS config: search space config → env vars
    ss_tts = state.search_space_tts_config
    tts_service = (ss_tts.get("provider_string") if ss_tts else None) or app_config.TTS_SERVICE
    tts_api_base = (ss_tts.get("api_base") if ss_tts else None) or app_config.TTS_SERVICE_API_BASE
    tts_api_key = (ss_tts.get("api_key") if ss_tts else None) or app_config.TTS_SERVICE_API_KEY

    # Generate audio for each transcript segment
    audio_files = []

    async def generate_speech_for_segment(segment, index):
        # Handle both dictionary and PodcastTranscriptEntry objects
        if hasattr(segment, "speaker_id"):
            speaker_id = segment.speaker_id
            dialog = segment.dialog
        else:
            speaker_id = segment.get("speaker_id", 0)
            dialog = segment.get("dialog", "")

        # Select voice based on speaker_id
        voice = get_voice_for_provider(tts_service, speaker_id)

        # Generate a unique filename for this segment
        if tts_service == "local/kokoro":
            # Kokoro generates WAV files
            filename = f"{temp_dir}/{session_id}_{index}.wav"
        else:
            # Other services generate MP3 files
            filename = f"{temp_dir}/{session_id}_{index}.mp3"

        try:
            if tts_service == "local/kokoro":
                # Use Kokoro TTS service
                kokoro_service = await get_kokoro_tts_service(
                    lang_code="a"
                )  # American English
                audio_path = await kokoro_service.generate_speech(
                    text=dialog, voice=voice, speed=1.0, output_path=filename
                )
                return audio_path
            else:
                if tts_api_base:
                    response = await aspeech(
                        model=tts_service,
                        api_base=tts_api_base,
                        api_key=tts_api_key,
                        voice=voice,
                        input=dialog,
                        max_retries=2,
                        timeout=600,
                    )
                else:
                    response = await aspeech(
                        model=tts_service,
                        api_key=tts_api_key,
                        voice=voice,
                        input=dialog,
                        max_retries=2,
                        timeout=600,
                    )

                # Save the audio to a file - use proper streaming method
                with open(filename, "wb") as f:
                    f.write(response.content)

                return filename
        except Exception as e:
            print(f"Error generating speech for segment {index}: {e!s}")
            raise

    # Generate all audio files concurrently
    tasks = [
        generate_speech_for_segment(segment, i)
        for i, segment in enumerate(merged_transcript)
    ]
    audio_files = await asyncio.gather(*tasks)

    # Merge audio files using ffmpeg
    try:
        # Create FFmpeg instance with the first input
        ffmpeg = FFmpeg().option("y")

        # Add each audio file as input
        for audio_file in audio_files:
            ffmpeg = ffmpeg.input(audio_file)

        # Configure the concatenation and output
        filter_complex = []
        for i in range(len(audio_files)):
            filter_complex.append(f"[{i}:0]")

        filter_complex_str = (
            "".join(filter_complex) + f"concat=n={len(audio_files)}:v=0:a=1[outa]"
        )
        ffmpeg = ffmpeg.option("filter_complex", filter_complex_str)
        ffmpeg = ffmpeg.output(output_path, map="[outa]")

        # Execute FFmpeg
        await ffmpeg.execute()

        print(f"Successfully created podcast audio: {output_path}")

    except Exception as e:
        print(f"Error merging audio files: {e!s}")
        raise
    finally:
        # Clean up temporary files
        for audio_file in audio_files:
            try:
                os.remove(audio_file)
            except Exception as e:
                print(f"Error removing audio file {audio_file}: {e!s}")
                pass

    return {
        "podcast_transcript": merged_transcript,
        "final_podcast_file_path": output_path,
    }


# =============================================================================
# Pipeline routing
# =============================================================================


def route_pipeline(state: State) -> str:
    """Route to legacy or new pipeline based on state."""
    if state.use_legacy_pipeline:
        return "legacy"
    return "new"


# =============================================================================
# New multi-speaker pipeline nodes
# =============================================================================


SEGMENT_TURNS = {"short": 3, "medium": 6, "long": 10}


async def generate_outline(state: State, config: RunnableConfig) -> dict[str, Any]:
    """Generate a podcast outline from the source content using the LLM."""
    configuration = Configuration.from_runnable_config(config)
    search_space_id = configuration.search_space_id

    llm = await get_agent_llm(state.db_session, search_space_id)
    if not llm:
        raise RuntimeError(
            f"No LLM configured for search space {search_space_id}"
        )

    # Resolve language name for template
    language_name = None
    if state.language:
        try:
            language_name = resolve_language_name(state.language)
        except ValueError:
            language_name = None

    prompt = get_outline_prompt(
        briefing=state.briefing or f"Create an engaging podcast about the following content.",
        context=state.source_content,
        speakers=[s.model_dump() for s in state.speaker_profile.speakers],
        num_segments=state.num_segments,
        language=language_name,
    )

    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content=f"<source_content>{state.source_content}</source_content>"),
    ]

    response = await llm.ainvoke(messages)
    raw = extract_text_content(response.content)
    cleaned = clean_thinking_content(raw)

    # Parse outline JSON
    try:
        outline = outline_parser.parse(cleaned)
    except Exception:
        # Fallback: extract JSON manually
        json_start = cleaned.find("{")
        json_end = cleaned.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            outline = Outline.model_validate(json.loads(cleaned[json_start:json_end]))
        else:
            raise ValueError(f"Could not parse outline from LLM response: {cleaned[:200]}")

    logger.info(f"Generated outline with {len(outline.segments)} segments")
    return {"outline": outline}


async def generate_transcript(state: State, config: RunnableConfig) -> dict[str, Any]:
    """Generate transcript segment by segment, accumulating dialogue."""
    configuration = Configuration.from_runnable_config(config)
    search_space_id = configuration.search_space_id

    llm = await get_agent_llm(state.db_session, search_space_id)
    if not llm:
        raise RuntimeError(
            f"No LLM configured for search space {search_space_id}"
        )

    speaker_names = state.speaker_profile.get_speaker_names()
    parser = create_validated_transcript_parser(speaker_names)

    language_name = None
    if state.language:
        try:
            language_name = resolve_language_name(state.language)
        except ValueError:
            language_name = None

    accumulated: list[Dialogue] = []
    segments = state.outline.segments

    for idx, segment in enumerate(segments):
        is_final = idx == len(segments) - 1
        turns = SEGMENT_TURNS.get(segment.size, 6)

        prompt = get_transcript_segment_prompt(
            briefing=state.briefing or "Create an engaging podcast about the following content.",
            context=state.source_content,
            outline=state.outline,
            segment=segment.model_dump(),
            speakers=[s.model_dump() for s in state.speaker_profile.speakers],
            speaker_names=speaker_names,
            turns=turns,
            transcript=accumulated if accumulated else None,
            is_final=is_final,
            language=language_name,
        )

        messages = [
            SystemMessage(content=prompt),
            HumanMessage(content=f"Generate the transcript for segment: {segment.name}"),
        ]

        response = await llm.ainvoke(messages)
        raw = extract_text_content(response.content)
        cleaned = clean_thinking_content(raw)

        try:
            parsed = parser.parse(cleaned)
        except Exception:
            # Fallback: extract JSON manually
            json_start = cleaned.find("{")
            json_end = cleaned.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                data = json.loads(cleaned[json_start:json_end])
                segment_dialogues = [Dialogue(**d) for d in data.get("transcript", [])]
            else:
                raise ValueError(
                    f"Could not parse transcript for segment '{segment.name}': {cleaned[:200]}"
                )
        else:
            segment_dialogues = [
                Dialogue(speaker=d.speaker, dialogue=d.dialogue)
                for d in parsed.transcript
            ]

        accumulated.extend(segment_dialogues)
        logger.info(
            f"Segment '{segment.name}': {len(segment_dialogues)} dialogues "
            f"(total: {len(accumulated)})"
        )

    return {"transcript": accumulated}


async def generate_audio(state: State, config: RunnableConfig) -> dict[str, Any]:
    """Generate TTS audio for each dialogue entry with batched concurrency."""
    profile = state.speaker_profile
    session_id = str(uuid.uuid4())
    shared_base = Path(os.environ.get("TMPDIR", "/shared_tmp"))
    temp_dir = shared_base / "temp_audio"
    temp_dir.mkdir(parents=True, exist_ok=True)

    BATCH_SIZE = 5
    audio_clips: list[str] = []

    async def _tts_one(dialogue: Dialogue, index: int) -> str:
        """Generate TTS for a single dialogue entry."""
        speaker = profile.get_speaker_by_name(dialogue.speaker)
        voice_cfg = resolve_speaker_voice(
            speaker=speaker,
            profile=profile,
            global_tts_service=app_config.TTS_SERVICE or "openai/tts-1",
            global_tts_api_base=app_config.TTS_SERVICE_API_BASE,
            global_tts_api_key=app_config.TTS_SERVICE_API_KEY,
            search_space_tts_config=state.search_space_tts_config,
        )

        provider = voice_cfg["provider"]
        voice = voice_cfg["voice"]

        if provider == "local/kokoro":
            filename = f"{temp_dir}/{session_id}_{index:04d}.wav"
            kokoro_service = await get_kokoro_tts_service(lang_code="a")
            await kokoro_service.generate_speech(
                text=dialogue.dialogue, voice=voice, speed=1.0, output_path=filename
            )
            return filename

        filename = f"{temp_dir}/{session_id}_{index:04d}.mp3"
        kwargs: dict[str, Any] = {
            "model": provider,
            "voice": voice,
            "input": dialogue.dialogue,
            "max_retries": 2,
            "timeout": 600,
        }
        if voice_cfg["api_base"]:
            kwargs["api_base"] = voice_cfg["api_base"]
        if voice_cfg["api_key"]:
            kwargs["api_key"] = voice_cfg["api_key"]

        response = await aspeech(**kwargs)
        with open(filename, "wb") as f:
            f.write(response.content)
        return filename

    # Process in batches
    for batch_start in range(0, len(state.transcript), BATCH_SIZE):
        batch = state.transcript[batch_start : batch_start + BATCH_SIZE]
        tasks = [
            _tts_one(dialogue, batch_start + i)
            for i, dialogue in enumerate(batch)
        ]
        batch_results = await asyncio.gather(*tasks)
        audio_clips.extend(batch_results)

    logger.info(f"Generated {len(audio_clips)} audio clips")
    return {"audio_clips": audio_clips}


async def combine_audio(state: State, config: RunnableConfig) -> dict[str, Any]:
    """Concatenate audio clips into a single MP3 using FFmpeg."""
    session_id = str(uuid.uuid4())
    shared_base = Path(os.environ.get("TMPDIR", "/shared_tmp"))
    podcast_dir = shared_base / "podcasts"
    podcast_dir.mkdir(parents=True, exist_ok=True)
    output_path = str(podcast_dir / f"{session_id}_podcast.mp3")

    audio_files = state.audio_clips
    if not audio_files:
        raise ValueError("No audio clips to combine")

    try:
        ffmpeg = FFmpeg().option("y")
        for audio_file in audio_files:
            ffmpeg = ffmpeg.input(audio_file)

        filter_parts = [f"[{i}:0]" for i in range(len(audio_files))]
        filter_complex_str = (
            "".join(filter_parts) + f"concat=n={len(audio_files)}:v=0:a=1[outa]"
        )
        ffmpeg = ffmpeg.option("filter_complex", filter_complex_str)
        ffmpeg = ffmpeg.output(output_path, map="[outa]")
        await ffmpeg.execute()

        logger.info(f"Combined audio: {output_path}")
    except Exception as e:
        logger.error(f"Error merging audio files: {e!s}")
        raise
    finally:
        for f in audio_files:
            try:
                os.remove(f)
            except Exception:
                pass

    # Convert transcript to legacy-compatible format for DB storage
    serializable_transcript = [
        {"speaker": d.speaker, "dialogue": d.dialogue}
        for d in state.transcript
    ]

    return {
        "podcast_transcript": serializable_transcript,
        "final_podcast_file_path": output_path,
    }
