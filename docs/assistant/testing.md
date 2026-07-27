# Zon Assistant Testing and Runtime Acceptance

## Fast checks

```bash
pnpm --filter api typecheck
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter api exec jest --runInBand
```

Focused frontend coverage currently includes the shared auth refresh coordinator and incremental SSE parser. Backend suites cover pure state, cursor, context, tooling, projection, limiter/usage, queue observability, and role CLI helpers.

## Full static/build gates

```bash
pnpm lint
pnpm typecheck
pnpm build
```

The pre-commit hook runs `pnpm lint`. Do not bypass it. Fix lint errors at their source; do not add `eslint-disable` comments.

Package source is consumed from `dist`, so rebuild after changing shared contracts or UI primitives:

```bash
pnpm --filter @repo/shared build
pnpm --filter @repo/ui build
```

## Infrastructure integration harness

Assistant integration tests require real PostgreSQL/pgvector and Redis behavior. The repository contains:

- `apps/api/jest.integration.config.js`
- `apps/api/test/integration/`
- `docker-compose.integration.yml`

Run the integration command documented by `apps/api/package.json` after starting the required containers:

```bash
pnpm --filter api test:integration
```

Do not interpret a pure-unit pass as proof that migrations, pgvector indexes, Redis scripts, or BullMQ behavior work in the target environment.

## Runtime smoke-test checklist

After deploying or changing assistant infrastructure:

1. Start from a database that has migrations 041–051 applied.
2. Verify API health reports PostgreSQL, Redis, and pgvector readiness.
3. Log in as a customer and create a conversation.
4. Send an AI message and confirm generation SSE observes both message completion and stream completion.
5. Interrupt a stream and verify the conversation keeps a durable incomplete state and offers retry.
6. Close/reopen the widget and verify REST history remains correct.
7. Trigger/reconnect the inbox stream and verify signed-cursor replay without duplicate messages.
8. Request support; verify queue visibility, claim, reply, transfer, resolve, and return-to-AI with SUPPORT credentials.
9. Revoke the support role and confirm the existing privileged session can no longer mutate or read unauthorized data.
10. Run knowledge validate → dry-run → ingest → publish, then verify retrieval returns only the active release.
11. Roll back to the previous release and verify retrieval switches atomically.
12. Open admin views as ADMIN and confirm they contain aggregates only—no prompts, messages, credentials, raw job payloads, or raw provider errors.
13. Confirm CUSTOMER sessions receive 403/404-equivalent responses for privileged routes.

## Provider acceptance

Local development can use Ollama; production/bulk use should use a configured hosted OpenAI-compatible provider. Test at least:

- successful response,
- timeout/abort,
- 429 with bounded Retry-After,
- provider unavailable,
- user/global capacity limit,
- usage attribution on success and failure.

Runtime acceptance is environment-specific. A successful repository build means the code compiles; it does not replace a live provider/database/Redis smoke test.
