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
- **Proactive rate limiter** (Bottleneck token-bucket in `LlmService`). B uses internal 429 Retry-After backoff only — enough for the bulk content path. A proactive limiter is deferred to C (when assistant concurrency + multi-tenant token budgeting are known).
- Bulk historical content rewrite of **existing** already-published listings (would need the deferred eBay title/desc revise API). B's bulk path applies to **new** bulk-added listings only (create → AI inline → publish once).

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

**Provider choice (the bulk-scale decision):**

The LlmClient is provider-agnostic by env, so the provider is a deployment decision, not a code one. Two free options, picked per workload:

| Workload | Provider | Why |
|---|---|---|
| **Bulk add (e.g. 2000 listings at once)** | **Groq free tier** (hosted, OpenAI-compatible) | Local Ollama on CPU cannot do 2000×2=4000 calls in reasonable time (~6–7h sequential, concurrency-1 because CPU Ollama collapses at 5+ in-flight) AND it adds ~3–4 GB RAM pressure on the already-loaded test VPS. Groq is free (signup, no payment), ~instant per call, and rate-limited (~30 req/min on the free tier — check current limits). 4000 calls at the rate limit ≈ a ~2h batch: queue it, walk away, listings publish as jobs complete. Product data (Amazon title/features) sent to Groq is **public, non-sensitive** — acceptable. |
| **Dev / trickle (a few listings/day from refresh)** | **Local Ollama** (CPU, in docker-compose) | Free, private, no rate limit, no network egress. Fine when volume is low. |

Groq env (bulk):
```
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=<groq free key>
LLM_CONTENT_MODEL=llama-3.1-8b-instant
```
Local Ollama env (dev/trickle, default):
```
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=
LLM_CONTENT_MODEL=qwen3:1.7b
```

The architecture handles both identically — the only difference is env. A future GPU box switches to vLLM the same way. **Recommendation: default the compose + docs to local Ollama (zero-setup dev), and document the Groq env swap as the bulk path.**

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

**Typed errors** (`packages/shared/src/domain/llm/` or api-local — see Files): `LlmUnavailableError` (network / cannot reach), `LlmTimeoutError` (abort/timeout), `LlmResponseError` (2xx but bad body, or non-2xx), `LlmRateLimitError` (HTTP 429; carries `retryAfterMs?` parsed from the `Retry-After` header). All extend a base `LlmError`. Callers can branch on type.

**429 / rate-limit handling (bulk path):** `chat()` and `chatStream()` handle HTTP 429 **inside the service** — read `Retry-After` (seconds → ms, default a short backoff if absent), and if the wait fits within the call's remaining `timeoutMs` budget (and a max of 3 internal retries), sleep and retry; otherwise throw `LlmRateLimitError`. This keeps callers simple: a single `chat()` call self-paces through a rate-limit window instead of every caller reimplementing backoff. For bulk (Groq free tier), set a generous per-call `timeoutMs` (e.g. 60s) so the service can absorb a 429 wait, and keep the listings create worker concurrency low (1–2) so parallel calls don't all slam the rate limit at once. A proactive token-bucket rate limiter (Bottleneck, like `AmazonRateLimiter`) is **deferred to C** — the internal 429 backoff is enough for B's bulk path.

The SSE byte→event parsing is extracted into a **pure** helper `parseSseChunk(buffer: string): { events: ParsedSseEvent[]; rest: string }` so it is unit-testable without a network. `chatStream` feeds it bytes as they arrive, carrying over `rest` between reads.

### 3. Content-gen migration

`apps/api/src/modules/listings/content-generation.service.ts`:
- **Remove:** `baseUrl()`, `model()`, `titleTimeoutMs()`, `descriptionTimeoutMs()`, the entire `ollamaGenerate()` method, the `ConfigService` injection (no longer reads env directly).
- **Remove:** the `CONTENT_AI_*` env reads; `isEnabled()` reads `LLM_CONTENT_ENABLED`.
- **Add:** inject `LlmService`. `rewriteTitle`/`rewriteDescription` call `this.llm.chat([{role:'system', content: SYSTEM_TITLE}, {role:'user', content: prompt}], { purpose:'content', temperature: 0.3|0.4, maxTokens: 256, timeoutMs: 8000|15000 })`. The system messages encode the existing "rules" lines; the user message encodes the per-product context. Same `cleanTitle`/`cleanDescription`/`escapeHtml` post-processing. Same fallback on any `LlmError` (or short/empty result) → `baseTitle`/`baseDescription`.
- **Keep identical:** `ContentRewriteInput`, `rewriteTitle`/`rewriteDescription` signatures, the create-only gate (`ListingStrategyService.prepareListingData(..., { applyContentAi: true })` unchanged), the "never on refresh/sync" scale guard.

`ListingStrategyService` and `listing-processor.service.ts` are **untouched** — they call `contentGeneration.rewriteTitle`/`rewriteDescription` with the same signatures. Net effect: behavior identical, transport swapped, provider now env-swappable, streaming seam ready for C.

### 4. Bulk scale (2000 listings at once) — the orchestration decision

The user's stated scale: a user may add ~2000 listings in one bulk action and want AI-rewritten title + description for each. That is **2000 listings × 2 LLM calls = 4000 calls** per bulk add.

**Decision: keep AI inline in the listings create worker; do NOT build a separate `content-rewrite` queue or an eBay revise path in B.** Rationale:

- The listings create path is **already a BullMQ queue** (`listings` queue, `ListingProcessorService`). 2000-at-once is naturally a batch that trickles out as jobs complete — each job: deterministic content → AI rewrite (if group flags on) → publish to eBay. No new queue needed.
- Decoupling (deterministic + publish now, AI revise async) would require an **eBay title/desc revise** call (Inventory/Trading API) that does **not exist yet** (CLAUDE.md lists it under "Deferred"). Building it would bloat B. Inline AI avoids it — the listing is published once, with the AI title already in hand.
- The only reason inline AI was a problem at bulk scale was **local Ollama CPU throughput**. Switching the provider to Groq (env, free) fixes that without touching orchestration: per-call is ~instant, and the LlmService's internal 429 backoff self-paces the batch to the free-tier rate limit.

**Honest throughput numbers:**

| Provider | Per-call | 4000-call batch wall-clock | RAM |
|---|---|---|---|
| Groq free tier | ~instant (network-bound) | ~2h (dominated by free-tier rate limit ~30 req/min; check current) | 0 (hosted) |
| Local Ollama (qwen3:1.7b, CPU) | ~1–3s generation | ~6–7h sequential (concurrency-1; CPU collapses at 5+ in-flight) | ~2–3 GB resident |
| Local Ollama (qwen3:4b, CPU) | ~3–6s | ~13h+ | ~3–4 GB resident |

**So: bulk = Groq (free, ~2h batch, queue-and-walk-away); dev/trickle = local Ollama.** Both via env, no code difference. The create worker's existing BullMQ retry/backoff + the LlmService's 429 backoff handle Groq rate limits. Listings appear on eBay as each job completes over the batch window.

**Concurrency knob:** the listings create worker concurrency should stay low for AI+bulk (1–2) so parallel jobs don't burst past the rate limit and all back off at once. If the worker concurrency is higher today, an env knob (`LISTINGS_WORKER_CONCURRENCY` if not already present) tunes it — verify in the plan.

**Failure isolation:** a single listing's AI failure (any `LlmError`, including `LlmRateLimitError` after the internal budget is exhausted) → fallback to deterministic content for that listing → publish proceeds. One bad/timeout listing does not stall the batch; BullMQ moves to the next job. This preserves the existing "AI never blocks the create queue" invariant.

### 5. Ollama in docker-compose

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

### 6. Error handling & fallback

- `LlmService` **never retries** and **never swallows**. Every failure throws a typed `LlmError` subclass.
- **Content-gen:** every `llm.chat(...)` call is wrapped in try/catch; on any `LlmError` (or a result that fails the length/quality check) it returns `baseTitle`/`baseDescription`. The listing create job never stalls because of AI — same invariant as today.
- **`LLM_CONTENT_ENABLED=false`** → the AI path is skipped entirely (no `llm.chat` call); deterministic strip-brand + templates. This is the default and the safe mode when Ollama is not pulled or RAM is tight.
- **`chatStream`:** a parse/network error mid-stream makes the generator `throw`; the future assistant (C) surfaces that to the user ("connection lost"). B does not consume `chatStream` — it only guarantees the contract is correct and tested.
- **Timeout:** each call gets its own `AbortController`; `opts.timeoutMs` overrides `LLM_TIMEOUT_MS`. A caller-supplied `opts.signal` (e.g. an HTTP request abort) is honored alongside the timeout.
- **Malformed model output** (empty, non-string, missing `choices`) → `LlmResponseError` → caller fallback.

### 7. Testing

Jest (existing `apps/api` harness). Pure logic only — no live Ollama (integration deferred per A1/A2 policy):

- **`parseSseChunk`** — pure helper: split a byte buffer into SSE events, carry leftover `rest` across calls, handle `data: [DONE]`, ignore `:` keep-alive comments, handle partial JSON across chunk boundaries.
- **Model-by-purpose resolution** — `purpose:'content'` → `LLM_CONTENT_MODEL`; `purpose:'assistant'` → `LLM_ASSISTANT_MODEL`; explicit `opts.model` wins; undefined purpose defaults to content model.
- **`chat()` transport** — `fetch` mocked: assert the request body is the OpenAI shape (`model`, `messages`, `temperature`, `max_tokens`, `stream:false`), the `Authorization` header is present only when `LLM_API_KEY` is set, a 2xx with `choices[0].message.content` returns `{text, model}`, a non-2xx throws `LlmResponseError`, an empty body throws `LlmResponseError`, an abort throws `LlmTimeoutError`.
- **`chatStream()` transport** — `fetch` mocked to return a readable stream of SSE chunks; assert the async iterable yields accumulated deltas and a final `done:true`, that a mid-stream malformed event throws, and that abort closes the generator.
- **Content-gen fallback** — `llm.chat` mocked to throw each `LlmError` subclass → `rewriteTitle`/`rewriteDescription` return the base input unchanged; a short result (< 8 / < 40 chars) also falls back.

Manual verification (documented, not automated): `pnpm docker:up`, pull the models, set `LLM_CONTENT_ENABLED=true`, create one listing with the AI group flag on, confirm a rewritten title/description and that disabling the flag or stopping Ollama falls back to deterministic.

### 8. Files

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

- `LlmService` throws `LlmUnavailableError` (network), `LlmTimeoutError` (abort/timeout), `LlmResponseError` (bad body / non-2xx), `LlmRateLimitError` (429 — thrown only after the internal Retry-After backoff budget is exhausted). No other retry, no swallow.
- Content-gen wraps every call; any `LlmError` or failed quality check → deterministic fallback (`baseTitle`/`baseDescription`). Job queue never stalls on AI.
- `LLM_CONTENT_ENABLED=false` (default) skips the AI path entirely — safe mode when Ollama is absent or RAM-constrained.
- `chatStream` errors propagate via the async iterator; C surfaces them. B only guarantees the contract.

---

## Testing

(Same as §6, consolidated.)

Pure + mocked-fetch unit tests in the existing Jest harness. No live-Ollama integration tests (deferred per project policy). Manual verification steps documented for a one-time live smoke (docker up → pull → enable → create listing → confirm rewrite + fallback).

---

## Risks & trade-offs

- **RAM pressure on the test VPS (local Ollama only).** `qwen3:4b-instruct` inference (~3–4 GB) + Postgres + Redis + Playwright (resident Chromium) + api + web on 16 GB. Only a concern when `LLM_BASE_URL` points at local Ollama. Mitigated by: bulk path uses Groq (hosted, zero local RAM); `LLM_CONTENT_ENABLED=false` default; local Ollama reserved for dev/trickle. The assistant (C) will need its own concurrency/rate decision.
- **SSE parser fragility.** OpenAI-compatible SSE is simple but providers differ in keep-alive comments, partial-JSON framing, and `[DONE]` variants. Mitigated by a pure, unit-tested `parseSseChunk` helper that carries leftover bytes and ignores keep-alives.
- **Ollama OpenAI-compat quirks.** Ollama's `/v1/chat/completions` is compatible but historically has small divergences (e.g. `max_tokens` vs `max_predict`). Mitigated by sending both common shapes if needed; the transport test covers the exact body. If a provider diverges, env-swap to a conformant one — no code change.
- **Content-gen behavior drift.** Migrating transport could subtly change output (e.g. `qwen3:1.7b` vs `llama3.2:1b` produce different titles). Accepted — content-gen already has a quality gate (length checks) + fallback, and AI output is non-deterministic by nature. The deterministic fallback is unchanged, so a regression in AI quality degrades gracefully, not silently.
- **Retry policy.** The only internal retry is for HTTP 429 (rate limit), bounded by the call's `timeoutMs` budget + max 3 attempts, so a single `chat()` self-paces through a Groq rate-limit window. All other failures (network, timeout, bad body) throw immediately — the create worker's BullMQ retry/backoff handles job-level retries, and content-gen falls back to deterministic on any `LlmError`. Deliberate — broader retry would complicate the seam and risk double-calling under the create path.

---

## Open questions (to resolve in the implementation plan)

1. **Errors location** — `LlmError` subclasses api-local (`apps/api/src/modules/llm/llm.errors.ts`) vs shared (`packages/shared/src/domain/llm/`). Lean: api-local (thrown/caught inside the API; not a wire DTO). Promote to shared only if C needs them serialized.
2. **`max_tokens` vs `max_predict`** — confirm Ollama's `/v1/chat/completions` accepts `max_tokens` (OpenAI field) and maps it. If not, send `max_predict` too or use `max_tokens` only and verify. Resolved during implementation against a live pull.
3. **Content-gen timeouts** — keep 8s title / 15s description as per-call `timeoutMs` (preserving current behavior) vs unify under `LLM_TIMEOUT_MS`. Lean: keep per-call **but raise for bulk** — the 8s title timeout is too tight for Groq 429 backoff; use a generous per-call timeout (e.g. 60s) so the internal rate-limit backoff has budget. Title vs description can still differ on `maxTokens`/`temperature`, just not on a tiny timeout.
4. **`LlmChatChunk.delta` shape** — accumulated-so-far (chosen) vs raw incremental delta. Chosen accumulated to spare consumers reassembly; revisit if C's SSE endpoint would prefer incremental (cheap to add an `incremental` field later without breaking).
5. **`LLM_ASSISTANT_MODEL` env now** — define it now (env-only, zero runtime cost) so C does not need new env and the per-use-case contract is visible. (Decided: yes.)
6. **Listings worker concurrency** — confirm whether the `listings` create worker has an env concurrency knob; if not, whether to add one (`LISTINGS_WORKER_CONCURRENCY`) so bulk+AI stays at 1–2 to avoid bursting Groq's rate limit. Resolve in the plan by reading `listing-processor.service.ts`.
