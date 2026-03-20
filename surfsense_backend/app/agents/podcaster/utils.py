from typing import Any, Optional

from .models import Speaker, SpeakerProfile


def resolve_speaker_voice(
    speaker: Speaker,
    profile: SpeakerProfile,
    global_tts_service: str,
    global_tts_api_base: Optional[str] = None,
    global_tts_api_key: Optional[str] = None,
    search_space_tts_config: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Resolve TTS parameters for a specific speaker using 4-level fallback:
      1. Speaker-level override
      2. Profile-level default
      3. Search Space TTSConfig (from DB)
      4. Global env config

    Returns dict with keys: provider, voice, api_base, api_key
    """
    ss_provider = search_space_tts_config.get("provider_string") if search_space_tts_config else None

    # Provider
    provider = speaker.tts_provider or profile.tts_provider or ss_provider or global_tts_service

    # Voice ID always comes from the speaker
    voice = speaker.voice_id

    # API base: speaker config → search space config → global
    api_base = None
    if speaker.tts_config and speaker.tts_config.get("api_base"):
        api_base = speaker.tts_config["api_base"]
    elif search_space_tts_config and search_space_tts_config.get("api_base"):
        api_base = search_space_tts_config["api_base"]
    elif global_tts_api_base:
        api_base = global_tts_api_base

    # API key: speaker config → search space config → global
    api_key = None
    if speaker.tts_config and speaker.tts_config.get("api_key"):
        api_key = speaker.tts_config["api_key"]
    elif search_space_tts_config and search_space_tts_config.get("api_key"):
        api_key = search_space_tts_config["api_key"]
    elif global_tts_api_key:
        api_key = global_tts_api_key

    return {
        "provider": provider,
        "voice": voice,
        "api_base": api_base,
        "api_key": api_key,
    }


def get_voice_for_provider(provider: str, speaker_id: int) -> dict | str:
    """
    Get the appropriate voice configuration based on the TTS provider and speaker ID.

    Args:
        provider: The TTS provider (e.g., "openai/tts-1", "vertex_ai/test")
        speaker_id: The ID of the speaker (0-5)

    Returns:
        Voice configuration - string for OpenAI, dict for Vertex AI
    """
    if provider == "local/kokoro":
        # Kokoro voice mapping - https://huggingface.co/hexgrad/Kokoro-82M/tree/main/voices
        kokoro_voices = {
            0: "am_adam",  # Default/intro voice
            1: "af_bella",  # First speaker
        }
        return kokoro_voices.get(speaker_id, "af_heart")

    # Extract provider type from the model string
    provider_type = (
        provider.split("/")[0].lower() if "/" in provider else provider.lower()
    )

    if provider_type == "openai":
        # OpenAI voice mapping - simple string values
        openai_voices = {
            0: "alloy",  # Default/intro voice
            1: "echo",  # First speaker
            2: "fable",  # Second speaker
            3: "onyx",  # Third speaker
            4: "nova",  # Fourth speaker
            5: "shimmer",  # Fifth speaker
        }
        return openai_voices.get(speaker_id, "alloy")

    elif provider_type == "vertex_ai":
        # Vertex AI voice mapping - dict with languageCode and name
        vertex_voices = {
            0: {
                "languageCode": "en-US",
                "name": "en-US-Studio-O",
            },
            1: {
                "languageCode": "en-US",
                "name": "en-US-Studio-M",
            },
            2: {
                "languageCode": "en-UK",
                "name": "en-UK-Studio-A",
            },
            3: {
                "languageCode": "en-UK",
                "name": "en-UK-Studio-B",
            },
            4: {
                "languageCode": "en-AU",
                "name": "en-AU-Studio-A",
            },
            5: {
                "languageCode": "en-AU",
                "name": "en-AU-Studio-B",
            },
        }
        return vertex_voices.get(speaker_id, vertex_voices[0])
    elif provider_type == "azure":
        # OpenAI voice mapping - simple string values
        azure_voices = {
            0: "alloy",  # Default/intro voice
            1: "echo",  # First speaker
            2: "fable",  # Second speaker
            3: "onyx",  # Third speaker
            4: "nova",  # Fourth speaker
            5: "shimmer",  # Fifth speaker
        }
        return azure_voices.get(speaker_id, "alloy")

    else:
        # Default fallback to OpenAI format for unknown providers
        default_voices = {
            0: {},
            1: {},
        }
        return default_voices.get(speaker_id, default_voices[0])
