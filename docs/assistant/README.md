# Zon Assistant Developer Guide

Zon Assistant is the persisted customer-assistance, human-support, knowledge retrieval, and operations subsystem. The canonical detailed design remains [the assistant design specification](../superpowers/specs/2026-07-26-zon-assistant-backend-design.md); this directory is the shorter developer and operator handbook.

## Architecture

```text
AssistantWidget
  ├─ REST via RTK Query: conversations, history, lifecycle, support messages
  ├─ generation SSE: one customer message → AI snapshots → terminal events
  └─ inbox SSE: durable metadata + ephemeral presence/snapshot notifications

API
  ├─ assistant: conversations, messages, generation, events, retention
  ├─ knowledge: manifest validation, ingestion, embeddings, releases, retrieval
  ├─ support: queue, assignment, messages, transitions, presence
  ├─ llm: OpenAI-compatible transport + proactive provider limiter
  └─ admin: redacted observability, usage, queues, costs

PostgreSQL/pgvector: durable state and retrieval
Redis/BullMQ: limiter state, queues, replay fan-out, background processing
```

## Important modules

| Area | Location |
|---|---|
| Customer API and SSE | `apps/api/src/modules/assistant/` |
| Support API and presence | `apps/api/src/modules/support/` |
| Knowledge ingestion/retrieval | `apps/api/src/modules/knowledge/` |
| Provider transport/limiter | `apps/api/src/modules/llm/` |
| Admin observability | `apps/api/src/modules/admin/` |
| Shared contracts | `packages/shared/src/domain/{assistant,support,knowledge,admin}/` |
| Shared schemas | `packages/shared/src/schemas/{assistant,support,knowledge}/` |
| Customer widget | `apps/web/src/features/assistant/` |
| Support console | `apps/web/src/features/support/` |
| Admin operations | `apps/web/src/features/admin/` (single panel at `/admin`; the former `admin-assistant` page was folded in) |
| Generic composer/Markdown | `packages/ui/src/molecules/{MessageComposer,SafeMarkdown}/` |
| Help/RAG corpus | `docs/help/{en,tr}/` and `docs/help/manifest.json` |

## Roles and routes

- `customer`: customer assistant conversations and support requests.
- `support`: support queue and assigned conversation actions.
- `admin`: redacted operations/FinOps views and support access where explicitly allowed.

Frontend routes:

- `/:locale/support` — SUPPORT/ADMIN navigation surface.
- `/:locale/admin/assistant` and `/:locale/admin` — ADMIN-only operations surfaces.

Backend authorization is authoritative. Frontend route visibility is only UX; privileged endpoints revalidate the current database role and session on every request.

Role changes are intentionally unavailable over HTTP. See [operations.md](operations.md#role-management).

## Local startup

1. Start PostgreSQL, Redis, pgAdmin, and optional Ollama:
   ```bash
   pnpm docker:up
   ```
2. Configure `apps/api/.env`. Assistant runtime needs the normal auth/database/Redis settings plus `LLM_*`; hosted providers require `LLM_API_KEY`.
3. For local Ollama, pull the configured model once:
   ```bash
   docker compose exec ollama ollama pull qwen3:1.7b
   ```
4. Build packages and start both apps:
   ```bash
   pnpm dev
   ```
5. The API applies pending migrations on startup. Assistant-related migrations begin at `041`; current observability additions continue through `051`.

## Security invariants

- Access tokens are memory-only; refresh tokens are HttpOnly cookies.
- SSE authentication uses the Authorization header, never a query-string token.
- Support/admin requests use current-session/current-role guards.
- Role escalation is an operator CLI action, not an HTTP endpoint.
- Admin aggregates never expose prompts, conversation messages, credentials, job payloads, or raw provider errors.
- `SafeMarkdown` builds an allowlisted React tree and never uses `dangerouslySetInnerHTML`.
- Unknown monetary costs stay `NULL`/unknown, never synthetic zero.

## Related guides

- [SSE protocol](sse-protocol.md)
- [Operations](operations.md)
- [Testing and runtime acceptance](testing.md)
