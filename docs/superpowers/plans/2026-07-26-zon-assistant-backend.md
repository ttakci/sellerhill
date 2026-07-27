# Zon Assistant Backend — Complete Implementation Plan

> **Status:** DRAFT PLAN ONLY. Do not implement until Task 40 receives explicit user approval.

**Canonical design:** `docs/superpowers/specs/2026-07-26-zon-assistant-backend-design.md`; normative §0 overrides later explanatory text.

**Goal:** Deliver Spec C in full: shared contracts, persisted auth sessions/roles, Redis and exact provider limiting, durable conversations/SSE/outbox, atomic EN/TR RAG corpus and embedding spaces, allowlisted read tools, generation, support/presence, complete customer/support/admin UI, tests, operations and security review.

## Verified current-tree anchors (2026-07-26)

- Last migration is `apps/api/migrations/040_create_llm_usage_log.sql`; canonical `N=041`, so this plan owns **041–048**.
- `DatabaseService.onModuleInit()` runs forward-only migrations transactionally through `MigrationRunner`.
- `docker/postgres/init.sql` enables `uuid-ossp` and `pgcrypto`; `docker-compose.yml` uses `postgres:16-alpine`, without pgvector.
- BullMQ Redis config is inline in `apps/api/src/app.module.ts`; no reusable command/pub/sub provider exists.
- `AuthService` issues stateless access/refresh JWTs; `JwtPayload` has `sub/email`; `baseApi.ts` owns web single-flight refresh.
- `LlmService.chatStream()` emits accumulated snapshots but treats natural close as success; usage logging is fire-and-forget.
- `apps/web/src/features/assistant/AssistantWidget/` is placeholder local state. No support/admin routes exist. Web has no test harness.
- API Jest is pure/mock-oriented; Spec C requires a separate real pgvector PostgreSQL + Redis harness.
- `@repo/shared` and `@repo/ui` load from `dist`; rebuild after source changes, never commit generated `dist`.

## Non-negotiable rules

1. Task order is dependency order, not permission to omit later scope.
2. Every discriminator is a `packages/shared` enum; no local status string unions.
3. Tenant and support visibility constraints live in SQL, not post-fetch checks.
4. Privileged reads and mutations verify current DB role, session revoke state and version; stale JWT role grants nothing.
5. Outbox is metadata-only: no content, preview, full DTO, PII, prompt or secret.
6. Redis loss makes every LLM/embedding/classifier/summary/content path fail closed until PostgreSQL-led rebuild atomically marks the limiter ready.
7. Customer RAG reads only an explicit manifest under `docs/help/{en,tr}`. Specs, plans, operations, `CLAUDE.md` and source are excluded.
8. Tools are server-selected, read-only, allowlisted and tenant-scoped; model never selects SQL/tables/routes.
9. Frontend uses the four-file split, design-system controls, i18n and memory-only access tokens.
10. Database rollback is forward-fix; capability flags preserve data.
11. Never use `eslint-disable`, `--no-verify`, `git add .`, or real provider/customer data in tests.

## Locked migration map

| # | Exact file | Contents |
|---:|---|---|
| 041 | `041_assistant_auth_sessions_roles.sql` | roles, session version, rotating persisted refresh sessions, support profile |
| 042 | `042_assistant_conversations_support.sql` | conversations, participants, assignments, summaries/current state |
| 043 | `043_assistant_messages_generations.sql` | messages, attempts, citations, sequence/idempotency constraints |
| 044 | `044_assistant_outbox_audit.sql` | leased metadata outbox, support audit, dead-letter/retention indexes |
| 045 | `045_assistant_knowledge_corpora.sql` | documents, versions, chunks, release manifest, active pointer |
| 046 | `046_assistant_embedding_spaces.sql` | space registry and dimension/metric-specific vector tables/indexes |
| 047 | `047_assistant_quota_ledger.sql` | readiness/checkpoint, reservations, leases, reconciliation ledger |
| 048 | `048_assistant_usage_pricing.sql` | usage attribution extensions and versioned model pricing |

If another migration lands before implementation, stop and revise the entire contiguous canonical map with user approval.

---

## Task 1: Establish API/web test harnesses

**Depends on:** none

**Paths:** modify `apps/api/package.json`, `apps/web/package.json`, `pnpm-lock.yaml`; create `apps/api/jest.integration.config.js`, `apps/api/test/integration/{setup.ts,teardown.ts}`, `apps/web/vitest.config.ts`, `apps/web/src/test/setup.ts`.

- [ ] Record baseline: `pnpm lint`, `pnpm typecheck`, `pnpm --filter api test`, `pnpm build`.
- [ ] Add `api test:integration` against explicit disposable pgvector PostgreSQL and Redis; refuse database names without a test marker.
- [ ] Add Vitest, Testing Library, jsdom and fetch interception plus `web test`.
- [ ] Add one smoke test per harness; setup/teardown must isolate and clean state.

**Verify:** `pnpm install && pnpm --filter api test:integration && pnpm --filter web test`.

**Acceptance/safety:** harnesses cannot target dev/prod. Revert config/dependencies if isolation fails.

## Task 2: Define exhaustive shared contracts

**Depends on:** 1

**Paths:** create `packages/shared/src/domain/{assistant,support,knowledge}/` enum/type/DTO/event barrels and `packages/shared/src/schemas/{assistant,support,knowledge}/`; modify auth/LLM contracts and `packages/shared/src/index.ts`; add contract tests.

- [ ] Define shared enums for role; canonical mode/status; author/message/generation; participant/assignment; handoff; archive restore; cursor scope; recipient/topic; durable/ephemeral/stream events; widget/local-send/connection; presence/capacity; audit; tool; corpus/release/ingestion; embedding metric/space; limiter readiness/reservation/lease/reconcile; usage/error.
- [ ] Define every customer/support/admin REST DTO and both SSE payload families.
- [ ] Add Zod bounds for content, pagination, cursor, filters and bodies.
- [ ] Extend `JwtPayload`, `AuthenticatedRequest`, `UserDto` and LLM stream result with session/version/terminal/usage data.
- [ ] Test exhaustive enum→schema/event/error-message-key coverage.

**Verify:** `pnpm --filter @repo/shared build`; shared contract tests.

**Acceptance:** subsequent code needs no local discriminator. Do not commit `dist`.

## Task 3: Add pgvector local/test infrastructure

**Depends on:** 1

**Paths:** modify `docker-compose.yml`, `docker/postgres/init.sql`, health module; create `docker-compose.integration.yml`.

- [ ] Pin a PostgreSQL-16-compatible `pgvector/pgvector` image while retaining major version and existing volume name.
- [ ] Add only `CREATE EXTENSION IF NOT EXISTS vector` to init SQL; schema remains migration-only.
- [ ] Add disposable integration Postgres/Redis services and health checks.
- [ ] Health-check extension, configured embedding space/dimension and metric operator/opclass.
- [ ] Test `<=>`, `<->`, `<#>` and opclass availability.

**Verify:** integration compose up; pgvector health integration test.

**Safety:** require `pg_dump` before any real-volume image switch; never delete a retained volume.

## Task 4: Build shared Redis provider

**Depends on:** 1, 3

**Paths:** create `apps/api/src/common/redis/{redis.module.ts,redis.service.ts,redis.config.ts,redis-key.ts,redis-health.indicator.ts}`; modify app module, env validation and dependencies.

- [ ] Centralize validated options shared with BullMQ.
- [ ] Provide distinct command, publisher and subscriber clients/factory, namespace helper, Lua loading, reconnect health and graceful shutdown.
- [ ] Test cross-instance pub/sub, `NOSCRIPT` reload, reconnect and cleanup using real Redis.

**Acceptance:** no Queue internals or subscriber connection is used for commands.

## Task 5: Persist rotating auth sessions and roles

**Depends on:** 2, 4

**Paths:** migration 041; create auth session repository/service, roles decorator/guard, privileged-session guard; modify auth service/controller/module/strategy/cookies, Google auth, shared/web auth state.

- [ ] Add `users.role`, `users.session_version`, support profile/capacity, and refresh sessions containing session/family IDs, keyed secret hash, issued/last-used/expiry/revoke/reuse state.
- [ ] Replace stateless refresh authority with opaque rotating cookie secret; store only hash. Reuse revokes family atomically.
- [ ] Issue default five-minute access token with `sub`, session ID, version, `iat/exp`; role claim is informational.
- [ ] Validate all auth against current session/user/version; privileged guard also loads current DB role.
- [ ] Password change/deactivation/logout/role change revoke correct sessions. Password, Google and verification share issuer.
- [ ] Test concurrent refresh, rotation replay, family revoke, logout, expiry, stale access, role revoke and Google path.

**Verify:** auth unit + real DB integration tests.

**Safety:** deploy migration before code; legacy refresh cookies intentionally require re-login, never permissive fallback.

## Task 6: Create canonical conversation/support schema

**Depends on:** 2, 5

**Paths:** migration 042 and migration integration test.

- [ ] Create conversations, participants, assignment history, support state, summaries and archive/delete restore snapshot.
- [ ] DB-check exactly: `OPEN+AI`, `OPEN+WAITING_FOR_SUPPORT`, `OPEN+HUMAN`, `RESOLVED+AI`, `ARCHIVED+AI`, `DELETED+AI`.
- [ ] Add one-active participant/assignment constraints, client conversation idempotency, counters and tenant/queue/history/retention indexes.
- [ ] Test invalid combinations and assignment races.

**Acceptance:** DB rejects every noncanonical state.

## Task 7: Create messages/generation schema

**Depends on:** 6

**Paths:** migration 043 and integration test.

- [ ] Create messages, attempts, citations and summary revisions with author/status checks.
- [ ] Add unique conversation sequence, partial client-message idempotency, retry numbering and one-active-generation constraint.
- [ ] Add nullable `llm_usage_log_id`; attempt token columns are diagnostic, not authority.
- [ ] Race-test sequence allocation and duplicate sends.

## Task 8: Create leased outbox/audit schema

**Depends on:** 6, 7

**Paths:** migration 044 and integration test.

- [ ] Create BIGSERIAL metadata-only outbox with event UUID, recipient kind/user/topic, conversation/sequence, aggregate/version, lease/retry/dispatched/dead-letter/expiry fields.
- [ ] Create content-free support audit with allowlisted metadata and keyed IP/UA hashes.
- [ ] Index ordered replay, topic/user auth, lease takeover and cleanup.
- [ ] Test `SKIP LOCKED`, takeover, retry/dead letter and ordered topic/user replay.

**Acceptance:** schema has no payload/content/preview column.

## Task 9: Create atomic knowledge corpus schema

**Depends on:** 2, 3

**Paths:** migration 045 and integration test.

- [ ] Create documents, locale versions, non-vector chunks, immutable release manifests/items and one active pointer.
- [ ] Require complete EN/TR pairs, checksums, versions and source uniqueness.
- [ ] Test partial publication rejection, immutability and pointer rollback.

## Task 10: Create embedding spaces

**Depends on:** 3, 9

**Paths:** migration 046 and integration test.

- [ ] Create `(provider,model,dimensions,distance_metric)` registry; bind each release to one space.
- [ ] Create explicitly supported physical `vector(n)` tables and matching cosine/L2/IP indexes; no padding/truncation/mixing.
- [ ] Add FTS GIN indexes and health introspection.
- [ ] Test operators, index plans, wrong dimensions and release-space mismatch.

## Task 11: Create quota ledger/readiness schema

**Depends on:** 5, 7

**Paths:** migration 047 and integration test.

- [ ] Create limiter state/checkpoints, user/provider reservations, concurrency leases and idempotent reconciliation records by generation/source/window.
- [ ] Store estimates/actuals/status/expiry, never content.
- [ ] Test duplicate reserve/reconcile, expiry and readiness compare-and-swap.

## Task 12: Extend usage/pricing

**Depends on:** 7, 11

**Paths:** migration 048; modify `llm-usage.service.ts`; tests.

- [ ] Add nullable generation/conversation/message/source/provider/estimated attribution to `llm_usage_log` with bounded locks.
- [ ] Add effective-dated prompt/completion/embedding pricing and aggregate indexes.
- [ ] Return usage row ID; assistant accounting is awaited, content logging stays fail-soft but limiter-accounted.
- [ ] Test unknown prices, effective dates and FK deletion behavior.

## Task 13: Implement tenant-scoped repositories

**Depends on:** 6–12

**Paths:** create repositories under `assistant/repositories`, `support/repositories`, `knowledge/repositories` and integration tests.

- [ ] Use explicit columns/row mappers; transaction methods accept `PoolClient`.
- [ ] Scope tenant/support visibility in SQL; separate queue preview from full history.
- [ ] Implement atomic sequence, message+outbox, transition+assignment+participant+audit+outbox, release and quota operations.
- [ ] Allowlist dynamic sort/filter columns.
- [ ] Cross-tenant-test every read/write.

**Acceptance:** no unscoped tenant repository method exists.

## Task 14: Implement state machine and durable conversation/message services

**Depends on:** 2, 13

**Paths:** create assistant state machine/constants/conversation/message/retention services and tests.

- [ ] Encode request/cancel, claim/release/transfer/return, resolve, reopen-AI/support, archive/unarchive, delete/restore.
- [ ] Implement list/detail/create/rename/read and dedicated lifecycle methods; generic patch only renames.
- [ ] Implement support-mode customer POST only for waiting/human; persist message+outbox transactionally and never call AI.
- [ ] Implement idempotency, monotonic read clamp, title derivation, pagination and retention eligibility.
- [ ] Exhaustively test transitions, active-support delete, restore and unread excluding own/system messages.

## Task 15: Implement signed cursor

**Depends on:** 2, 13

**Paths:** create `assistant-cursor.service.ts` and tests; modify env validation.

- [ ] Base64url v1 JSON + HMAC-SHA-256 with constant-time comparison.
- [ ] Validate subject, shared scope, BIGINT `after`, `iat/exp` and retention.
- [ ] Collapse invalid/foreign/expired behavior to `EVENT_CURSOR_INVALID` or `RESYNC_REQUIRED` without leakage.
- [ ] Test tamper, malformed/oversized, foreign scope/user and expiry.

## Task 16: Implement durable outbox dispatch/live fan-out

**Depends on:** 4, 8, 13, 15

**Paths:** create assistant event service, registry, outbox processor/scheduler; queue/module wiring and tests.

- [ ] Write metadata events in domain transactions; use durable `SUPPORT_QUEUE` topic, never user snapshots.
- [ ] Lease with `SKIP LOCKED`, bounded backoff, takeover and dead letter; BullMQ only wake/sweep.
- [ ] Redis publishes IDs; API instances authorize topic delivery using current role.
- [ ] Implement high-watermark→subscribe→ordered replay→buffer→live with event-ID dedup.
- [ ] Test duplicate publish, replay/live race, takeover and revoked-role topic denial.

## Task 17: Add generic SSE transport

**Depends on:** 1, 2

**Paths:** create `apps/api/src/common/sse/{sse-writer.ts,sse.types.ts}` and tests.

- [ ] Implement no-buffer/no-compression headers, typed framing, heartbeat comments, writable/close and abort cleanup.
- [ ] Test CRLF, escaping, duplicate close and write-after-close.

## Task 18: Implement support assignment, history, transfer, audit and presence

**Depends on:** 4, 5, 13, 14, 16

**Paths:** create support module/services/constants and tests.

- [ ] Implement queue/list/full-history visibility, claim/release/resolve/reopen-support/return-to-AI and durable messages.
- [ ] Atomic direct transfer locks row; verifies current assignee/admin, target current support role, distinct target, `ONLINE_AVAILABLE`, capacity; closes old assignment/participant, opens new, audits/notifies in one transaction; races return 409.
- [ ] Former assigned agent retains audited read-only full history while role remains; no reply/transition.
- [ ] Implement connection-scoped Redis heartbeat, availability preference, TTL, multi-tab derived presence and capacity.
- [ ] Presence/typing remain ephemeral; no durable `PRESENCE_UPDATED`.

**Verify:** claim/transfer races, former-agent, admin override, role revoke, TTL/multi-tab/capacity integration tests.

## Task 19: Implement exact shared provider limiter and recovery

**Depends on:** 4, 11–13

**Paths:** create provider limiter/recovery/Lua in `modules/llm`; assistant limiter/token estimator; tests.

- [ ] Stage 1 atomically consumes user RPM and acquires user/global concurrency before any message.
- [ ] Stage 2 reserves exact prompt + max completion + embedding/classifier/summary estimate against user daily and provider-minute budgets; persist ledger first.
- [ ] Failure releases lease and creates no message; success permits transactional messages/attempt.
- [ ] Share provider RPM/TPM/concurrency across assistant, content AI, embedding, summary and classifier. Content AI does not consume assistant daily quota.
- [ ] Reconcile idempotently from authoritative usage log.
- [ ] Redis startup/loss sets not-ready; rebuild current windows/leases from PostgreSQL, verify checkpoint, atomically mark ready. All provider calls fail closed before then.
- [ ] Multi-instance test exact boundaries, crash leases, duplicate reconcile, Redis flush/rebuild and competing sources.

## Task 20: Harden LLM stream/accounting contract

**Depends on:** 2, 12, 19

**Paths:** modify LLM service/types/usage/module/specs and listing content tests.

- [ ] Expose terminal observed, finish reason and stream usage while preserving accumulated snapshots/content API compatibility.
- [ ] Distinguish caller abort from timeout and clean reader/listeners.
- [ ] Route all provider sources through shared limiter with attribution.
- [ ] Assistant awaits usage/reconcile and links attempt; preserve listing create-only AI behavior.
- [ ] Test `[DONE]`, usage, natural close, abort, 429, malformed/no usage.

## Task 21: Author curated EN/TR corpus and safe chunker

**Depends on:** 2, 9

**Paths:** create `docs/help/manifest.json`, paired `docs/help/{en,tr}/*.md`; knowledge manifest/frontmatter/chunker and tests.

- [ ] Author all 18 approved groups: onboarding; eBay; Amazon accounts; listings; drafts; groups; repricing/quantity; orders/linking; confirmed/estimated profit; auto cost-capture; auto-fulfill prerequisites/dry-run; tracking; store settings; Google; content AI; assistant/support; troubleshooting; privacy.
- [ ] Preserve A2 proxy + real account + dry-run selector-tuning gate; exclude internal selectors/secrets.
- [ ] Explicit manifest lists locale pairs/version/checksums/visibility under resolved help root.
- [ ] Strictly parse and token-chunk by headings with stable hashes.
- [ ] Reject path traversal/symlink, missing locale, unlisted/internal paths.

**Acceptance:** 18 complete EN/TR pairs and stable golden chunks.

## Task 22: Implement embeddings and hybrid retrieval

**Depends on:** 10, 19–21

**Paths:** create embedding provider/service, retrieval, RRF/confidence and tests.

- [ ] OpenAI-compatible embedding calls use shared limiter/accounting.
- [ ] Reject nonfinite or wrong-dimension vectors; never pad/truncate.
- [ ] Locale-first FTS/vector candidates, correct metric operator, RRF, dedup, confidence and locale fallback.
- [ ] Return citation candidates only from active published release.
- [ ] Test RRF/confidence/locale plus real pgvector and EN/TR golden evaluation thresholds.

## Task 23: Implement atomic ingestion/release

**Depends on:** 9, 10, 19, 21, 22

**Paths:** create knowledge module/controller/admin/ingestion service+processor, CLI script, queue wiring, package scripts and tests.

- [ ] Add validate, dry-run, ingest, publish, status and rollback commands/APIs.
- [ ] Build one candidate: validate all pairs, parse/chunk/embed into one space; one failure fails entire candidate.
- [ ] Transactionally publish immutable manifest/items and swap one active pointer only after all validation.
- [ ] Idempotent checksums/job keys, bounded retries, sanitized diagnostics.
- [ ] Test mid-batch failure, retry, simultaneous publish, rollback and model-space replacement.

## Task 24: Implement allowlisted read tools/context

**Depends on:** 2, 13, 19, 22

**Paths:** create context router/service, tool service/output validator and seven adapters under `assistant/tools/`; tests.

- [ ] Deterministic router, bounded provider-limited classifier only when necessary.
- [ ] Implement `ACCOUNT_OVERVIEW`, `DASHBOARD_SUMMARY`, `LISTINGS_SUMMARY`, `LISTING_DETAIL`, `ORDERS_SUMMARY`, `ORDER_DETAIL`, `STORE_SETTINGS_SUMMARY`.
- [ ] Authoritative user ID is injected server-side; IDs are SQL-scoped; rows/ranges/text bounded.
- [ ] Exclude credentials, tokens, addresses/unneeded buyer PII and secrets.
- [ ] Build bounded context layers and treat RAG as untrusted reference.
- [ ] Validate output/citations; test cross-tenant IDs, injection, destructive requests, PII omission and allowlist.

## Task 25: Implement generation, snapshots, summary and retention

**Depends on:** 14, 16, 19, 20, 22–24

**Paths:** create generation service, summary/retention processors, output validator/module wiring and tests.

- [ ] Canonical order: auth/mode → Stage 1 → context → Stage 2/ledger → transactional user+placeholder+attempt+outbox → provider.
- [ ] Abort before headers: no provider, release budget/lease, no message if uncommitted.
- [ ] Abort after headers: signal provider, periodic committed snapshots, best-effort flush, mark incomplete; no guarantee for final crash interval.
- [ ] Publish completed only after final content/citations/usage/reconcile commit.
- [ ] Retry creates new attempt/assistant message, never duplicate user; one active generation.
- [ ] Summary uses shared limiter. Retention covers 7d outbox, 12m conversations/diagnostics, 24m audit/usage, failed ingestion and delete grace.
- [ ] Inject failures at every seam and test idempotent cleanup.

## Task 26: Expose customer REST and two SSE streams

**Depends on:** 5, 14–17, 25

**Paths:** create assistant/controllers/DTOs; module/app wiring; API tests.

- [ ] Expose list/create/detail/history/rename/read and dedicated archive/unarchive/reopen-AI/reopen-support/delete/restore/support request/cancel/durable support-mode message.
- [ ] Expose normal stream and dedicated retry-stream; preflight before headers.
- [ ] Generation heartbeat 15s, inbox 20s as comments; heartbeat checks token expiry and closes with `AUTH_EXPIRED`.
- [ ] Inbox signed replay/live/rotation; metadata events trigger REST invalidation/refetch.
- [ ] Safe HTTP pre-stream and typed SSE mid-stream errors; foreign/nonexistent IDs indistinguishable.

## Task 27: Expose support/presence APIs

**Depends on:** 5, 18, 26

**Paths:** create support and presence controllers/DTOs, wiring and tests.

- [ ] Queue/assigned/open/resolved/search/preview/full-history; claim/release/transfer/reply/read/resolve/reopen-support/return-to-AI.
- [ ] Presence preference/heartbeat/eligible transfer targets.
- [ ] Current DB role/session guard on every read/mutation; audited opening/action.
- [ ] Test role revoke, former-agent read-only, capacity/presence race and topic refetch.

## Task 28: Expose admin APIs and role CLI

**Depends on:** 5, 12, 18, 23, 27

**Paths:** create support/assistant admin controllers, `apps/api/src/scripts/user-set-role.ts`, package script and tests.

- [ ] Role/agent capacity, availability, limiter/usage/pricing, outbox/dead-letter, corpus/release/ingestion/health endpoints.
- [ ] Aggregates expose no prompt/message content.
- [ ] Add operator-only `user:set-role --email --role`; no HTTP bootstrap/self-promotion. Revoke sessions and audit role change.
- [ ] Test current-admin authority, role revoke and redaction.

## Task 29: Share frontend authenticated request and SSE parser

**Depends on:** 1, 2, 5, 26

**Paths:** create `apps/web/src/api/{authenticatedRequest.ts,authRefreshCoordinator.ts}`, refactor `baseApi.ts`; create assistant RTK/stream/event clients and parser; tests.

- [ ] One memory-token/cookie/request-ID/single-flight refresh coordinator serves RTK and streams; retry 401 once and preserve abort.
- [ ] Parse incremental LF/CRLF events/comments, snapshots/revisions, unknown events and terminal requirements.
- [ ] Inbox reconnect with jitter/backoff/online retry, cursor memory-only, refresh/reconnect and REST invalidation.
- [ ] Add Assistant/Support/Admin cache tags.

**Acceptance:** no duplicate refresh race, token storage or token query parameter.

## Task 30: Build complete customer AssistantWidget

**Depends on:** 2, 26, 29

**Paths:** refactor `features/assistant/AssistantWidget`; create four-file conversation list/thread/message/composer/citation/context/handoff modules and hooks/API; add UI primitives only in `packages/ui`; tests.

- [ ] Persisted collapsed unread/list/thread/history; new conversation replaces refresh; rename/archive/delete/restore/reopen.
- [ ] Optimistic reconcile, snapshots, cancel, incomplete retry, citations/context, support-mode durable messages, handoff/presence/resolution.
- [ ] Safe Markdown allowlist/internal citations and XSS tests.
- [ ] Scroll anchoring, keyboard/focus/live regions, responsive/offline behavior.
- [ ] Enforce four-file/design-system/i18n rules.

## Task 31: Build support console

**Depends on:** 27, 29

**Paths:** create four-file support pages/components/hooks/API; modify `App.tsx`, `routeMeta.ts`, navigation; tests.

- [ ] Waiting/assigned/open/resolved/search/filter, customer summary, unread/presence/capacity.
- [ ] Claim/release/direct transfer/reply/read/resolve/reopen/return-to-AI and audit timeline.
- [ ] Former-agent history is read-only; heartbeat only while active.
- [ ] Role-aware route UX with authoritative backend failure handling.

## Task 32: Build admin operations UI

**Depends on:** 28, 29

**Paths:** create four-file admin assistant page/role/knowledge/usage/limiter/outbox modules; routing/nav; tests.

- [ ] Role/capacity management via `MessageModal` confirmation.
- [ ] Corpus candidate/active/failed, validate/dry-run/ingest/publish/rollback.
- [ ] Availability, limiter recovery, provider/embedding health, usage/cost/unknown pricing, outbox/dead letters.
- [ ] Never render prompts/messages/credentials/raw errors.

## Task 33: Complete EN/TR i18n

**Depends on:** 2, 30–32

**Paths:** add/register `packages/shared/src/i18n/resources/{en,tr}/{assistant.json,support.json,admin.json}` and necessary translation keys; tests.

- [ ] Translate every label/status/action/error/empty/offline/rate-limit/citation/accessibility/confirmation.
- [ ] Follow namespace wrapper/dot and cross-translation colon conventions.
- [ ] Test equal key trees and exhaustive enum/error mapping.
- [ ] Remove placeholder chatbot copy only after references migrate.

## Task 34: Complete API integration and fake-provider E2E

**Depends on:** 26–28

**Paths:** expand `apps/api/test/integration`; create fake LLM/embedding/clock and assistant-support E2E.

- [ ] Run migrations 000–048 from zero on real pgvector/Redis.
- [ ] Cover vector index/operator, atomic release, Redis rebuild fail-closed, leased takeover, topic current-role auth/refetch, multi-instance limiter race, tenant isolation, refresh reuse and transaction rollback.
- [ ] Fake stream: normal/usage/done, CRLF, delay, timeout, midstream, natural close, abort, 429, malformed/no usage/unsafe/invalid citation.
- [ ] E2E customer create/stream/cite/handoff/message; support claim/reply/transfer; customer reconnect/unread; resolve/return/reopen/delete/restore; role revoke.

## Task 35: Complete web integration/browser smoke

**Depends on:** 29–33

**Paths:** web unit/component tests, Playwright config and `apps/web/e2e/assistant-support.spec.ts`.

- [ ] Test widget reconcile/snapshots/out-of-order/dedup/cancel/retry/resync/offline/unread/handoff.
- [ ] Test Markdown XSS, citations, keyboard/focus/live regions and responsive layout.
- [ ] Test support transfer/former-agent and admin role/corpus/health.
- [ ] Run browser smoke against fake API and disposable services only.

## Task 36: Add env, health, metrics and alerting

**Depends on:** 3, 16, 19, 23, 25, 28

**Paths:** modify `.env.example`, env validation, health/logging/metrics and production config examples.

- [ ] Validate capability flags; access/cursor/retention; SSE; provider limiter RPM/TPM/concurrency/daily; embedding model/dimension/metric; outbox lease; presence/capacity; snapshots/summary; pricing.
- [ ] Require cryptographic/provider configuration with no insecure defaults and safe numeric bounds.
- [ ] Content-free logs/metrics: generation, quota/cost, limiter readiness, outbox lag/dead letter, corpus/retrieval, support queue/SLA/presence.
- [ ] Add degraded/down semantics and alert thresholds; document proxy buffering/timeouts.

## Task 37: Write operations runbooks

**Depends on:** 36

**Paths:** create `docs/operations/assistant/{local-setup.md,production-readiness.md,knowledge-ingestion.md,support-operations.md,provider-and-embedding.md,rate-limits-and-cost.md,incident-response.md,retention-and-deletion.md}`.

- [ ] Exact backup/pgvector volume migration, provider/space/reindex/release, limiter Redis recovery/checkpoint, outbox lag/takeover, SSE buffering, usage spikes, role revoke, queue overload, capability disable, corpus rollback and retention dry-run procedures.
- [ ] Include commands, expected outputs, escalation and rollback.
- [ ] Explicitly exclude operations docs from customer manifest.

## Task 38: Update `CLAUDE.md`

**Depends on:** 33–37

- [ ] Document implemented architecture/state/SSE/auth/outbox/RAG/tools/limiter/queues/env/migrations/tests/pgvector/support/admin/retention/key files.
- [ ] State read-only assistant and no destructive tools.
- [ ] Remove “Deferred to C” only after every acceptance checkpoint passes; preserve A2 gates.

## Task 39: Full validation and security gate

**Depends on:** 1–38

- [ ] Fresh disposable pgvector/Redis: migrations 000–048, seed roles/pricing, limiter rebuild, atomic EN/TR publish.
- [ ] Run shared/UI builds, API unit/integration, web unit/E2E, `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- [ ] Rehearse disabled capabilities, Redis loss/recovery, provider outage/429, embedding mismatch, old cursor resync, outbox crash/takeover, role revoke, corpus rollback and retention dry-run.
- [ ] Security review: tenant isolation; session reuse/current roles; SSE expiry/abort/terminal/replay; topic auth; SQL/tool allowlists; prompt injection/path escape/citation fabrication; PII/log/audit/outbox minimization; Markdown XSS; limiter bypass/retry/lease/reconcile; admin bootstrap.
- [ ] Fix every confirmed finding and rerun full gates; no finding may be deferred from approved scope.

**Acceptance:** clean checkout passes all gates and every canonical §7.19 criterion traces to an automated test or explicit operational checkpoint.

## Task 40: Mandatory user approval before implementation

**Depends on:** plan review only; execute this gate before Task 1.

- [ ] Report this 40-task plan, migration 041–048 map, dependencies, safety model and any blocker.
- [ ] Ask user to approve/request changes/reject.
- [ ] Make no product, schema, compose, corpus, env, operations or `CLAUDE.md` changes before explicit approval.
- [ ] Recheck migration numbering immediately before implementation; revise and reapprove if it changed.

---

## Acceptance checkpoints

1. **Foundation (1–5):** isolated harnesses, exhaustive contracts, pgvector/Redis healthy, rotating persisted sessions and authoritative role revocation.
2. **Durability (6–18):** migrations 041–048 from zero; DB rejects invalid states; scoped repositories, metadata outbox/replay and full support transfer/history/presence pass races.
3. **Intelligence/accounting (19–25):** exact recoverable fail-closed shared limiter; atomic EN/TR one-space release; grounded citations; read-only tenant tools; consistent generation/accounting.
4. **Complete product (26–33):** all customer/support/admin APIs and UI, two authenticated SSE streams, accessible design-system-compliant EN/TR experience.
5. **Release readiness (34–39):** API/web/E2E/full validation green, runbooks and `CLAUDE.md` accurate, zero unresolved security findings. Customer activation remains disabled until operator readiness.

## Global rollback/safety

- Disable assistant/support/knowledge capabilities independently; preserve history/outbox.
- Never drop migrations/tables automatically; forward-fix.
- Roll knowledge back by atomic pointer swap to immutable prior release.
- Never mutate active vectors or mix spaces; reindex a new release.
- Redis loss stays fail-closed until verified ledger rebuild marks ready.
- Persisted-session rollout may force re-login; never accept legacy stateless refresh fallback.
- Disable SSE if proxy buffering is wrong; never use query-string bearer tokens.
- Back up PostgreSQL before pgvector image/extension or production migrations; never delete volumes.

## Definition of done

Spec C is complete only after Tasks 1–39 and all checkpoints pass, migrations 041–048 apply from a clean database, the complete initial EN/TR corpus publishes atomically, all test/security/operations gates are green, and the implemented result is reviewed by the user. This document remains planning-only until Task 40 receives explicit approval.
