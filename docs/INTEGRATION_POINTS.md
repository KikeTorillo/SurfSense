# Integration Points — SurfSense + Open Notebook Features

## Dependencies to Add

| Package | Version | Purpose | Risk |
|---------|---------|---------|------|
| `elevenlabs` | `>=1.0.0` | ElevenLabs TTS SDK | Low — standalone SDK, no langchain deps |

**NOT adding** (decision):
- `podcast-creator`: Would bring Esperanto, moviepy, and potential langchain/langgraph version conflicts
- `esperanto-ai`: SurrealDB dependency, alternative AI factory not needed
- `moviepy`: FFmpeg async already in SurfSense, more robust

## PostgreSQL Schema Changes

### New Table: `podcast_speaker_profiles`
```sql
CREATE TABLE podcast_speaker_profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    search_space_id INTEGER NOT NULL REFERENCES search_spaces(id) ON DELETE CASCADE,
    tts_provider VARCHAR(100),          -- default provider for profile
    tts_model VARCHAR(100),             -- default model for profile
    speakers JSONB NOT NULL DEFAULT '[]',
    -- speakers JSON structure:
    -- [
    --   {
    --     "name": "Dr. Sarah",
    --     "voice_id": "abc123",
    --     "backstory": "AI researcher...",
    --     "personality": "curious, analytical",
    --     "tts_provider": null,        -- per-speaker override (optional)
    --     "tts_model": null,           -- per-speaker override (optional)
    --     "tts_config": {}             -- per-speaker config (optional)
    --   }
    -- ]
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id)
);
```

### New Table: `podcast_episode_profiles`
```sql
CREATE TABLE podcast_episode_profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    search_space_id INTEGER NOT NULL REFERENCES search_spaces(id) ON DELETE CASCADE,
    speaker_profile_id INTEGER REFERENCES podcast_speaker_profiles(id),
    num_segments INTEGER DEFAULT 3 CHECK (num_segments BETWEEN 1 AND 10),
    language VARCHAR(10) DEFAULT 'en',
    default_briefing TEXT,
    outline_prompt TEXT,                -- custom outline prompt override
    transcript_prompt TEXT,             -- custom transcript prompt override
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id)
);
```

### Modify Existing: `podcasts` table
Add columns:
```sql
ALTER TABLE podcasts ADD COLUMN speaker_profile_id INTEGER REFERENCES podcast_speaker_profiles(id);
ALTER TABLE podcasts ADD COLUMN episode_profile_id INTEGER REFERENCES podcast_episode_profiles(id);
ALTER TABLE podcasts ADD COLUMN outline JSONB;            -- store generated outline
ALTER TABLE podcasts ADD COLUMN language VARCHAR(10);
ALTER TABLE podcasts ADD COLUMN num_speakers INTEGER DEFAULT 2;
```

## Backend Files to Modify (Phase 1)

### Podcaster Agent (extend existing)
| File | Changes |
|------|---------|
| `agents/podcaster/prompts.py` | Jinja2 templates replacing hardcoded prompt; support 1-4 speakers with personalities |
| `agents/podcaster/state.py` | Add `outline`, `speaker_profile`, `episode_profile` to State |
| `agents/podcaster/nodes.py` | Add `generate_outline` node; per-speaker TTS dispatch; parameterize intro |
| `agents/podcaster/graph.py` | 4-node pipeline: outline → transcript → audio → merge |
| `agents/podcaster/utils.py` | Profile-based voice resolution replacing positional mapping |
| `agents/podcaster/configuration.py` | Add `speaker_profile_id`, `episode_profile_id`, `language` |

### New Files
| File | Purpose |
|------|---------|
| `services/elevenlabs_tts_service.py` | ElevenLabs TTS service with async speech generation and voice listing |
| `models/podcast_speaker_profile.py` | SQLAlchemy model for speaker profiles |
| `models/podcast_episode_profile.py` | SQLAlchemy model for episode profiles |
| `routes/podcast_profiles_routes.py` | CRUD endpoints for speaker/episode profiles |
| `alembic/versions/xxx_add_podcast_profiles.py` | Migration for new tables |

### Existing Files to Modify
| File | Changes |
|------|---------|
| `routes/podcasts_routes.py` | Add POST endpoint for podcast creation with profile support |
| `models/podcast.py` | Add speaker_profile_id, episode_profile_id, outline, language columns |

## API Endpoints (Phase 1)

### Speaker Profiles
- `POST /api/v1/podcast-profiles/speakers` — Create speaker profile
- `GET /api/v1/podcast-profiles/speakers` — List speaker profiles
- `GET /api/v1/podcast-profiles/speakers/{id}` — Get speaker profile
- `PUT /api/v1/podcast-profiles/speakers/{id}` — Update speaker profile
- `DELETE /api/v1/podcast-profiles/speakers/{id}` — Delete speaker profile

### Episode Profiles
- `POST /api/v1/podcast-profiles/episodes` — Create episode profile
- `GET /api/v1/podcast-profiles/episodes` — List episode profiles
- `GET /api/v1/podcast-profiles/episodes/{id}` — Get episode profile
- `PUT /api/v1/podcast-profiles/episodes/{id}` — Update episode profile
- `DELETE /api/v1/podcast-profiles/episodes/{id}` — Delete episode profile

### Extended Podcast Creation
- `POST /api/v1/podcasts` — Create podcast with optional profile references

## Risk Assessment

### Version Conflicts
- **langchain/langgraph**: SurfSense pins specific versions. podcast-creator via esperanto-ai may require different versions.
- **Mitigation**: Port logic directly, don't add podcast-creator as dependency.

### ElevenLabs SDK
- **Risk**: Low. Standalone package, HTTP-based, no transitive AI framework deps.
- **Voice ID management**: ElevenLabs voices are account-specific. Need to validate voice_id exists before TTS generation.

### Migration Safety
- **New tables**: Safe, no existing data affected.
- **ALTER podcasts**: Adding nullable columns, no data loss.
- **Rollback**: Simple DROP TABLE / DROP COLUMN.

## Model Discovery (Phase 2+)

Port concept from Open Notebook's `model_discovery.py`:
- Auto-discover available models from configured providers
- Store in a `discovered_models` table
- Use for UI dropdowns when configuring episode/speaker profiles
- Provider-specific discovery: API-based for OpenAI/Ollama/Groq, static for Anthropic/ElevenLabs

This is lower priority than podcast multi-speaker support and can be implemented in Phase 2.
