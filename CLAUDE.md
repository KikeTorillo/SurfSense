# CLAUDE.md — SurfSense Fork

## Idioma

Toda comunicación con el usuario debe ser en **español**.

## Descripción del proyecto

Fork de [SurfSense](https://github.com/MODSetter/SurfSense): plataforma RAG + Agentes enterprise con 25+ conectores, chat multi-LLM, podcasts multi-speaker, RBAC granular y reportes.

Componentes principales:
- **`surfsense_backend/`** — API y agentes (FastAPI + LangGraph)
- **`surfsense_web/`** — Dashboard y UI (Next.js)
- **`surfsense_browser_extension/`** — Extensión de navegador (Plasmo)

## Stack tecnológico

| Capa | Tecnologías |
|------|-------------|
| Backend | Python 3.12, FastAPI, SQLAlchemy async + pgvector, Celery + Redis, LangGraph, LiteLLM |
| Frontend | Next.js 16, React 19, Jotai + TanStack Query, shadcn/ui (Radix), Tailwind, Electric SQL, Zod |
| Base de datos | PostgreSQL 17 + pgvector, Redis |
| Infra | Docker Compose (8 servicios: db, pgadmin, redis, backend, celery_worker, celery_beat, electric, frontend) |

## Estructura del proyecto

```
notebook/
├── docker/
│   ├── docker-compose.dev.yml    # Dev con build desde fuente
│   └── docker-compose.yml        # Producción con imágenes prebuilt
├── surfsense_backend/
│   ├── app/
│   │   ├── agents/               # Agentes LangGraph (new_chat, podcaster)
│   │   ├── routes/               # Endpoints FastAPI
│   │   ├── schemas/              # Modelos Pydantic (request/response)
│   │   ├── tasks/celery_tasks/   # Tareas asíncronas Celery
│   │   ├── utils/                # Utilidades (rbac.py, etc.)
│   │   └── db.py                 # Modelos SQLAlchemy + enums
│   └── alembic/versions/         # Migraciones de BD
├── surfsense_web/
│   ├── app/                      # App Router de Next.js (páginas)
│   ├── atoms/                    # Estado Jotai (query, mutation, ui atoms)
│   ├── components/               # Componentes React (ui/ = shadcn)
│   ├── contracts/                # types/ (Zod → TS) y enums/
│   ├── lib/apis/                 # Servicios API (clase + singleton)
│   ├── lib/query-client/         # Cache keys de TanStack Query
│   └── messages/                 # i18n (en, es, pt, zh, hi)
└── surfsense_browser_extension/  # Extensión Plasmo
```

## Comandos útiles

### Docker (ejecutar desde la raíz del repo)

```bash
# Build y levantar todo
docker compose -f docker/docker-compose.dev.yml up --build

# Rebuild un servicio específico
docker compose -f docker/docker-compose.dev.yml up --build backend
docker compose -f docker/docker-compose.dev.yml up --build frontend

# Restart un servicio sin rebuild
docker compose -f docker/docker-compose.dev.yml restart celery_worker
```

### Backend

```bash
# Crear migración Alembic (dentro del contenedor o local)
cd surfsense_backend && alembic revision --autogenerate -m "descripción"

# Aplicar migraciones
cd surfsense_backend && alembic upgrade head

# Tests
cd surfsense_backend && pytest

# Linting
cd surfsense_backend && ruff check . && ruff format .
```

### Frontend

```bash
# Dev local (fuera de Docker)
cd surfsense_web && pnpm dev

# Build
cd surfsense_web && pnpm build

# Lint con Biome (ejecutar desde surfsense_web/ por nested biome.json)
cd surfsense_web && npx @biomejs/biome check .
cd surfsense_web && npx @biomejs/biome check --write .  # auto-fix
```

## Patrones de arquitectura — Frontend

### Types y validación
- `contracts/types/*.types.ts` — Zod schemas que exportan tipos TS inferidos
- `contracts/enums/*.ts` — Enums compartidos

### API Services
- `lib/apis/*-api.service.ts` — Clase con métodos HTTP, exporta singleton
- `lib/apis/base-api.service.ts` — Clase base con retry automático en 401, validación Zod, error handling (AppError/AuthenticationError/AuthorizationError). Métodos: `get`, `post`, `put`, `delete`, `patch`, `getBlob`, `postBlob`, `postFormData`
- **Regla**: Todos los servicios DEBEN usar `baseApiService` — nunca `fetch()` directo

### Cache Keys
- `lib/query-client/cache-keys.ts` — Todas las keys de TanStack Query centralizadas

### Estado (Jotai + TanStack Query)
- `atoms/<feature>/query.atoms.ts` — Atoms de lectura (queries)
- `atoms/<feature>/mutation.atoms.ts` — Atoms de escritura (mutations)
- `atoms/<feature>/ui.atoms.ts` — Estado local de UI

### Componentes
- `components/ui/` — Componentes shadcn/ui Radix (no modificar directamente; ver "Reglas de UI" abajo)
- `components/<feature>/` — Componentes de funcionalidad específica

### i18n
- `i18n/routing.ts` — Configuración de rutas i18n (`defaultLocale: "es"`, locales: en, es, pt, zh, hi)
- `messages/{en,es,pt,zh,hi}.json` — Archivos de traducción con next-intl
- **Siempre agregar strings en TODOS los 5 archivos de locale**
- Namespaces de settings (todos usan `useTranslations("namespace")`):
  - `llmRoleSettings` — Asignación de roles LLM/Image/TTS
  - `modelConfigSettings` — CRUD de configuraciones de modelos LLM
  - `imageModelSettings` — CRUD de modelos de generación de imágenes
  - `podcastSettings` — Perfiles de locutores y episodios de podcast
  - `videoModelSettings` — CRUD de modelos de generación de video
  - `voiceLibrarySettings` — Biblioteca de voces (preset/design/clone)
  - `roleSettings` — Gestión de roles y permisos RBAC
  - `promptSettings` — Instrucciones del sistema personalizadas

## Patrones de arquitectura — Backend

### Rutas
- `app/routes/*_routes.py` — Archivos de rutas FastAPI
- `app/routes/__init__.py` — Registro central de todos los routers

### Schemas
- `app/schemas/*.py` — Modelos Pydantic para request/response

### Modelos de BD
- `app/db.py` — Todos los modelos SQLAlchemy + enums (Permission, etc.)

### Agentes LangGraph
- `app/agents/<nombre>/graph.py` — Definición del grafo
- `app/agents/<nombre>/nodes.py` — Funciones de cada nodo
- `app/agents/<nombre>/state.py` — Estado del grafo
- `app/agents/<nombre>/prompts.py` — Templates de prompts

### Services
- `app/services/tts_router_service.py` — Singleton TTSRouterService que wrappea LiteLLM Router para TTS. Auto mode con load balancing
- `app/services/llm_router_service.py` — Singleton LLMRouterService para LLM Auto mode
- `app/services/image_gen_router_service.py` — Singleton ImageGenRouterService para Image Gen Auto mode

### Tareas asíncronas
- `app/tasks/celery_tasks/*.py` — Tareas Celery (podcasts, connectores, reportes, etc.)

### Migraciones
- `alembic/versions/NNN_descripción.py` — Numeradas secuencialmente

### RBAC
- `Permission` enum en `app/db.py` — todos los recursos tienen CRUD completo (CREATE/READ/UPDATE/DELETE)
- `check_permission()` en `app/utils/rbac.py` — siempre pasar `.value` y mensaje descriptivo como 5to argumento
- `DEFAULT_ROLE_PERMISSIONS` en `app/db.py` — Owner (`*`), Editor (CRUD sin DELETE), Viewer (solo READ)
- Permisos almacenados como `ARRAY(String)` en `SearchSpaceRole.permissions` — no requiere migración Alembic al agregar nuevos enum values
- Voice profiles reutiliza permisos `PODCASTS_*` (no tiene permisos propios)

### Global Configs (YAML)
Configuraciones preconfiguradas por el admin, disponibles para todos los usuarios sin crear configs manuales. Usan IDs negativos para distinguirse de configs de usuario (IDs positivos).

- **Archivo**: `app/config/global_llm_config.yaml` (gitignored, contiene keys)
- **Ejemplo**: `app/config/global_llm_config.example.yaml`
- **Secciones**: `global_llm_configs`, `global_image_generation_configs`, `global_tts_configs`, `router_settings`, `image_generation_router_settings`, `tts_router_settings`
- **Convención de IDs**: `0` = Auto mode (LiteLLM Router), negativo = global YAML, positivo = config de usuario en BD
- **Cache**: `_load_yaml_config()` en `config/__init__.py` lee el YAML una sola vez y cachea en memoria. Las 6 funciones públicas (`load_global_llm_configs()`, etc.) delegan al cache
- **Flujo**: YAML → cache → `config.GLOBAL_*_CONFIGS` → `GET /global-*-configs` → frontend dropdown
- **Resolución en tareas**: `podcast_tasks.py` → `_load_search_space_tts_config()` maneja ID 0 (Auto), negativos (YAML) y positivos (BD)

### Biblioteca de Voces
Sistema para crear y gestionar voces personalizadas para podcasts. Soporta 3 tipos de voz via Qwen3-TTS:

- **Preset**: voces fijas de Qwen3-TTS (eric, serena, vivian...). Solo seleccionas una del dropdown.
- **Diseñada (VoiceDesign)**: describes la voz en inglés ("A warm male narrator with deep voice...") y el modelo genera una voz sintética. Las instrucciones solo aceptan inglés/chino.
- **Clonada (Base)**: subes un audio de referencia (10-15s, ≥24kHz) + transcripción exacta palabra por palabra. Si la transcripción no coincide, genera ruido.

**Modelo BD**: `voice_profiles` (tabla) con `voice_type` enum (preset/design/clone), `preset_voice_id`, `design_instructions`, `clone_profile_id`, `clone_ref_text`, `language`

**Backend**:
- `app/routes/voice_profiles_routes.py` — CRUD + clone upload (ffmpeg → WAV 24kHz) + preview vía HTTP directo al proxy. Clone creation usa transacción atómica (cleanup de archivos si falla BD)
- `app/agents/podcaster/utils.py` → `resolve_speaker_voice()` — cadena de 5 niveles de fallback: voice profile → speaker override → profile default → search space config → global env
- `app/agents/podcaster/nodes.py` → `generate_audio()` agrupa diálogos por tipo de voz para minimizar switches de modelo GPU
- `app/tasks/celery_tasks/podcast_tasks.py` → `_load_voice_profiles_map()` carga voice profiles referenciados por speakers
- `app/agents/podcaster/models.py` → `Speaker` tiene campo opcional `voice_profile_id`

**Frontend**:
- `components/settings/voice-library-manager.tsx` — UI de biblioteca con 3 diálogos de creación + preview con audio playback
- `components/settings/podcast-profile-manager.tsx` — dropdown de speaker voice muestra voces de biblioteca (SelectGroup) + voces legacy
- `contracts/types/voice-profile.types.ts` — Zod schemas con `z.discriminatedUnion("voice_type")` para preset y design (clone usa FormData en endpoint separado)
- `lib/apis/voice-profiles-api.service.ts` — todos los métodos usan `baseApiService` (postFormData para clone, postBlob para preview)
- `atoms/voice-profiles/` — query + mutation atoms
- i18n: namespace `voiceLibrarySettings` en los 5 locales

**Infra**: Volume `voice-library` compartido entre backend SurfSense (`/shared_tmp/voice_library`) y qwen3-tts (`/app/voice_library`). Declarado como external en `docker-compose.dev.yml` (`llm-server_voice-library`).

### Generación de Video
Sistema para generar videos desde texto (t2v) o desde imagen (i2v) usando modelos locales vía ComfyUI proxy. A diferencia de image/LLM/TTS, NO usa LiteLLM — hace llamadas HTTP directas porque LiteLLM no soporta video.

**Modelo BD**: `video_generation_configs` (config de provider) + `video_generations` (resultados). Videos se guardan en disco (`/shared_tmp/video_generation/`), no en JSONB. `VideoGenProvider` enum (solo OPENAI por ahora). Permisos: `VIDEO_GENERATIONS_*`.

**Backend**:
- `app/services/video_gen_service.py` — Cliente HTTP directo (aiohttp) al proxy, timeout 300s
- `app/routes/video_generation_routes.py` — CRUD configs + ejecución síncrona + serving .mp4 con token firmado (FileResponse)
- `app/agents/new_chat/tools/generate_video.py` — Tool LangGraph (factory), resuelve config, llama API, guarda .mp4, retorna URL
- `app/agents/new_chat/tools/display_video.py` — Tool para renderizar video inline en chat
- `app/config/__init__.py` → `load_global_video_gen_configs()` + `GLOBAL_VIDEO_GEN_CONFIGS`

**Frontend**:
- `components/settings/video-model-manager.tsx` — Settings CRUD para configs de video
- `components/tool-ui/display-video.tsx` — `makeAssistantToolUI` para renderizar video player en chat
- `components/tool-ui/video/index.tsx` — Componente `<Video>` con `<video>` nativo + controles
- `contracts/types/new-llm-config.types.ts` — Zod schemas: `videoGenerationConfig`, `globalVideoGenConfig`, etc.
- `lib/apis/video-gen-config-api.service.ts` — API service via `baseApiService`
- `atoms/video-gen-config/` — query + mutation atoms
- i18n: namespace `videoModelSettings` en los 5 locales

**Config YAML**: Sección `global_video_generation_configs` en `global_llm_config.yaml`. Sin Auto mode router (sin LiteLLM). IDs negativos = global YAML, positivos = BD usuario.

**Flujo**: LLM → `generate_video(prompt)` → `VideoGenService.generate_video()` → proxy ComfyUI → b64 response → decode → save .mp4 → DB → `display_video(src)` → `<video>` player inline

**Streaming**: `app/tasks/chat/stream_new_chat.py` tiene handlers para `display_video` en 3 secciones: on_tool_start (thinking step), on_tool_end (completion), y tool output (emit `format_tool_output_available`). **IMPORTANTE**: `display_video` debe estar en `TOOLS_WITH_UI` Set en `page.tsx` para que el frontend persista el tool-call en el mensaje.

**Infra**: Video files en `/shared_tmp/video_generation/`. El proxy orquesta GPU automáticamente (ensure_comfyui → generate → restore_llamacpp).

### Pipeline de Podcasts
LangGraph con 4 nodos secuenciales, orquestado por Celery. Routing condicional: legacy (sin speaker profile) o new (multi-speaker).

**Nodos del pipeline new:**
1. **`generate_outline()`** — LLM genera exactamente `num_segments` segmentos (name, description, size: short/medium/long). Trunca si LLM genera de más
2. **`generate_transcript()`** — Itera segmento por segmento acumulando diálogos. Turnos por tamaño: short=3, medium=6, long=10. Valida que speaker names estén en whitelist. Último segmento instruye conclusión
3. **`generate_audio()`** — Agrupa diálogos por tipo de voz (clone/design/preset juntos) para minimizar GPU switches. Genera TTS secuencial (`BATCH_SIZE=1`, timeout=600s). Model name incluye idioma: `tts-1-es`. Reordena clips al índice original
4. **`combine_audio()`** — FFmpeg `concat` todos los clips → MP3 final. Limpia clips temporales

**Flujo de entrada**: `POST /podcasts/generate` → crear Podcast(PENDING) en BD → Redis lock → Celery task → cargar profiles + TTS config + voice profiles map → `podcaster_graph.ainvoke()` → persistir resultado (READY) → limpiar Redis

**Templates Jinja**: `app/agents/podcaster/templates/outline.jinja` y `transcript.jinja`

**Frontend**: `components/tool-ui/generate-podcast.tsx` — PodcastStatusPoller (polling 5s) → PodcastPlayer (audio + transcript expandible)

## Convenciones de código

### Frontend (Biome)
- Indentación: tabs
- Quotes: double quotes (`"`)
- Semicolons: always
- Trailing commas: es5
- Nombrado de archivos: `kebab-case`

### Backend (Ruff)
- Linting + formatting con Ruff
- Nombrado de archivos: `snake_case`

### Commits
- Formato Conventional Commits (Commitizen): `feat:`, `fix:`, `refactor:`, `docs:`, etc.

## Reglas de UI (shadcn/ui + Tailwind)

### Estilos
- Usar colores semánticos (`bg-primary`, `text-muted-foreground`), nunca raw colors (`bg-blue-500`, `text-gray-600`)
- Status/estado: usar `Badge` variants o `text-destructive`, no raw Tailwind colors
- Usar variantes built-in (`variant="outline"`) antes de className custom
- `className` solo para layout (`max-w-md`, `mx-auto`, `mt-4`), no para colores/tipografía
- `gap-*` en vez de `space-x-*`/`space-y-*` → `flex flex-col gap-4`
- `size-*` en vez de `w-* h-*` cuando son iguales → `size-10`
- `truncate` en vez de `overflow-hidden text-ellipsis whitespace-nowrap`
- `cn()` para clases condicionales, no ternarios manuales en className
- No `dark:` manual — los tokens semánticos manejan light/dark via CSS variables
- No `z-index` manual en overlays (`Dialog`, `Sheet`, `Popover`, etc.) — manejan su propio stacking

### Composición
- Items siempre dentro de su Group (`SelectItem` → `SelectGroup`, `DropdownMenuItem` → `DropdownMenuGroup`, etc.)
- `Dialog`, `Sheet`, `Drawer` siempre necesitan Title (usar `className="sr-only"` si es visual-hidden)
- Card completa: `CardHeader` + `CardTitle` + `CardDescription` + `CardContent` + `CardFooter`
- `TabsTrigger` siempre dentro de `TabsList`
- `Avatar` siempre con `AvatarFallback`
- Toast via `sonner` (`toast.success()`, `toast.error()`)
- `asChild` para triggers personalizados
- Usar `Separator` (no `<hr>`), `Skeleton` (no `animate-pulse` manual), `Badge` (no spans custom)

### Formularios
- Forms con `FieldGroup` + `Field`, nunca raw `div` con `space-y-*`
- Dentro de `InputGroup` usar `InputGroupInput`/`InputGroupTextarea`, no `Input` raw
- Botones dentro de inputs: `InputGroup` + `InputGroupAddon`
- Validación: `data-invalid` + `aria-invalid` en `Field` e input respectivamente
- Disabled: `data-disabled` en `Field` + `disabled` en el control
- 2–7 opciones: `ToggleGroup` + `ToggleGroupItem`, no loop de `Button` con estado manual

### Iconos
- Atributo `data-icon="inline-start"` (prefijo) o `data-icon="inline-end"` (sufijo) en iconos dentro de `Button`
- No sizing classes en iconos dentro de componentes shadcn — el CSS del componente los maneja
- Pasar iconos como componente (`icon={CheckIcon}`), no como string key a un lookup map
- Loading en Button: `<Spinner data-icon="inline-start" />` + `disabled`

## Rendimiento React / Next.js

### Waterfalls y async
- `Promise.all()` para operaciones independientes — nunca `await` secuencial de fetches sin dependencia
- Diferir `await` hasta la rama que lo necesita — no bloquear early returns
- RSCs: mover fetches a componentes async hijos + envolver en `<Suspense fallback={<Skeleton />}>`
- Compartir promises entre componentes con `use()` para deduplicar fetches

### Bundle size
- Imports directos desde archivo fuente, no barrel files (`lucide-react/dist/esm/icons/check`, no `lucide-react`)
- Alternativa: `optimizePackageImports` en `next.config.js` para mantener imports ergonómicos
- `next/dynamic` con `{ ssr: false }` para componentes pesados no necesarios en render inicial
- Diferir third-party no críticos (analytics, logging) con `next/dynamic`
- Carga condicional: `import()` dinámico dentro de `useEffect` cuando una feature se activa

### Server-side
- `React.cache()` para deduplicar queries/auth dentro de un request — usar args primitivos (no objetos inline)
- Minimizar serialización en boundary RSC→Client: pasar solo los campos que el client usa, no objetos completos
- `after()` de `next/server` para operaciones no-bloqueantes post-response (logging, analytics, cleanup)

### Re-renders
- Derivar estado en render (`const fullName = first + ' ' + last`), no `useEffect` + `setState`
- Ternario explícito (`count > 0 ? <X /> : null`) en vez de `&&` cuando la condición puede ser `0`/`NaN`
- `startTransition` para updates no urgentes de alta frecuencia (scroll, filtering)
- Hoistear JSX estático fuera del componente para evitar re-creación (especialmente SVGs grandes)

## Testing (Backend — Python)

### Filosofía
- Testear **comportamiento** via interfaces públicas, no detalles de implementación
- Verificar a través de la misma interfaz (si `create_user()` retorna id, verificar con `get_user(id)`)
- Un assertion lógico por test — nombre describe QUÉ, no CÓMO

### Mocking
- Mock **solo** en fronteras del sistema: APIs externas, time/randomness; preferir test DB sobre mock de BD
- Nunca mockear clases/módulos propios ni colaboradores internos
- Inyección de dependencias: pasar clients externos como parámetro, no instanciarlos internamente

### Diseño de interfaces testeables
- Preferir retornar resultados sobre producir side effects (`calculate_discount(cart) → float`, no `apply_discount(cart) → None`)
- Deep modules: interfaz pequeña + implementación profunda; reducir métodos y params, ocultar complejidad
- TDD vertical: un behavior a la vez (test → implementar → refactorizar)

## Reglas importantes

1. **Frontend en Docker**: En desarrollo, el frontend corre dentro de Docker. Cambios en `surfsense_web/` requieren rebuild del contenedor para verse reflejados.
2. **RBAC**: Verificar permisos con `myAccessAtom` en frontend y `check_permission()` en backend para toda ruta protegida. Siempre pasar mensaje descriptivo como 5to argumento.
3. **i18n obligatorio**: Al agregar strings de UI, actualizar los 5 archivos de locale (`en.json`, `es.json`, `pt.json`, `zh.json`, `hi.json`).
4. **Migraciones Alembic**: Numerar secuencialmente y verificar que no haya conflictos con revisiones existentes. Permisos son strings en ARRAY — agregar enum values no requiere migración de schema.
5. **No crear archivos de documentación** (*.md, README) salvo que se pida explícitamente.
6. **API services frontend**: Todos los métodos HTTP deben pasar por `baseApiService` — nunca `fetch()` directo. Usar `postFormData()` para uploads, `postBlob()` para audio.
7. **File operations backend**: Operaciones de archivos en disco (clone voice, etc.) deben usar try/except con cleanup en caso de fallo de BD. No tragar excepciones silenciosamente.
8. **Docker external resources**: Red `llm-net` y volumen `llm-server_voice-library` son `external: true` — deben existir antes de `docker compose up`.
