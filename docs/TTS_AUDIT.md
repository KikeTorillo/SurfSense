# TTS Service Audit

## SurfSense TTS Architecture

### Current Implementation
- **Dispatch point**: `agents/podcaster/nodes.py` (lines 145-181)
- **Config**: `TTS_SERVICE` env var determines global provider
- **Service role**: env var → dispatch at runtime in `create_merged_podcast_audio` node

### Provider: local/kokoro
- **File**: `services/kokoro_tts_service.py`
- **Engine**: `kokoro` Python package with `KPipeline`
- **Output**: WAV 24kHz, mono
- **Languages**: 9 supported (American English, British English, Spanish, French, Hindi, Italian, Japanese, Brazilian Portuguese, Mandarin Chinese)
- **Limitation**: Language hardcoded to `"a"` (American English) in nodes.py
- **Pattern**: Global singleton, recreated on lang_code change
- **Threading**: Sync inference wrapped in `run_in_executor` for async compatibility
- **Voices**: 2 mapped (speaker 0 → `"am_adam"`, speaker 1 → `"af_bella"`)

### Provider: LiteLLM (openai/*, vertex_ai/*, azure/*)
- **Engine**: `litellm.aspeech()` remote API calls
- **Output**: MP3
- **Config**: `TTS_SERVICE_API_KEY` and optional `TTS_SERVICE_API_BASE`
- **Voices**: Up to 6 mapped per provider (only 2 used due to 2-speaker limit)
  - OpenAI: alloy, echo, fable, onyx, nova, shimmer
  - Vertex: Kore, Charon, Puck, Fenrir, Leda, Orus (with en-US languageCode)
  - Azure: same as OpenAI

### Voice Mapping (utils.py)
```python
# Current structure (simplified)
def get_voice_for_provider(provider: str, speaker_id: int) -> voice:
    if "local/kokoro": return kokoro_voices[speaker_id]      # 2 voices
    elif "openai":     return openai_voices[speaker_id]       # 6 voices
    elif "vertex_ai":  return vertex_voices[speaker_id]       # 6 voices (dict format)
    elif "azure":      return azure_voices[speaker_id]        # 6 voices
    else:              return {}                              # fallback (broken)
```

---

## Open Notebook TTS Architecture

### Current Implementation
- **Dispatch**: Per-speaker, via `AIFactory.create_text_to_speech()` from Esperanto library
- **Config**: Model registry in SurrealDB → resolved at runtime to (provider, model_name, config)
- **Per-speaker override**: Each `Speaker` can have its own `tts_provider`, `tts_model`, `tts_config`

### Providers
| Provider | Models | Test Voice |
|----------|--------|------------|
| ElevenLabs | eleven_multilingual_v2, eleven_turbo_v2_5, eleven_turbo_v2, eleven_monolingual_v1, eleven_multilingual_v1 | (dynamic discovery) |
| OpenAI | tts-* models | alloy |
| Google | TTS models | Kore |
| Azure | TTS models | alloy |
| Vertex | TTS models | Kore |
| OpenAI-compatible | Any endpoint | alloy |

### Key Differences from SurfSense
1. **Per-speaker TTS**: Each speaker can use a different provider/model/voice
2. **Model registry**: Models discovered automatically, stored in DB
3. **Connection testing**: Validates provider connectivity before use
4. **ElevenLabs support**: Native SDK integration, voice discovery
5. **Esperanto abstraction**: Unified API across all providers

---

## Integration Plan

### Phase 1: Add ElevenLabs TTS Service

**New file**: `surfsense_backend/app/services/elevenlabs_tts_service.py`

```
class ElevenLabsTTSService:
    async def generate_speech(text, voice_id, model_id) -> bytes
    async def list_voices() -> list[Voice]
```

**Dependencies to add**: `elevenlabs` SDK to `pyproject.toml`

**Config**: New env vars:
- `ELEVENLABS_API_KEY`
- Default model: `eleven_multilingual_v2`

### Phase 2: Extend Voice Mapping for Multi-Speaker

**Modify**: `agents/podcaster/utils.py`
- Change from `speaker_id → voice` lookup to profile-based mapping
- Each speaker in a profile has their own `voice_id`
- Fallback to positional voice mapping for backwards compat

### Phase 3: Per-Speaker TTS Dispatch

**Modify**: `agents/podcaster/nodes.py`
- Instead of global `TTS_SERVICE`, resolve provider per speaker from profile
- Speaker profile stores: `(provider, model, voice_id, config)` per speaker
- Dispatch logic becomes: `resolve_tts_for_speaker(speaker) → generate_speech()`

### Dispatch Flow (After Integration)

```
Speaker Profile (DB)
  └─ Speaker 0: provider=elevenlabs, voice_id=abc123
  └─ Speaker 1: provider=local/kokoro, voice_id=am_adam
  └─ Speaker 2: provider=openai/tts-1, voice_id=alloy

Per segment:
  transcript_entry.speaker_id → speaker_profile.speakers[id]
    → resolve provider
    → dispatch to appropriate TTS service
    → return audio bytes
```

### Risk: Version Conflicts
- podcast-creator depends on `esperanto-ai` which brings its own langchain/langgraph versions
- **Decision**: Do NOT add podcast-creator as a dependency
- Instead: port the pipeline logic directly into SurfSense's existing LangGraph setup
- Add only `elevenlabs` SDK as a new dependency (lightweight, no conflicts)
