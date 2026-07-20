# B — Shared LLM Infra + Content-AI Refactor (Design)

**Date:** 2026-07-20
**Status:** Draft, awaiting user review
**Scope:** Backend (`apps/api`) — new `LlmModule` + `LlmService`, migrate `ContentGenerationService` off Ollama-native `/api/generate` onto an OpenAI-compatible client, bundle Ollama into docker-compose. No frontend, no DB, no assistant (that is spec C).

---

## Roadmap context

Third of four sequenced specs. A1 (net profit) + A1.1 (estimated profit) + A2 (auto-fulfill) are done on `development`. B is the shared LLM foundation that C (assistant) builds on.

| Spec | Title | Status |
|---|---|---|
| A1 / A1.1 | Net profit correctness / estimated profit | Done |
| A2 | Automated Amazon fulfillment | Done (code; proxy + dry-run gating external) |
| **B** | **Shared LLM infra + content-AI refactor** (this doc) | Design |
| C | Assistant backend (RAG + ticket escalation) | Future — consumes B's `LlmService` |

B decouples Zonds from Ollama's native `/api/generate` and from a single provider. The OpenAI-compatible Chat Completions client means the provider is swapped by env (`LLM_BASE_URL` + `LLM_API_KEY`) only — Ollama (local/CPU) today, a hosted OpenAI-compatible provider or vLLM (GPU) later, code unchanged. This is the explicit hosting constraint: **no GPU anywhere** (local PC CPU; Coolify test VPS = 4 vCPU / 16 GB RAM / no GPU, already loaded with Postgres + Redis + Playwright).

---

## Problem statement

`apps/api/src/modules/listings/content-generation.service.ts` is a working but **provider-locked** integration:

- Calls Ollama's native `POST {baseUrl}/api/generate` with a single `prompt` string (`response` field, `options.temperature`, `num_predict`).
- Hardcoded to Ollama's response shape; cannot target vLLM, Groq, OpenRouter, or any OpenAI-compatible endpoint without rewriting the transport.
- Mixing provider transport (fetch + Ollama shape + timeout) with domain logic (prompt construction, `cleanTitle`, `cleanDescription`, `escapeHtml`) in one 225-line file.
- No streaming — the future assistant (spec C) needs token-by-token streaming for a live chat UX, and there is no shared seam to reuse.

Spec C ("Zon" assistant) needs the same LLM transport but with streaming, conversation shape (`LlmMessage[]`), and a different (larger) model. Without B, C would either re-implement transport (drift) or force a premature content-gen rewrite under C's scope.

What B adds:

1. **`LlmService`** — one OpenAI-compatible Chat Completions client (`chat()` non-streaming + `chatStream()` SSE), provider-agnostic via env. Both content-gen (B) and the assistant (C) inject it.
2. **Per-use-case models** — content rewrites use a small/fast model; the assistant uses a larger TR-friendly model. One client, env-driven model per `purpose`.
3. **Content-gen migration** — `ContentGenerationService` drops its Ollama-native transport and calls `LlmService.chat()` with the same prompts + same post-processing + same fallback. Behavior identical; provider becomes swappable.
4. **Ollama in docker-compose** — `ollama` service (dev + production compose) with a persistent volume, so `pnpm docker:up` starts it alongside Postgres/Redis. No auto-pull (boot-blocking); documented one-shot pull command.

---

## Design goals

1. **Provider-swappable by env only** — `LLM_BASE_URL` + optional `LLM_API_KEY`. Ollama (no key) today; hosted OpenAI-compatible (bearer token) or vLLM (GPU) later, no code change.
2. **Reuse for C** — `chatStream()` ready now so the assistant does not reopen the transport.
3. **No regression to content-gen** — same prompts, same `cleanTitle`/`cleanDescription`, same fail-to-base fallback, same create-only gate. Only the transport changes.
4. **Lean** — one `@Injectable` service + one small pure SSE parser. No provider registry, no `forRoot` config module, no DB, no retry layer. YAGNI.
5. **Honest failure** — `LlmService` throws typed errors; callers decide fallback. Never silently swallow.

Explicitly **out of scope / deferred to C:**
- Assistant backend (chat API, conversation persistence, RAG, streaming endpoint, FE wiring).
- Conversation storage (any DB table).
- Model auto-pull / health endpoint.
- Rate-limiting / token budgeting (C, when assistant concurrency is known).
- Bulk historical content rewrite (still create-only; bulk is a separate offline batch).

---

## Architecture

### 1. Data model & env

No DB table. LLM is stateless. Shared types live in `packages/shared/src/domain/llm/`:

```ts
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmChatOptions {
  /** Override the per-purpose model for this call. */
  model?: string;
  /** Selects the default model when `model` is omitted. */
  purpose?: 'content' | 'assistant';
  temperature?: number; // default 0.4
  maxTokens?: number;   // default 512
  timeoutMs?: number;   // default LLM_TIMEOUT_MS (30000)
  /** Caller-supplied abort signal (in addition to the internal timeout). */
  signal?: AbortSignal;
}

export interface LlmChatChunk {
  /** Accumulated text so far for a streaming call. */
  delta: string;
  /** The model that served the call. */
  model: string;
  /** True on the final chunk (SSE `data: [DONE]`). */
  done: boolean;
}

export interface LlmChatResult {
  text: string;
  model: string;
}
```

`LlmChatChunk` carries the **accumulated** delta (not the raw incremental token) so streaming consumers do not have to reassemble — the service keeps a running buffer. (Alternative considered: yield raw incremental deltas and let the caller accumulate — rejected; reassembly logic would be duplicated by every consumer, and C's SSE endpoint already has enough to do.)

**Env (all optional, defaults shown):**

| Var | Default | Purpose |
|---|---|---|
| `LLM_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible base. Ollama serves `/v1/chat/completions` natively. |
| `LLM_API_KEY` | (empty) | Bearer token for hosted providers. Omit for Ollama. |
| `LLM_CONTENT_MODEL` | `qwen3:1.7b` | Small/fast model for listing title/desc rewrites. |
| `LLM_ASSISTANT_MODEL` | `qwen3:4b-instruct` | Larger TR-friendly model for the assistant (C). Not used by B directly, but defined now so C does not need new env. |
| `LLM_TIMEOUT_MS` | `30000` | Default per-call timeout. |
| `LLM_CONTENT_ENABLED` | `false` | Master toggle for content-AI. Replaces `CONTENT_AI_ENABLED`. |

`CONTENT_AI_ENABLED` / `CONTENT_AI_OLLAMA_URL` / `CONTENT_AI_OLLAMA_MODEL` / `CONTENT_AI_TITLE_TIMEOUT_MS` / `CONTENT_AI_DESCRIPTION_TIMEOUT_MS` are **removed** — folded into the LLM env above. The content-gen service no longer reads its own base URL/model/timeout; it passes `purpose: 'content'` and per-call `temperature`/`maxTokens`/`timeoutMs` to `LlmService`.

### 2. `LlmService` interface

```ts
@Injectable()
export class LlmService {
  /** Non-streaming chat. Throws on any failure (caller handles fallback). */
  chat(messages: LlmMessage[], opts?: LlmChatOptions): Promise<LlmChatResult>;

  /** Streaming chat — async iterable of accumulated-delta chunks. */
  chatStream(messages: LlmMessage[], opts?: LlmChatOptions): AsyncIterable<LlmChatChunk>;

  /** Cheap check: base URL + at least one model env var is set. Not a network ping. */
  isAvailable(): boolean;
}
```

**`chat()`:**
- `POST {LLM_BASE_URL}/chat/completions` with OpenAI body:
  `{ model, messages, temperature, max_tokens, stream: false }`.
- `Authorization: Bearer {LLM_API_KEY}` header **only when `LLM_API_KEY` is non-empty** (Ollama rejects/ignores it but some hosted providers require it absent for anonymous; safer to omit when empty).
- `AbortController` with `opts.timeoutMs ?? LLM_TIMEOUT_MS`; if caller passed `opts.signal`, abort on whichever fires first (link the signals).
- Parse `choices[0].message.content` (string). If missing/empty/non-string → `LlmResponseError`.
- HTTP non-2xx → `LlmResponseError` with status + truncated body.
- Abort/timeout → `LlmTimeoutError`. Network failure → `LlmUnavailableError`.

**`chatStream()`:**
- Same endpoint, `stream: true`. Read the response body as a stream; parse SSE: lines `data: {json}\n\n`, terminal `data: [DONE]`.
- Each parsed event yields `{ delta: accumulatedSoFar, model, done: false }`; the `[DONE]` event yields a final `{ delta: accumulatedSoFar, model, done: true }`.
- Errors (HTTP non-2xx, network, malformed SSE) → the async generator `throw`s `LlmResponseError`/`LlmUnavailableError`. Timeout/abort → generator closes (throws `LlmTimeoutError`).
- The service keeps a running `accumulated` string across chunks so consumers get the full-so-far text on each yield (per `LlmChatChunk`).

**`purpose` → model resolution:** `purpose === 'assistant'` → `LLM_ASSISTANT_MODEL`; else (including `undefined`) → `LLM_CONTENT_MODEL`. Explicit `opts.model` always wins.

**Typed errors** (`packages/shared/src/domain/llm/` or api-local — see Files): `LlmUnavailableError` (network / cannot reach), `LlmTimeoutError` (abort/timeout), `LlmResponseError` (2xx but bad body, or non-2xx). All extend a base `LlmError`. Callers can branch on type.

The SSE byte→event parsing is extracted into a **pure** helper `parseSseChunk(buffer: string): { events: ParsedSseEvent[]; rest: string }` so it is unit-testable without a network. `chatStream` feeds it bytes as they arrive, carrying over `rest` between reads.

### 3. Content-gen migration

`apps/api/src/modules/listings/content-generation.service.ts`:
- **Remove:** `baseUrl()`, `model()`, `titleTimeoutMs()`, `descriptionTimeoutMs()`, the entire `ollamaGenerate()` method, the `ConfigService` injection (no longer reads env directly).
- **Remove:** the `CONTENT_AI_*` env reads; `isEnabled()` reads `LLM_CONTENT_ENABLED`.
- **Add:** inject `LlmService`. `rewriteTitle`/`rewriteDescription` call `this.llm.chat([{role:'system', content: SYSTEM_TITLE}, {role:'user', content: prompt}], { purpose:'content', temperature: 0.3|0.4, maxTokens: 256, timeoutMs: 8000|15000 })`. The system messages encode the existing "rules" lines; the user message encodes the per-product context. Same `cleanTitle`/`cleanDescription`/`escapeHtml` post-processing. Same fallback on any `LlmError` (or short/empty result) → `baseTitle`/`baseDescription`.
- **Keep identical:** `ContentRewriteInput`, `rewriteTitle`/`rewriteDescription` signatures, the create-only gate (`ListingStrategyService.prepareListingData(..., { applyContentAi: true })` unchanged), the "never on refresh/sync" scale guard.

`ListingStrategyService` and `listing-processor.service.ts` are **untouched** — they call `contentGeneration.rewriteTitle`/`rewriteDescription` with the same signatures. Net effect: behavior identical, transport swapped, provider now env-swappable, streaming seam ready for C.

### 4. Ollama in docker-compose

Add to `docker-compose.yml` (dev) and `docker-compose.production.yml` (test/prod):

```yaml
ollama:
  image: ollama/ollama:latest
  container_name: zonds_ollama
  restart: unless-stopped
  ports:
    - '11434:11434'
  volumes:
    - ollama_data:/root/.ollama
  networks:
    - zonds_network
```

Add `ollama_data` to the `volumes:` block. `pnpm docker:up` starts Ollama alongside Postgres/Redis/pgAdmin.

**No auto-pull** (would block boot and repeat pulls on every start). Documented one-shot pull in `.env.example` + CLAUDE.md:
```bash
docker compose exec ollama ollama pull qwen3:1.7b
docker compose exec ollama ollama pull qwen3:4b-instruct
```

**RAM note (important for the loaded test VPS):** `qwen3:4b-instruct` inference needs ~3–4 GB free RAM. On the 16 GB test VPS, Ollama competes with Postgres + Redis + Playwright (Amazon scraping, resident Chromium contexts) + api + web. This is only feasible at **low concurrency**: content-gen is create-only and the listings worker is concurrency-1, so content rewrites are not a heavy concurrent load. The assistant (C) will need a concurrency/rate-limit decision of its own. If RAM is tight, keep `LLM_CONTENT_ENABLED=false` (deterministic fallback) until capacity is confirmed, or point `LLM_BASE_URL` at a hosted provider (Groq free tier) via env — no code change.

### 5. Error handling & fallback

- `LlmService` **never retries** and **never swallows**. Every failure throws a typed `LlmError` subclass.
- **Content-gen:** every `llm.chat(...)` call is wrapped in try/catch; on any `LlmError` (or a result that fails the length/quality check) it returns `baseTitle`/`baseDescription`. The listing create job never stalls because of AI — same invariant as today.
- **`LLM_CONTENT_ENABLED=false`** → the AI path is skipped entirely (no `llm.chat` call); deterministic strip-brand + templates. This is the default and the safe mode when Ollama is not pulled or RAM is tight.
- **`chatStream`:** a parse/network error mid-stream makes the generator `throw`; the future assistant (C) surfaces that to the user ("connection lost"). B does not consume `chatStream` — it only guarantees the contract is correct and tested.
- **Timeout:** each call gets its own `AbortController`; `opts.timeoutMs` overrides `LLM_TIMEOUT_MS`. A caller-supplied `opts.signal` (e.g. an HTTP request abort) is honored alongside the timeout.
- **Malformed model output** (empty, non-string, missing `choices`) → `LlmResponseError` → caller fallback.

### 6. Testing

Jest (existing `apps/api` harness). Pure logic only — no live Ollama (integration deferred per A1/A2 policy):

- **`parseSseChunk`** — pure helper: split a byte buffer into SSE events, carry leftover `rest` across calls, handle `data: [DONE]`, ignore `:` keep-alive comments, handle partial JSON across chunk boundaries.
- **Model-by-purpose resolution** — `purpose:'content'` → `LLM_CONTENT_MODEL`; `purpose:'assistant'` → `LLM_ASSISTANT_MODEL`; explicit `opts.model` wins; undefined purpose defaults to content model.
- **`chat()` transport** — `fetch` mocked: assert the request body is the OpenAI shape (`model`, `messages`, `temperature`, `max_tokens`, `stream:false`), the `Authorization` header is present only when `LLM_API_KEY` is set, a 2xx with `choices[0].message.content` returns `{text, model}`, a non-2xx throws `LlmResponseError`, an empty body throws `LlmResponseError`, an abort throws `LlmTimeoutError`.
- **`chatStream()` transport** — `fetch` mocked to return a readable stream of SSE chunks; assert the async iterable yields accumulated deltas and a final `done:true`, that a mid-stream malformed event throws, and that abort closes the generator.
- **Content-gen fallback** — `llm.chat` mocked to throw each `LlmError` subclass → `rewriteTitle`/`rewriteDescription` return the base input unchanged; a short result (< 8 / < 40 chars) also falls back.

Manual verification (documented, not automated): `pnpm docker:up`, pull the models, set `LLM_CONTENT_ENABLED=true`, create one listing with the AI group flag on, confirm a rewritten title/description and that disabling the flag or stopping Ollama falls back to deterministic.

### 7. Files

**Backend (`apps/api`):**
- `src/modules/llm/llm.module.ts` — new; provides + exports `LlmService`.
- `src/modules/llm/llm.service.ts` — new; `chat()` + `chatStream()` + `isAvailable()` + typed errors (or errors in a sibling `llm.errors.ts`).
- `src/modules/llm/sse-parser.ts` + `sse-parser.spec.ts` — new; pure SSE byte→event parser + tests.
- `src/modules/llm/llm.service.spec.ts` — new; transport tests with mocked `fetch`.
- `src/modules/listings/content-generation.service.ts` — modify; drop Ollama transport, call `LlmService`, read `LLM_CONTENT_ENABLED`.
- `src/modules/listings/listings.module.ts` — modify; import `LlmModule` so `ContentGenerationService` can inject `LlmService`.
- `src/modules/listings/content-generation.service.spec.ts` — new (or extend if present); fallback tests with mocked `LlmService`.

**Shared (`packages/shared`):**
- `src/domain/llm/llm.types.ts` — new; `LlmMessage`, `LlmChatOptions`, `LlmChatChunk`, `LlmChatResult`. Barrel `src/domain/llm/index.ts`.
- (Errors stay api-local — they're thrown/caught inside the API; not a shared DTO concern. If C later needs them over the wire, promote then.)

**Infra:**
- `docker-compose.yml` — add `ollama` service + `ollama_data` volume.
- `docker-compose.production.yml` — same.
- `apps/api/.env.example` — replace `CONTENT_AI_*` block with `LLM_*` block; add the pull command comment.

**Docs:**
- `CLAUDE.md` — new "LLM infra (B)" subsection: `LlmService` OpenAI-compatible, env, per-use models, Ollama in compose, content-gen migration, RAM note, deferred-to-C list. Remove the old `CONTENT_AI_*` prose.

---

## Error handling

(Same content as §5, consolidated for the spec's standalone readability.)

- `LlmService` throws `LlmUnavailableError` (network), `LlmTimeoutError` (abort/timeout), `LlmResponseError` (bad body / non-2xx). No retry, no swallow.
- Content-gen wraps every call; any `LlmError` or failed quality check → deterministic fallback (`baseTitle`/`baseDescription`). Job queue never stalls on AI.
- `LLM_CONTENT_ENABLED=false` (default) skips the AI path entirely — safe mode when Ollama is absent or RAM-constrained.
- `chatStream` errors propagate via the async iterator; C surfaces them. B only guarantees the contract.

---

## Testing

(Same as §6, consolidated.)

Pure + mocked-fetch unit tests in the existing Jest harness. No live-Ollama integration tests (deferred per project policy). Manual verification steps documented for a one-time live smoke (docker up → pull → enable → create listing → confirm rewrite + fallback).

---

## Risks & trade-offs

- **RAM pressure on the test VPS.** `qwen3:4b-instruct` inference (~3–4 GB) + Postgres + Redis + Playwright (resident Chromium) + api + web on 16 GB. Mitigated by: content-gen is create-only + concurrency-1 (low concurrent load); `LLM_CONTENT_ENABLED=false` default; env-only escape to a hosted provider (Groq) without code change. The assistant (C) will need its own concurrency/rate decision.
- **SSE parser fragility.** OpenAI-compatible SSE is simple but providers differ in keep-alive comments, partial-JSON framing, and `[DONE]` variants. Mitigated by a pure, unit-tested `parseSseChunk` helper that carries leftover bytes and ignores keep-alives.
- **Ollama OpenAI-compat quirks.** Ollama's `/v1/chat/completions` is compatible but historically has small divergences (e.g. `max_tokens` vs `max_predict`). Mitigated by sending both common shapes if needed; the transport test covers the exact body. If a provider diverges, env-swap to a conformant one — no code change.
- **Content-gen behavior drift.** Migrating transport could subtly change output (e.g. `qwen3:1.7b` vs `llama3.2:1b` produce different titles). Accepted — content-gen already has a quality gate (length checks) + fallback, and AI output is non-deterministic by nature. The deterministic fallback is unchanged, so a regression in AI quality degrades gracefully, not silently.
- **No retry.** A transient Ollama hiccup makes one content rewrite fall back to deterministic. Re-running is the create worker's concern (and re-listing a cached ASIN makes no AI call). Deliberate — retry would complicate the seam and risk double-calling under the create path.

---

## Open questions (to resolve in the implementation plan)

1. **Errors location** — `LlmError` subclasses api-local (`apps/api/src/modules/llm/llm.errors.ts`) vs shared (`packages/shared/src/domain/llm/`). Lean: api-local (thrown/caught inside the API; not a wire DTO). Promote to shared only if C needs them serialized.
2. **`max_tokens` vs `max_predict`** — confirm Ollama's `/v1/chat/completions` accepts `max_tokens` (OpenAI field) and maps it. If not, send `max_predict` too or use `max_tokens` only and verify. Resolved during implementation against a live pull.
3. **Content-gen timeouts** — keep 8s title / 15s description as per-call `timeoutMs` (preserving current behavior) vs unify under `LLM_TIMEOUT_MS`. Lean: keep per-call (preserves the current tight title timeout; description legitimately longer).
4. **`LlmChatChunk.delta` shape** — accumulated-so-far (chosen) vs raw incremental delta. Chosen accumulated to spare consumers reassembly; revisit if C's SSE endpoint would prefer incremental (cheap to add an `incremental` field later without breaking).
5. **Whether to keep `LLM_ASSISTANT_MODEL` env now** when only C uses it. Lean: define it now (env-only, zero runtime cost) so C does not need new env and the per-use-case contract is visible.
