# Podcast Module Audit — Gap Analysis

## SurfSense Podcaster

### Architecture
- **Pipeline**: 2-node linear LangGraph (`create_podcast_transcript` → `create_merged_podcast_audio`)
- **Transcript generation**: Single LLM call with system prompt + source content → JSON `PodcastTranscripts`
- **Audio generation**: Concurrent TTS for all segments via `asyncio.gather()`, then FFmpeg concat to single MP3

### Key Files
| File | Purpose |
|------|---------|
| `agents/podcaster/graph.py` | LangGraph definition (2 nodes, linear) |
| `agents/podcaster/nodes.py` | Transcript generation + TTS dispatch + FFmpeg merge |
| `agents/podcaster/state.py` | `PodcastTranscriptEntry(speaker_id, dialog)` |
| `agents/podcaster/prompts.py` | System prompt, hardcoded for 2 speakers |
| `agents/podcaster/utils.py` | Voice mapping per provider (speaker_id → voice) |
| `agents/podcaster/configuration.py` | `Configuration(podcast_title, search_space_id, user_prompt)` |
| `services/kokoro_tts_service.py` | Local Kokoro TTS, WAV 24kHz, singleton pattern |
| `routes/podcasts_routes.py` | GET list, GET by id, DELETE, GET stream (no POST/create) |

### Speakers
- **Hardcoded 2 speakers**: speaker_id 0 (Lead Host) and 1 (Co-Host/Expert)
- Prompt explicitly says "two distinct podcast hosts"
- Hardcoded intro: "Welcome to Surfsense Podcast." (speaker 1)
- Voice maps: Kokoro has 2 entries; OpenAI/Vertex/Azure have 6 but only 2 used

### TTS Providers
| Provider | Dispatch | Voice format | Output |
|----------|----------|-------------|--------|
| `local/kokoro` | `KokoroTTSService.generate_speech()` | String (`"am_adam"`) | WAV 24kHz |
| `openai/*` | `litellm.aspeech()` | String (`"alloy"`) | MP3 |
| `vertex_ai/*` | `litellm.aspeech()` | Dict (languageCode + name) | MP3 |
| `azure/*` | `litellm.aspeech()` | String | MP3 |
| Fallback | `litellm.aspeech()` | Empty dict (will likely fail) | MP3 |

### Limitations
1. 2 speakers only (hardcoded in prompt, state, voice maps)
2. No speaker personality/backstory customization
3. Target duration hardcoded (~6 min / ~1000 words)
4. Kokoro language hardcoded to American English (`"a"`)
5. No retry/error recovery per segment
6. `podcast_title` in config is unused
7. DELETE doesn't remove audio files from disk
8. No POST endpoint for creation (triggered elsewhere)

---

## Open Notebook + podcast-creator

### Architecture
- **Pipeline**: 4-stage LangGraph (`generate_outline` → `generate_transcript` → `generate_all_audio` → `combine_audio`)
- **Outline stage**: LLM generates structured outline with configurable segments (1-10)
- **Transcript stage**: Per-segment LLM calls with accumulated context, validated speaker names
- **Audio stage**: Sequential batches (configurable `TTS_BATCH_SIZE`), concurrent within batch
- **Combine stage**: moviepy concatenation

### Key Data Structures
| Structure | Location | Purpose |
|-----------|----------|---------|
| `Speaker` | podcast-creator `speakers.py` | name, voice_id, backstory, personality, per-speaker TTS overrides |
| `SpeakerProfile` | podcast-creator `speakers.py` | 1-4 speakers + shared TTS config, validates uniqueness |
| `EpisodeProfile` | podcast-creator `episodes.py` | outline/transcript provider+model, num_segments, language, default_briefing |
| `SpeakerProfile` (DB) | Open Notebook `podcasts/models.py` | DB-persisted, references Model registry via record IDs |
| `EpisodeProfile` (DB) | Open Notebook `podcasts/models.py` | DB-persisted, 3-20 segments, references Model registry |
| `PodcastEpisode` (DB) | Open Notebook `podcasts/models.py` | Episode record with audio_file, transcript, outline |

### Speakers
- **1-4 speakers** per profile (validated)
- Each speaker has: name, voice_id, backstory, personality
- Per-speaker TTS overrides (provider, model, config)
- Voice ID uniqueness enforced within profile

### TTS Providers
- **ElevenLabs**: 5 models (eleven_multilingual_v2, eleven_turbo_v2_5, etc.)
- **OpenAI**: Models with `tts` prefix
- **Google**: Default test voice "Kore"
- **Azure**: Default test voice "alloy"
- **Vertex**: Default test voice "Kore"
- **OpenAI-compatible**: Any compatible endpoint
- All via `AIFactory.create_text_to_speech()` from Esperanto library

### Model Discovery
- 12 provider-specific discovery functions
- API-based: OpenAI, Google, Ollama, Groq, Mistral, DeepSeek, xAI, OpenRouter, OpenAI-compatible
- Static lists: Anthropic, Voyage, ElevenLabs
- Auto-classifies models by type (language/embedding/TTS/STT)
- Syncs discovered models to DB

### Integration Pattern
Open Notebook acts as a credential/model registry bridge:
1. Loads profiles from SurrealDB
2. Resolves model record IDs to (provider, model_name, config) tuples
3. Injects resolved config into podcast-creator's ConfigurationManager
4. Calls `create_podcast()` with profile references
5. Persists result as `PodcastEpisode` record

---

## Gap Analysis

| Feature | SurfSense | Open Notebook | Gap |
|---------|-----------|---------------|-----|
| Number of speakers | 2 (hardcoded) | 1-4 (configurable) | Must extend prompt, state, voice maps |
| Speaker personality | None | backstory, personality per speaker | Add fields to prompt template |
| Pipeline stages | 2 (transcript→audio) | 4 (outline→transcript→audio→combine) | Consider adding outline stage |
| Transcript quality | Single LLM call | Per-segment with accumulated context | Significant quality improvement |
| TTS providers | Kokoro, LiteLLM (OpenAI/Vertex/Azure) | ElevenLabs, OpenAI, Google, Azure, Vertex, OpenAI-compat | Add ElevenLabs SDK |
| Per-speaker TTS | No (global provider) | Yes (per-speaker override) | Extend dispatch logic |
| Model discovery | None (manual config) | 12-provider auto-discovery | Port from Open Notebook |
| Error handling | No retry | Tenacity with exponential backoff | Add retry mechanism |
| Audio combine | FFmpeg async | moviepy | Keep FFmpeg (more robust) |
| Segment sizing | Fixed ~6 min | Configurable (short/medium/long turns) | Parameterize |
| Language support | English only (Kokoro) | Multi-language | Parameterize lang_code |
| DB storage | PostgreSQL (podcasts table) | SurrealDB | Keep PostgreSQL |

## Strategy: Extend SurfSense, Don't Replace

**Rationale**: SurfSense has the infrastructure (PostgreSQL, RBAC, Docker, LangGraph, async FFmpeg), and its podcaster module is well-structured but limited. Rather than importing podcast-creator as a dependency (which would introduce Esperanto/SurrealDB/moviepy deps and version conflicts with langchain/langgraph), we should:

1. **Extend the existing `podcaster/` agent** with multi-speaker support (1-4)
2. **Port the outline → transcript pipeline** from podcast-creator (better quality)
3. **Add speaker profiles** as PostgreSQL tables (not SurrealDB)
4. **Add ElevenLabs SDK** as a new TTS service alongside Kokoro and LiteLLM
5. **Port model discovery concept** adapted to SurfSense's config model
6. **Keep FFmpeg** for audio combining (already async, no moviepy needed)
