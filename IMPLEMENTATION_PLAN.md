# Plan de Implementación — Fork SurfSense + Open Notebook

> **Proyecto:** Asistente de investigación y conocimiento de nueva generación
> **Estrategia:** Fork de SurfSense como base, complementado con las mejores capacidades de Open Notebook
> **Fecha:** 2026-03-16
> **Estado:** Borrador inicial

---

## 1. Visión del Proyecto

Construir una plataforma de gestión de conocimiento e investigación que combine:

- **La potencia empresarial de SurfSense:** colaboración en tiempo real, 25+ conectores, búsqueda federada con RAG jerárquico, RBAC, generación de reportes multi-formato.
- **La profundidad investigativa de Open Notebook:** generación avanzada de podcasts con 1-4 speakers personalizables, flujos agenticos de investigación, modelo de datos orientado a notebooks/fuentes/notas.

El resultado es una herramienta que sirve tanto para equipos como para investigadores individuales, superando las limitaciones de Google NotebookLM (2 speakers fijos, sin conectores, sin colaboración) y de cada proyecto por separado.

---

## 2. Por Qué SurfSense Como Base

### Justificación técnica

| Criterio | SurfSense (base) | Open Notebook (donor) | Veredicto |
|----------|-------------------|----------------------|-----------|
| **Colaboración** | WebSockets en tiempo real, group chats, comment threads | Sin features de equipo | Agregar colaboración desde cero tomaría 3-6 meses |
| **RBAC** | Owner, Admin, Editor, Viewer | Sin sistema de permisos | Implementar RBAC es complejo y propenso a errores |
| **Base de datos** | PostgreSQL + vectores (pgvector) | SurrealDB (multi-modelo, nicho) | PostgreSQL es estándar de industria, mejor ecosistema, más fácil de escalar y mantener |
| **Conectores** | 25+ (Slack, Drive, Gmail, Notion, Jira, GitHub, Discord, YouTube, etc.) con auto-sync | Ingesta manual (upload/add) | Construir 25 conectores desde cero es inviable |
| **Búsqueda** | RAG jerárquico de 2 niveles + Reciprocal Rank Fusion | Dual (full-text + semántico) | La arquitectura de búsqueda de SurfSense es más sofisticada |
| **Generación de reportes** | PDF, DOCX, HTML, LaTeX, EPUB, ODT, texto plano | Solo notas y chat | Reportes multi-formato ya resueltos |
| **LLM proxy** | LiteLLM (100+ LLMs, 6,000+ embeddings) | Directo a 16+ proveedores | LiteLLM es más flexible y escalable |
| **Agentes** | LangChain Deep Agents con planning tool y sub-agentes | LangGraph workflows | Los Deep Agents son más avanzados para tareas complejas |

### Lo que le falta a SurfSense (y Open Notebook resuelve)

| Feature | Estado en SurfSense | Estado en Open Notebook |
|---------|---------------------|------------------------|
| **Podcasts avanzados** | ~3 min en ~20 seg, básico (OpenAI/Azure/Kokoro TTS) | 1-4 speakers personalizables, ElevenLabs TTS, `podcast-creator` lib |
| **Modelo de notebooks** | Workspaces → Documents → Chats | Notebook → Sources → Notes → Transformations (más granular) |
| **Descubrimiento de modelos** | Configuración manual | `model_discovery.py` enumera modelos disponibles por proveedor |
| **Testing de conexiones** | No documentado | `connection_tester.py` integrado |

---

## 3. Features a Portar Desde Open Notebook

### Prioridad Alta (P0) — Impacto inmediato

| Feature | Descripción | Módulo fuente | Complejidad |
|---------|------------|---------------|-------------|
| **Podcasts multi-speaker** | 1-4 speakers personalizables vs. el sistema básico de SurfSense | `open_notebook/podcasts/` | Media |
| **ElevenLabs TTS** | Voces de alta calidad como opción adicional a OpenAI/Azure/Kokoro | `open_notebook/podcasts/` | Baja |
| **Personalización de speakers** | Nombres, personalidades, estilos de conversación configurables | `open_notebook/podcasts/models.py` | Media |

### Prioridad Media (P1) — Mejoras significativas

| Feature | Descripción | Módulo fuente | Complejidad |
|---------|------------|---------------|-------------|
| **Modelo de Notebooks/Notas** | Agregar capa de Notebooks → Sources → Notes sobre los Workspaces de SurfSense | `open_notebook/domain/` | Alta |
| **Transformaciones** | Pipeline de transformaciones aplicables a notas y contenido | `open_notebook/domain/transformation.py` | Media |
| **Descubrimiento dinámico de modelos** | Enumerar modelos disponibles por proveedor automáticamente | `open_notebook/ai/model_discovery.py` | Baja |
| **Testing de conexiones** | Verificar conectividad con proveedores de AI desde la UI | `open_notebook/ai/connection_tester.py` | Baja |

### Prioridad Baja (P2) — Nice to have

| Feature | Descripción | Módulo fuente | Complejidad |
|---------|------------|---------------|-------------|
| **REST API completa** | API pública documentada para automatización | `open_notebook/` (FastAPI) | Media |
| **Flujos de investigación** | Workflows especializados: ask, chat, source_chat | `open_notebook/graphs/` | Alta |

---

## 4. Arquitectura Propuesta

### Vista de alto nivel

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │Workspaces│ │ Search   │ │ Podcasts │ │ Notebooks  │ │
│  │& Collab  │ │ & Chat   │ │ Studio   │ │ & Notes    │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                   Backend (Python)                        │
│                                                          │
│  ┌─────────────────────┐  ┌────────────────────────┐    │
│  │  SurfSense Core     │  │  Módulos Portados      │    │
│  │  ─────────────────  │  │  ──────────────────    │    │
│  │  • Deep Agents      │  │  • Podcast Engine      │    │
│  │  • Connectors (25+) │  │    (multi-speaker)     │    │
│  │  • RAG Pipeline     │  │  • Model Discovery     │    │
│  │  • RBAC             │  │  • Connection Tester   │    │
│  │  • Collaboration    │  │  • Notebook/Notes      │    │
│  │  • Report Gen       │  │    Data Layer          │    │
│  └─────────┬───────────┘  └───────────┬────────────┘    │
│            │                          │                   │
│  ┌─────────┴──────────────────────────┴────────────┐    │
│  │              LiteLLM (Unified LLM Proxy)         │    │
│  │         100+ LLMs, 6,000+ embedding models       │    │
│  └──────────────────────┬──────────────────────────┘    │
└─────────────────────────┼────────────────────────────────┘
                          │
┌─────────────────────────┴────────────────────────────────┐
│                    Data Layer                              │
│  ┌──────────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ PostgreSQL   │  │ pgvector  │  │ Redis/WebSocket  │  │
│  │ (core data)  │  │ (vectors) │  │ (real-time)      │  │
│  └──────────────┘  └───────────┘  └──────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Integración del módulo de Podcasts

El módulo de podcasts de Open Notebook (`open_notebook/podcasts/`) es relativamente aislado, lo que facilita su portado:

1. **Adaptar modelos de datos:** Traducir los modelos de podcast de SurrealDB a PostgreSQL (tablas: `podcast_episodes`, `podcast_speakers`, `podcast_configs`).
2. **Integrar TTS providers:** Agregar ElevenLabs como opción junto a OpenAI/Azure/Kokoro en la capa de TTS existente de SurfSense.
3. **Pipeline de generación:** Adaptar el pipeline de `podcast-creator` para usar los Deep Agents de SurfSense como orquestador (generación de guión → asignación de speakers → síntesis TTS → merge de audio).
4. **UI del Podcast Studio:** Crear componente React para configurar speakers (1-4), asignar voces, personalizar estilos y previsualizar.

### Integración del modelo de Notebooks

Extender el modelo de Workspaces de SurfSense con una capa de Notebooks:

```
Workspace (SurfSense)
├── Search Spaces
├── Connectors
├── Chats (colaborativos)
└── Notebooks (nuevo, portado de Open Notebook)
    ├── Sources (vinculados a Documents del workspace)
    ├── Notes (generadas por AI o manuales)
    └── Transformations (pipelines de procesamiento)
```

Esto permite que los Notebooks hereden automáticamente el RBAC y la colaboración del Workspace padre.

---

## 5. Fases de Implementación

### Fase 0 — Setup y Familiarización (Semana 1-2)

**Objetivo:** Tener el entorno de desarrollo funcional y entender ambos codebases.

| Tarea | Entregable |
|-------|-----------|
| Fork de SurfSense | Repositorio propio con CI básico |
| Levantar SurfSense localmente con Docker Compose | Instancia funcional (backend + frontend + PostgreSQL + extensión) |
| Levantar Open Notebook localmente | Instancia funcional para referencia |
| Auditar `open_notebook/podcasts/` | Documento con dependencias, interfaces, y puntos de integración |
| Auditar sistema de TTS de SurfSense | Mapeo de la implementación actual de podcast/TTS |

### Fase 1 — Podcasts Avanzados (Semana 3-6)

**Objetivo:** Reemplazar el sistema de podcasts básico de SurfSense con el motor multi-speaker.

| Tarea | Entregable |
|-------|-----------|
| Crear tablas PostgreSQL para podcasts (speakers, episodios, configs) | Migración SQL |
| Portar lógica de generación de guiones multi-speaker | Módulo `podcast_engine/` integrado |
| Integrar ElevenLabs TTS junto a proveedores existentes | Configuración de TTS expandida |
| Adaptar pipeline: guión → speakers → TTS → merge audio | Endpoint funcional de generación |
| Crear UI de Podcast Studio en Next.js | Componente con configuración de 1-4 speakers |
| Tests de integración | Suite de tests para el pipeline completo |

**Criterio de éxito:** Generar un podcast de 5+ minutos con 3 speakers distintos a partir de documentos del workspace.

### Fase 2 — Model Discovery y Connection Testing (Semana 7-8)

**Objetivo:** Mejorar la experiencia de configuración de proveedores de AI.

| Tarea | Entregable |
|-------|-----------|
| Adaptar `model_discovery.py` para funcionar con LiteLLM | Endpoint que lista modelos disponibles por proveedor |
| Adaptar `connection_tester.py` | Endpoint y UI para verificar conectividad |
| Integrar en settings de SurfSense | Panel de configuración mejorado |

**Criterio de éxito:** Un usuario nuevo puede descubrir y verificar sus modelos disponibles desde la UI sin tocar archivos de configuración.

### Fase 3 — Notebooks y Notas (Semana 9-14)

**Objetivo:** Agregar la capa de investigación estructurada.

| Tarea | Entregable |
|-------|-----------|
| Diseñar schema PostgreSQL para Notebooks, Sources, Notes, Transformations | Migración SQL |
| Implementar CRUD backend con herencia de permisos del Workspace | API endpoints |
| Implementar UI de Notebooks (lista, editor, vinculación de sources) | Componentes React |
| Integrar generación de notas por AI (usando Deep Agents) | Flujo: seleccionar sources → generar nota |
| Implementar Transformations como pipelines configurables | Motor de transformaciones |

**Criterio de éxito:** Un usuario puede crear un notebook dentro de un workspace, vincular documentos como sources, generar notas con AI, y aplicar transformaciones.

### Fase 4 — Pulido y Estabilización (Semana 15-18)

**Objetivo:** Calidad de producción.

| Tarea | Entregable |
|-------|-----------|
| Tests end-to-end para todos los flujos nuevos | Suite E2E |
| Documentación de usuario para features nuevos | Docs actualizados |
| Performance profiling del pipeline de podcasts | Optimizaciones donde sea necesario |
| Revisión de seguridad (RBAC en notebooks, sanitización de inputs) | Reporte de seguridad |
| Docker Compose actualizado con todos los servicios | `docker-compose.yml` de producción |

---

## 6. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| **Incompatibilidad del módulo de podcasts con PostgreSQL** | Media | Alto | Diseñar schema PostgreSQL desde cero inspirado en el modelo de Open Notebook, no intentar migrar SurrealDB directamente |
| **`podcast-creator` lib tiene dependencias conflictivas** | Media | Medio | Evaluar temprano (Fase 0); si hay conflictos, extraer solo la lógica necesaria sin la librería completa |
| **Deep Agents de SurfSense son difíciles de extender** | Baja | Alto | Encapsular los módulos portados como servicios independientes que los agentes orquestan, sin modificar el core de agentes |
| **Rendimiento de generación multi-speaker** | Media | Medio | Implementar generación de audio por speaker en paralelo; cachear guiones generados |
| **Complejidad de RBAC en Notebooks** | Baja | Medio | Heredar permisos del Workspace padre; no crear un sistema de permisos separado |
| **SurfSense actualiza su upstream frecuentemente** | Alta | Medio | Mantener los cambios en módulos separados y bien delimitados para facilitar rebases periódicos del upstream |
| **ElevenLabs API tiene costos elevados** | Alta | Bajo | Mantener OpenAI/Azure/Kokoro como opciones gratuitas/baratas; ElevenLabs es opcional |
| **Scope creep al portar features de Open Notebook** | Alta | Alto | Respetar estrictamente las prioridades P0/P1/P2; no avanzar a la siguiente prioridad sin completar la actual |

---

## 7. Stack Tecnológico Final

### Core (heredado de SurfSense)

| Capa | Tecnología |
|------|-----------|
| **Frontend** | Next.js, React, TypeScript |
| **Backend** | Python, LangChain Deep Agents, LangGraph |
| **Base de datos** | PostgreSQL + pgvector |
| **LLM Proxy** | LiteLLM (100+ LLMs, 6,000+ embeddings) |
| **LLM Local** | Ollama, vLLM |
| **Búsqueda** | RAG jerárquico de 2 niveles + Reciprocal Rank Fusion |
| **Colaboración** | WebSockets (real-time), RBAC (4 roles) |
| **Conectores** | 25+ (Slack, Drive, Gmail, Notion, Jira, GitHub, Discord, YouTube, etc.) |
| **Reportes** | PDF, DOCX, HTML, LaTeX, EPUB, ODT |
| **Extensión** | Chrome/Firefox (captura de páginas autenticadas) |
| **Contenedores** | Docker, Docker Compose, Watchtower |
| **Analytics** | PostHog |

### Agregado desde Open Notebook

| Capa | Tecnología |
|------|-----------|
| **Podcasts** | Motor multi-speaker (1-4), `podcast-creator` lib (adaptada) |
| **TTS adicional** | ElevenLabs (junto a OpenAI/Azure/Kokoro existentes) |
| **Model Discovery** | Enumeración automática de modelos por proveedor |
| **Connection Testing** | Verificación de conectividad con proveedores de AI |
| **Notebooks** | Capa de Notebook → Sources → Notes → Transformations sobre Workspaces |

### Nuevas dependencias a agregar

| Dependencia | Propósito |
|------------|----------|
| `podcast-creator` | Pipeline de generación de podcasts multi-speaker |
| `elevenlabs` (Python SDK) | TTS de alta calidad como opción adicional |
| Posibles migraciones Alembic adicionales | Schema de Notebooks y Podcasts en PostgreSQL |

---

## 8. Criterios de Éxito

### Funcionales

- [ ] **Podcasts multi-speaker:** Generar podcasts con 1-4 speakers personalizables, con voces distintas y transiciones naturales.
- [ ] **ElevenLabs TTS:** Funciona como alternativa a los proveedores TTS existentes.
- [ ] **Notebooks:** Crear, editar y organizar notebooks dentro de workspaces con sources, notas y transformaciones.
- [ ] **RBAC en Notebooks:** Los permisos del workspace se aplican correctamente a los notebooks contenidos.
- [ ] **Model Discovery:** La UI muestra automáticamente los modelos disponibles para cada proveedor configurado.
- [ ] **Connection Testing:** Verificar conectividad con proveedores de AI con un solo clic.

### No Funcionales

- [ ] **Rendimiento de podcasts:** Generar un podcast de 5 minutos con 3 speakers en menos de 2 minutos.
- [ ] **Compatibilidad upstream:** Los cambios están suficientemente aislados para permitir rebase del upstream de SurfSense sin conflictos masivos.
- [ ] **Sin regresiones:** Todos los features originales de SurfSense (conectores, búsqueda, colaboración, reportes, extensión) siguen funcionando.
- [ ] **Docker Compose:** Un solo `docker-compose up` levanta todo el sistema con todos los features nuevos.
- [ ] **Documentación:** Guía de configuración y uso para cada feature nuevo.

### Métricas de validación

| Métrica | Target |
|---------|--------|
| Tests unitarios nuevos | > 80% cobertura en módulos portados |
| Tests E2E | Flujos críticos: podcast generation, notebook CRUD, model discovery |
| Tiempo de setup (desde cero) | < 15 minutos con Docker Compose |
| Calidad de podcasts | Audio sin cortes, transiciones naturales entre speakers, contenido coherente con las fuentes |

---

## Apéndice: Referencias

- **SurfSense:** https://github.com/MODSetter/SurfSense
- **Open Notebook:** https://github.com/lfnovo/open-notebook
- **LiteLLM:** https://github.com/BerriAI/litellm
- **podcast-creator:** Librería usada por Open Notebook para generación de podcasts
- **ElevenLabs:** https://elevenlabs.io/
- **pgvector:** https://github.com/pgvector/pgvector
