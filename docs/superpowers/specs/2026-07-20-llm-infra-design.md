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
4. **AI content is create-only — NEVER on Keepa refresh / product-sync.** The existing `applyContentAi` gate stays. Refresh rewrites only price/qty; AI-rewritten (or deterministic) titles/descriptions from create are left alone. Cost + eBay thrash + user intent. Locked by a regression test in the plan.
5. **Lean** — one `@Injectable` service + one small pure SSE parser. No provider registry, no `forRoot` config module, no DB, no retry layer. YAGNI.
6. **Honest failure** — `LlmService` throws typed errors; callers decide fallback. Never silently swallow.

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

**Provider choice (architect decision — fast + cheap, multi-tenant):**

The LlmClient is provider-agnostic by env, so the provider is a deployment decision, not a code one. **Free tiers are NOT viable at the user's stated scale** (10 of 100 users bulk-adding 2000 listings simultaneously = 20,000 listings = ~40,000 LLM calls in a burst). Any free tier rate-limits that to multi-hour. So: **paid, cheap, fast** — and the decision is which.

| Workload | Provider | Model | Why |
|---|---|---|---|
| **Prod / bulk (default)** | **OpenAI** (paid, OpenAI-compatible) | **gpt-4o-mini** (or its current cheapest successor) | Best TR instruction-following at the cheap tier (Zonds is EN+TR; description cleanup in Turkish is where small models stumble). Rock-solid reliability + predictable rate-limit tiering — matters under the 10×2000 burst. Cheap: ~$0.15/M input, ~$0.60/M output ⇒ a 2000-listing batch (4000 calls, ~400 tok avg) ≈ **~$0.40**, i.e. ~$0.0002/listing. Fast: ~1–2s/call. The task (keyword-preserving title ≤80 chars + description cleanup) is light — this model is purpose-built for high-volume light work. |
| **Prod / bulk (alt — max speed/cost)** | **Groq** (paid, OpenAI-compatible) | `llama-3.1-8b-instant` | Fastest inference (LPU, sub-second/call) and cheapest (~5–10× cheaper than gpt-4o-mini). One-line env swap. Trade-off: weaker Turkish quality than gpt-4o-mini + Groq has historically queued/capacity-throttled under burst load — risky for exactly the 10×2000 case. Use when raw speed/cost beats TR-quality/reliability for the user's listings. |
| **Dev / trickle** | **Local Ollama** (free, in docker-compose) | `qwen3:1.7b` | Free, private, no rate limit, no egress. Fine for a few listings/day. NOT for bulk (CPU ~7h for 4000 calls + RAM pressure). |

**Default env (prod/bulk):**
```
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=<openai key>
LLM_CONTENT_MODEL=gpt-4o-mini
LLM_ASSISTANT_MODEL=gpt-4o-mini
```
**Alt (Groq, faster/cheaper, weaker TR):**
```
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=<groq key>
LLM_CONTENT_MODEL=llama-3.1-8b-instant
```
**Dev (local Ollama, free):**
```
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=
LLM_CONTENT_MODEL=qwen3:1.7b
```

The architecture handles all three identically — only env differs. A future GPU box switches to vLLM the same way. **Decision: ship the client + docs defaulting prod to OpenAI gpt-4o-mini; document the Groq env swap as the faster/cheaper alt; keep local Ollama as the zero-setup dev default.** The user picks per deployment; no code change to switch.

**Why gpt-4o-mini over Groq as the default** (the user asked for fast+cheap and to decide): both are fast+cheap; the per-batch cost difference is cents (~$0.40 vs ~$0.08) — negligible. gpt-4o-mini wins on (a) Turkish listing quality, which directly affects sales, and (b) reliability under the exact multi-tenant burst the user described (Groq has capacity-queueing under burst). Groq remains a one-line env flip if the user later prioritizes raw speed/cost over TR quality.

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

**429 / rate-limit handling (bulk path):** `chat()` and `chatStream()` handle HTTP 429 **inside the service** — read `Retry-After` (seconds → ms, default a short backoff if absent), and if the wait fits within the call's remaining `timeoutMs` budget (and a max of 3 internal retries), sleep and retry; otherwise throw `LlmRateLimitError`. This keeps callers simple: a single `chat()` call self-paces through a rate-limit window instead of every caller reimplementing backoff. For bulk (OpenAI gpt-4o-mini paid / Groq paid alt), set a generous per-call `timeoutMs` (e.g. 60s) so the service can absorb a 429 wait, and keep the listings create worker concurrency modest (2–4) so parallel calls don't all slam the rate limit at once. A proactive token-bucket rate limiter (Bottleneck, like `AmazonRateLimiter`) is **deferred to C** — the internal 429 backoff is enough for B's bulk path.

The SSE byte→event parsing is extracted into a **pure** helper `parseSseChunk(buffer: string): { events: ParsedSseEvent[]; rest: string }` so it is unit-testable without a network. `chatStream` feeds it bytes as they arrive, carrying over `rest` between reads.

### 3. Content-gen migration

`apps/api/src/modules/listings/content-generation.service.ts`:
- **Remove:** `baseUrl()`, `model()`, `titleTimeoutMs()`, `descriptionTimeoutMs()`, the entire `ollamaGenerate()` method, the `ConfigService` injection (no longer reads env directly).
- **Remove:** the `CONTENT_AI_*` env reads; `isEnabled()` reads `LLM_CONTENT_ENABLED`.
- **Add:** inject `LlmService`. `rewriteTitle`/`rewriteDescription` call `this.llm.chat([{role:'system', content: SYSTEM_TITLE}, {role:'user', content: prompt}], { purpose:'content', temperature: 0.3|0.4, maxTokens: 256, timeoutMs: 8000|15000 })`. The system messages encode the existing "rules" lines; the user message encodes the per-product context. Same `cleanTitle`/`cleanDescription`/`escapeHtml` post-processing. Same fallback on any `LlmError` (or short/empty result) → `baseTitle`/`baseDescription`.
- **Keep identical:** `ContentRewriteInput`, `rewriteTitle`/`rewriteDescription` signatures, the create-only gate (`ListingStrategyService.prepareListingData(..., { applyContentAi: true })` unchanged), the "never on refresh/sync" scale guard.

`ListingStrategyService` and `listing-processor.service.ts` are **untouched** — they call `contentGeneration.rewriteTitle`/`rewriteDescription` with the same signatures. Net effect: behavior identical, transport swapped, provider now env-swappable, streaming seam ready for C.

**HARD RULE — AI content is create-only, NEVER on Keepa refresh / product-sync (already true, must stay true):**

Verified in current code and locked as an architectural invariant for B and all future work:

| Path | Call site | `applyContentAi` | What happens to title/description |
|---|---|---|---|
| **Listing create** (`ListingProcessorService`) | `listing-processor.service.ts:115-121` | **`true`** | Deterministic (brand-strip + template) → optional AI rewrite if group flags on + `LLM_CONTENT_ENABLED` → publish once. |
| **Keepa refresh / product-sync** (`ProductSyncService`) | `product-sync.service.ts:102` | **omitted (= `false`)** | Only price/qty recomputed + pushed to eBay. Title and description are **not** rewritten — not deterministically, not by AI. Existing eBay listing content (including any AI-rewritten title/desc from create) is left alone. |
| **Sale-driven stock sync** | reuses `ProductSyncService.syncListingsForProduct` | **omitted** | Same — qty only. |

**Why this is non-negotiable:**
1. **Cost** — a Keepa refresh cycle over 100k unique ASINs × AI rewrite = tens of thousands of LLM calls per cycle. At gpt-4o-mini rates that is dollars per hour of pure waste, and at any scale it is the dominant bill.
2. **eBay content thrash** — rewriting a live listing's title/description on every Amazon price tick would re-index the listing, risk keyword-rank volatility, and look like spam to eBay's content quality signals.
3. **User intent** — the AI rewrite at create is a one-time quality pass. Subsequent Keepa updates are about **price and stock**, not content. If the user wants a content re-rewrite later, that is a deliberate action (future offline batch / eBay revise path — out of scope for B).
4. **Already enforced** — `ListingStrategyService.prepareListingData(..., { applyContentAi })` defaults the flag to `false`. Only the create worker passes `true`. Product-sync never does. **B must not change this.** The migration of content-gen onto `LlmService` does not touch the call sites; the gate stays.

**Implication for B:** the `LlmService` is only invoked from the create path (via content-gen). Refresh/sync never reach it. Tests should lock this: a unit/integration assertion that `ProductSyncService`'s `prepareListingData` call does **not** pass `applyContentAi: true` (and/or that content-gen is not injected into the refresh path). The plan must include this regression guard.

### 4. Bulk scale (2000 listings at once, 10 concurrent users) — the orchestration decision

The user's stated scale: a user may add ~2000 listings in one bulk action and want AI-rewritten title + description for each. **Worst case: 10 of 100 users bulk-adding simultaneously = 20,000 listings = ~40,000 LLM calls in a burst.** That is the design target.

**First key clarification — AI is OPTIONAL, brand-strip is NOT:**

- **Brand stripping is deterministic and already built** (`stripBrandFromTitle`, `listing_settings_groups.content` JSONB, migration `031`). It runs on every create when the group flag is on — instant, free, no LLM. So "remove brand from title/description" is **not** an AI task and never touches the LLM bill.
- **AI title/description rewrite is a separate, opt-in quality layer** (`aiTitleEnabled` / `aiDescriptionEnabled` on the same group). It optimizes keywords and rewrites prose. It is **off by default**. A user who only wants brand-stripped, eBay-compliant titles gets that with zero LLM cost and zero queue time — the bulk batch is then instant (deterministic only).
- **Implication:** the 40,000-call burst only happens if users explicitly enable AI on the bulk group. Most bulk adds (just "list these 2000 ASINs, strip brand, comply with eBay") hit the LLM **zero times**. AI is the premium knob, not the default path.

This dramatically lowers the realistic LLM load and the cost ceiling. The user controls it per bulk action via the group flags.

**Decision for the AI-enabled case: keep AI inline in the listings create worker; do NOT build a separate `content-rewrite` queue or an eBay revise path in B.** Rationale:

- The listings create path is **already a BullMQ queue** (`listings` queue, `ListingProcessorService`). 2000-at-once (×10 users) is naturally a batch that trickles out as jobs complete — each job: deterministic content (always) → AI rewrite (only if group flags on) → publish to eBay. No new queue needed.
- Decoupling (deterministic + publish now, AI revise async) would require an **eBay title/desc revise** call (Inventory/Trading API) that does **not exist yet** (CLAUDE.md lists it under "Deferred"). Building it would bloat B. Inline AI avoids it — the listing is published once, with the AI title already in hand.

**Honest throughput (the AI-enabled worst case, 40,000 calls):**

Bulk is a **queue-throughput** problem, not a concurrent-call problem — you never fire 40k in parallel (that 429s instantly on every provider). You process at the provider's rate limit. The binding constraint is tokens-per-minute (TPM), not requests-per-minute, because each call carries product context.

| Provider (paid) | Per-call | 40,000-call burst wall-clock | Cost (≈16M tokens) |
|---|---|---|---|
| **OpenAI gpt-4o-mini** (Tier 1: 500 RPM / 90k TPM) | ~1–2s | ~3h at Tier 1 (TPM-bound: 16M / 90k) | ~$0.40/batch → ~$4 for 10 users |
| **OpenAI gpt-4o-mini** (Tier 2+: 350k TPM, reached after ~$50 historical spend) | ~1–2s | **~45 min** | same |
| **Groq llama-3.1-8b-instant** (paid, higher throughput) | <1s | ~20–30 min if not capacity-throttled | ~$0.08/batch → ~$0.80 for 10 users |
| Local Ollama (any model, CPU) | 1–6s | **not viable** (~7h for ONE 2000-batch; 10× is days) + RAM | free |

**Reading the table:**
- **Free is not an option at this scale** — the user already accepts paying ("para veririz"). The question is how cheap + how fast.
- **Under ~2h for the 10×2000 AI-enabled burst needs a paid tier with real throughput.** OpenAI Tier 1 is ~3h (TPM-bound); Tier 2+ is ~45 min. Groq paid is ~20–30 min if it doesn't capacity-throttle (its historical weakness under burst).
- **Cost is trivial either way** — even the worst case (10 users, all AI-enabled, OpenAI) is ~$4 for the whole burst. Realistically far less because most bulk adds leave AI off (deterministic brand-strip only).

**So the practical answer: prod/bulk defaults to OpenAI gpt-4o-mini (reliable, TR-quality, cheap).** If a specific bulk run needs max speed, the user flips `LLM_BASE_URL` to Groq for that run — one env change. If they outgrow Tier 1, OpenAI auto-tiers up with spend (Tier 2 ≈ $50 lifetime). The LlmService's internal 429 Retry-After backoff paces every call to whichever rate limit applies.

**Concurrency knob:** the listings create worker concurrency must stay modest for AI+bulk (e.g. 2–4) so parallel jobs don't all 429 at once. Verify whether the worker already has an env concurrency knob in the plan; if not, add `LISTINGS_WORKER_CONCURRENCY`. This is a tune, not new architecture.

**Failure isolation:** a single listing's AI failure (any `LlmError`, including `LlmRateLimitError` after the internal backoff budget is exhausted) → fallback to deterministic content for that listing → publish proceeds. One bad/timeout listing does not stall the batch; BullMQ moves to the next job. This preserves the existing "AI never blocks the create queue" invariant.

**Cost attribution (deferred to plan / C):** per-user LLM spend tracking (an `llm_usage_log` table mirroring `keepa_usage_log`'s fair-split pattern) is the natural multi-tenant answer to "who owes what." It is **out of scope for B** (B has no billing surface); it belongs in the plan or in C when multi-tenant credit/billing is designed. B's `LlmService` should **log usage** (user_id, purpose, model, tokens in/out, latency, success) to a cheap append-only log so the data exists when attribution is built — but no aggregation/billing UI in B.

### 5. Chatbot (C) — confirm B supports the described design

The user's chatbot ("Zon") has two modes, both served by B's `LlmService`:
1. **App-internal AI assistant** — answers app-usage questions, RAG over app docs. **Sync**, streaming UX → uses `LlmService.chatStream()`.
2. **Support handoff** — when AI can't help or the user wants a human, route to support. **Async**: if support is offline, the message holds; support comes online and replies. Sync chat is also possible when support is online.

B's contract supports both: `chat()` (sync, non-streaming) + `chatStream()` (sync streaming) for the AI assistant; the async support-handoff is a **persistence/presence** concern (message store, support-agent queue, online/offline state) that is squarely **C's scope**, not B's. B only guarantees the LLM transport + streaming seam are correct and tested. **C will design:** conversation storage, support-agent presence, offline-message hold, the RAG doc ingestion, and the FE widget wiring. This is noted here so B's `chatStream()` contract is validated against the real consumer before B ships.

### 6. Ollama in docker-compose

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

**RAM note (important for the loaded test VPS):** `qwen3:4b-instruct` inference needs ~3–4 GB free RAM. On the 16 GB test VPS, Ollama competes with Postgres + Redis + Playwright (Amazon scraping, resident Chromium contexts) + api + web. This is only a concern when `LLM_BASE_URL` points at local Ollama (dev/trickle). Prod/bulk uses hosted OpenAI/Groq (zero local RAM). Content-gen is create-only and the listings worker is concurrency-modest, so content rewrites are not a heavy concurrent load even on local Ollama. The assistant (C) will need a concurrency/rate-limit decision of its own. If RAM is tight in dev, keep `LLM_CONTENT_ENABLED=false` (deterministic fallback) until capacity is confirmed, or point `LLM_BASE_URL` at the hosted provider via env — no code change.

### 7. Error handling & fallback

- `LlmService` **never retries** and **never swallows**. Every failure throws a typed `LlmError` subclass.
- **Content-gen:** every `llm.chat(...)` call is wrapped in try/catch; on any `LlmError` (or a result that fails the length/quality check) it returns `baseTitle`/`baseDescription`. The listing create job never stalls because of AI — same invariant as today.
- **`LLM_CONTENT_ENABLED=false`** → the AI path is skipped entirely (no `llm.chat` call); deterministic strip-brand + templates. This is the default and the safe mode when Ollama is not pulled or RAM is tight.
- **`chatStream`:** a parse/network error mid-stream makes the generator `throw`; the future assistant (C) surfaces that to the user ("connection lost"). B does not consume `chatStream` — it only guarantees the contract is correct and tested.
- **Timeout:** each call gets its own `AbortController`; `opts.timeoutMs` overrides `LLM_TIMEOUT_MS`. A caller-supplied `opts.signal` (e.g. an HTTP request abort) is honored alongside the timeout.
- **Malformed model output** (empty, non-string, missing `choices`) → `LlmResponseError` → caller fallback.

### 8. Testing

Jest (existing `apps/api` harness). Pure logic only — no live Ollama (integration deferred per A1/A2 policy):

- **`parseSseChunk`** — pure helper: split a byte buffer into SSE events, carry leftover `rest` across calls, handle `data: [DONE]`, ignore `:` keep-alive comments, handle partial JSON across chunk boundaries.
- **Model-by-purpose resolution** — `purpose:'content'` → `LLM_CONTENT_MODEL`; `purpose:'assistant'` → `LLM_ASSISTANT_MODEL`; explicit `opts.model` wins; undefined purpose defaults to content model.
- **`chat()` transport** — `fetch` mocked: assert the request body is the OpenAI shape (`model`, `messages`, `temperature`, `max_tokens`, `stream:false`), the `Authorization` header is present only when `LLM_API_KEY` is set, a 2xx with `choices[0].message.content` returns `{text, model}`, a non-2xx throws `LlmResponseError`, an empty body throws `LlmResponseError`, an abort throws `LlmTimeoutError`.
- **`chatStream()` transport** — `fetch` mocked to return a readable stream of SSE chunks; assert the async iterable yields accumulated deltas and a final `done:true`, that a mid-stream malformed event throws, and that abort closes the generator.
- **Content-gen fallback** — `llm.chat` mocked to throw each `LlmError` subclass → `rewriteTitle`/`rewriteDescription` return the base input unchanged; a short result (< 8 / < 40 chars) also falls back.

Manual verification (documented, not automated): `pnpm docker:up`, pull the models, set `LLM_CONTENT_ENABLED=true`, create one listing with the AI group flag on, confirm a rewritten title/description and that disabling the flag or stopping Ollama falls back to deterministic.

### 9. Files

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

(Same as §8, consolidated.)

Pure + mocked-fetch unit tests in the existing Jest harness. No live-provider integration tests (deferred per project policy). Manual verification steps documented for a one-time live smoke (docker up → pull Ollama / set OpenAI key → enable → create listing → confirm rewrite + fallback). Must include the create-only AI regression guard (product-sync does not pass `applyContentAi: true`).

---

## Risks & trade-offs

- **RAM pressure on the test VPS (local Ollama only).** `qwen3:4b-instruct` inference (~3–4 GB) + Postgres + Redis + Playwright (resident Chromium) + api + web on 16 GB. Only a concern when `LLM_BASE_URL` points at local Ollama. Mitigated by: prod/bulk uses hosted OpenAI/Groq (zero local RAM); `LLM_CONTENT_ENABLED=false` default; local Ollama reserved for dev/trickle. The assistant (C) will need its own concurrency/rate decision.
- **Multi-tenant burst cost/time.** 10 users × 2000 AI-enabled listings = ~40,000 calls. Free tiers cannot; paid Tier 1 OpenAI is ~3h (TPM-bound), Tier 2+ ~45 min, Groq paid ~20–30 min. Mitigated by: (a) AI is opt-in per group — deterministic brand-strip is the free/instant default, so most bulk adds hit the LLM zero times; (b) the LlmService's internal 429 backoff paces every call; (c) provider is env-swappable per deployment/run. The user accepts paying; cost is trivial (~$4 worst case).
- **Groq capacity-throttling under burst.** Groq is fastest+cheapest but has historically queued/throttled under burst load — risky for the 10×2000 case. Mitigated by: gpt-4o-mini is the default (reliable); Groq is the opt-in alt for users who accept the tradeoff.
- **SSE parser fragility.** OpenAI-compatible SSE is simple but providers differ in keep-alive comments, partial-JSON framing, and `[DONE]` variants. Mitigated by a pure, unit-tested `parseSseChunk` helper that carries leftover bytes and ignores keep-alives.
- **Ollama OpenAI-compat quirks.** Ollama's `/v1/chat/completions` is compatible but historically has small divergences (e.g. `max_tokens` vs `max_predict`). Mitigated by sending both common shapes if needed; the transport test covers the exact body. OpenAI/Groq accept `max_tokens` natively — no issue on the prod path.
- **Content-gen behavior drift.** Migrating transport + model (llama3.2:1b → gpt-4o-mini or qwen3:1.7b) will change AI output. Accepted — content-gen already has a quality gate (length checks) + fallback, and AI output is non-deterministic by nature. The deterministic fallback (brand-strip + templates) is unchanged, so a regression in AI quality degrades gracefully, not silently. gpt-4o-mini is a quality upgrade over llama3.2:1b for TR, not a regression.
- **Retry policy.** The only internal retry is for HTTP 429 (rate limit), bounded by the call's `timeoutMs` budget + max 3 attempts, so a single `chat()` self-paces through a rate-limit window. All other failures (network, timeout, bad body) throw immediately — the create worker's BullMQ retry/backoff handles job-level retries, and content-gen falls back to deterministic on any `LlmError`. Deliberate — broader retry would complicate the seam and risk double-calling under the create path.

---

## Open questions (to resolve in the implementation plan)

1. **Errors location** — `LlmError` subclasses api-local (`apps/api/src/modules/llm/llm.errors.ts`) vs shared (`packages/shared/src/domain/llm/`). Lean: api-local (thrown/caught inside the API; not a wire DTO). Promote to shared only if C needs them serialized.
2. **`max_tokens` vs `max_predict`** — confirm Ollama's `/v1/chat/completions` accepts `max_tokens` (OpenAI field) and maps it. OpenAI/Groq accept `max_tokens` natively (the prod path). Only Ollama needs verifying; send `max_predict` too if Ollama rejects `max_tokens`. Resolved during implementation against a live pull.
3. **Content-gen timeouts** — keep 8s title / 15s description as per-call `timeoutMs` (preserving current behavior) vs unify under `LLM_TIMEOUT_MS`. Lean: keep per-call **but raise for bulk** — the 8s title timeout is too tight for 429 backoff; use a generous per-call timeout (e.g. 60s) so the internal rate-limit backoff has budget. Title vs description can still differ on `maxTokens`/`temperature`, just not on a tiny timeout.
4. **`LlmChatChunk.delta` shape** — accumulated-so-far (chosen) vs raw incremental delta. Chosen accumulated to spare consumers reassembly; revisit if C's SSE endpoint would prefer incremental (cheap to add an `incremental` field later without breaking).
5. **`LLM_ASSISTANT_MODEL` env now** — define it now (env-only, zero runtime cost) so C does not need new env and the per-use-case contract is visible. (Decided: yes.)
6. **Listings worker concurrency** — confirm whether the `listings` create worker has an env concurrency knob; if not, add `LISTINGS_WORKER_CONCURRENCY` so bulk+AI stays at 2–4 to avoid bursting the provider rate limit. Resolve in the plan by reading `listing-processor.service.ts`.
7. **LLM usage log shape** — B should append a cheap usage row (user_id, purpose, model, tokens_in, tokens_out, latency_ms, success, error?) on every `chat()`/`chatStream()` call so per-user cost attribution data exists when C/billing is designed. Confirm the table name + columns in the plan (mirror `keepa_usage_log`). No aggregation/billing UI in B.
8. **Create-only AI regression guard** — the plan MUST include a test (unit or a thin call-site assertion) that `ProductSyncService` does not pass `applyContentAi: true` to `prepareListingData`, and that the create worker does. This locks the hard rule against future accidental AI-on-refresh.
5. **`LLM_ASSISTANT_MODEL` env now** — define it now (env-only, zero runtime cost) so C does not need new env and the per-use-case contract is visible. (Decided: yes.)
6. **Listings worker concurrency** — confirm whether the `listings` create worker has an env concurrency knob; if not, whether to add one (`LISTINGS_WORKER_CONCURRENCY`) so bulk+AI stays at 1–2 to avoid bursting Groq's rate limit. Resolve in the plan by reading `listing-processor.service.ts`.
