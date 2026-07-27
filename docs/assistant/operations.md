# Zon Assistant Operations

## Role management

Roles are changed only from an authenticated server/operator shell. There is no role bootstrap, self-promotion, or role-change HTTP endpoint.

```bash
pnpm --filter api user:set-role -- --email user@example.com --role support
pnpm --filter api user:set-role -- --email admin@example.com --role admin
```

Accepted roles come from the shared `UserRole` enum: `customer`, `support`, and `admin`.

A real change runs transactionally:

1. Lock the target user.
2. Update the role.
3. Increment/invalidate the security session version through the database security trigger.
4. Revoke active refresh sessions explicitly as defense in depth.
5. Write a redacted `ROLE_CHANGE` audit row in the same transaction.

Exit codes: `0` success/no-op, `2` invalid arguments, `3` user not found, `1` database/runtime failure.

## Knowledge corpus lifecycle

Canonical content lives under `docs/help/` with EN/TR documents and `docs/help/manifest.json`.

The admin knowledge API and script support:

1. **Validate** — check manifest/frontmatter/checksums without changing active retrieval.
2. **Dry-run** — calculate the proposed ingestion result without publishing.
3. **Ingest** — queue document versions, chunks, and embeddings into a candidate release.
4. **Publish** — atomically activate a validated release.
5. **Rollback** — atomically reactivate a previous valid release.

Useful script entry point:

```bash
pnpm --filter api knowledge -- <command>
```

The exact command options are implemented in `apps/api/src/scripts/knowledge.ts`. Prefer validate and dry-run before ingesting a changed corpus. Publishing and rollback must never leave multiple active releases.

## Admin observability

Read-only admin APIs include:

- `GET /v1/admin/overview`
- `GET /v1/admin/usage/summaries`
- `GET /v1/admin/queues/health`
- `GET /v1/admin/queues/observations`
- `GET /v1/admin/queues/observations/:id`
- `GET /v1/admin/finops/users`
- `GET /v1/admin/finops/providers`
- `GET /v1/admin/operations/summary`

Queue observation collection is controlled by:

- `QUEUE_OBSERVABILITY_ENABLED`
- `QUEUE_OBSERVABILITY_RETENTION_DAYS`
- `QUEUE_OBSERVABILITY_RETENTION_CRON`

Warnings use:

- `ADMIN_QUEUE_WAITING_THRESHOLD`
- `ADMIN_KEEPA_LOW_TOKENS_THRESHOLD`
- `ADMIN_LLM_FAILURE_RATE_THRESHOLD`

The admin layer is read-only and must remain redacted. Never add prompt text, message bodies, credentials, raw BullMQ payloads, or raw provider errors to its DTOs or UI.

## Limiter and provider troubleshooting

When generation is unavailable:

1. Check API health, Redis health, and pgvector health.
2. Check provider base URL/model/API key configuration.
3. Inspect limiter readiness and queue health rather than bypassing the limiter.
4. Review append-only LLM usage rows and redacted operations summaries.
5. For Ollama, confirm the container is running and the configured model has been pulled.

Do not add a fail-open path around global/user token or concurrency limits. Provider and Redis errors must surface as typed assistant availability/rate-limit errors.

## Support operations

Support access requires a current SUPPORT or explicitly permitted ADMIN session. Role revocation invalidates existing privileged sessions. Presence heartbeats should run only while the support console is active.

A support conversation follows queue → claim → reply/transfer → resolve or return-to-AI transitions. Former assignees may retain audited read-only history where allowed, but must not regain mutation access from stale frontend state.

## Retention and privacy

Assistant messages, events, audits, and queue observations have separate retention policies. Retention jobs must operate on the owning tables and must not delete active conversation state. Admin views and logs should identify aggregates and correlation IDs without duplicating customer content.
