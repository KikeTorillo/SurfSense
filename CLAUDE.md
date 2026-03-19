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
- `lib/apis/base-api.service.ts` — Clase base con fetch wrapper

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
- `messages/{en,es,pt,zh,hi}.json` — Archivos de traducción con next-intl
- **Siempre agregar strings en TODOS los 5 archivos de locale**

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

### Tareas asíncronas
- `app/tasks/celery_tasks/*.py` — Tareas Celery (podcasts, reportes, etc.)

### Migraciones
- `alembic/versions/NNN_descripción.py` — Numeradas secuencialmente

### RBAC
- `Permission` enum en `app/db.py`
- `check_permission()` en `app/utils/rbac.py`

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
2. **RBAC**: Verificar permisos con `myAccessAtom` en frontend y `check_permission()` en backend para toda ruta protegida.
3. **i18n obligatorio**: Al agregar strings de UI, actualizar los 5 archivos de locale (`en.json`, `es.json`, `pt.json`, `zh.json`, `hi.json`).
4. **Migraciones Alembic**: Numerar secuencialmente y verificar que no haya conflictos con revisiones existentes.
5. **No crear archivos de documentación** (*.md, README) salvo que se pida explícitamente.
