// apps/api/src/scripts/llm-check.ts
//
// Operator diagnostic: prove the configured LLM provider actually answers the
// two questions the listing pipeline asks it, BEFORE a bulk add depends on it.
//
//   pnpm --filter api exec tsx src/scripts/llm-check.ts [--model <id>]
//
// Why this exists: swapping providers is a one-line env change, which is what
// makes it easy to get subtly wrong. Every failure below has already happened
// in this project and none of them raise an error at runtime — the listing just
// silently falls back to the deterministic title with no signal:
//
//   * a THINKING model spends the whole token budget reasoning and returns
//     finish_reason=length (truncated) or an empty content field. Measured on
//     both `qwen3:1.7b` (local) and `gemini-3.6-flash` at our 256-token title
//     cap. Use a non-thinking / `-lite` / `-instruct` tier.
//   * a model id that belongs to a DIFFERENT provider than LLM_BASE_URL → 404
//     (e.g. `gpt-4o-mini` left over in LLM_ASSISTANT_MODEL while the base URL
//     points at Gemini).
//   * an aspect answer that is not in eBay's allowed list — the resolver
//     discards it, so the aspect silently degrades to the terminal fallback.
//
// Read-only: sends two small chat completions and writes nothing.
//
// Exit codes:
//   0 — every probe passed
//   1 — a probe failed (see the printed reason)
//   2 — bad arguments or missing configuration

import 'reflect-metadata';

import * as path from 'path';

import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const USAGE = [
  'Usage: pnpm --filter api exec tsx src/scripts/llm-check.ts [--model <model-id>]',
  '',
  'Sends one title-rewrite and one item-specific probe through the provider in',
  'LLM_BASE_URL and reports whether the answers are usable. Writes nothing.',
].join('\n');

/** Mirrors ContentGenerationService.rewriteTitle's budget. */
const TITLE_MAX_TOKENS = 256;
/** Mirrors AspectLlmService.chooseValue's determinism. */
const ASPECT_TEMPERATURE = 0;
const TITLE_TEMPERATURE = 0.3;
const REQUEST_TIMEOUT_MS = 30_000;
/** `isTitleRewriteAcceptable` rejects a title under 60% of eBay's 80 chars. */
const MIN_USEFUL_TITLE_LENGTH = 48;

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: unknown }; finish_reason?: string | null }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

interface ProbeOutcome {
  name: string;
  ok: boolean;
  detail: string;
  text: string;
  latencyMs: number;
  finishReason: string;
  promptTokens: number;
  completionTokens: number;
}

function log(message: string): void {
  console.warn(message);
}

function logError(message: string): void {
  console.error(message);
}

function parseArgs(argv: string[]): { model?: string } {
  const result: { model?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--model') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--model requires a value');
      }
      result.model = value;
      i += 1;
      continue;
    }
    throw new Error(`unknown argument: ${argv[i]}`);
  }
  return result;
}

/** Same request shape as LlmService.buildRequest — this is what production sends. */
async function chat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number
): Promise<{ response: ChatResponse; latencyMs: number }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = Date.now();
  try {
    const result = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      signal: controller.signal,
    });
    if (!result.ok) {
      const body = await result.text().catch(() => '');
      throw new Error(`HTTP ${result.status}${body ? `: ${body.slice(0, 300)}` : ''}`);
    }
    return { response: (await result.json()) as ChatResponse, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function readOutcome(
  name: string,
  response: ChatResponse,
  latencyMs: number
): Omit<ProbeOutcome, 'ok' | 'detail'> {
  const raw = response.choices?.[0]?.message?.content;
  return {
    name,
    text: typeof raw === 'string' ? raw.trim() : '',
    latencyMs,
    finishReason: response.choices?.[0]?.finish_reason ?? 'unknown',
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
  };
}

/**
 * Compress a long Amazon title into eBay's 80 characters — the exact job
 * `ContentGenerationService.rewriteTitle` does, with the same token budget.
 */
async function probeTitle(baseUrl: string, apiKey: string, model: string): Promise<ProbeOutcome> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: [
        'You write eBay listing titles for dropshippers.',
        'The source title is usually far longer than 80 characters: compress it, do not summarise it.',
        'Use 65-80 characters. Never go under 60 unless the source is shorter.',
        'Keep every distinguishing search term from the source: model numbers, sizes, counts, pack quantities, colours, product line names.',
        'Keep the brand name if the source has one.',
        'English only. No quotes. No HTML. One line only.',
        'Do not invent false claims. Reply with only the title text.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        'Brand: BIC',
        'Source title: BIC Xtra-Smooth Mechanical Pencils With Erasers, Medium Point (0.7mm), 40-Count Pack, Bulk Mechanical Pencils for School or Office Supplies, Pastel Barrels',
      ].join('\n'),
    },
  ];

  const { response, latencyMs } = await chat(
    baseUrl,
    apiKey,
    model,
    messages,
    TITLE_TEMPERATURE,
    TITLE_MAX_TOKENS
  );
  const base = readOutcome('title rewrite', response, latencyMs);

  if (base.text.length === 0) {
    return {
      ...base,
      ok: false,
      detail: 'empty content — the model spent the budget thinking. Use a non-thinking model.',
    };
  }
  if (base.finishReason === 'length') {
    return {
      ...base,
      ok: false,
      detail: `truncated at the ${TITLE_MAX_TOKENS}-token cap — thinking model. Use a -lite / -instruct tier.`,
    };
  }
  if (base.text.length < MIN_USEFUL_TITLE_LENGTH) {
    return {
      ...base,
      ok: false,
      detail: `${base.text.length} chars — under the acceptance floor, the deterministic title would win every time.`,
    };
  }
  return { ...base, ok: true, detail: `${base.text.length} chars` };
}

/**
 * Pick one value from a category's allowed list — what `AspectLlmService` asks.
 * An answer outside the list is discarded by the resolver, so a model that
 * paraphrases instead of choosing is worse than useless here.
 */
async function probeAspect(baseUrl: string, apiKey: string, model: string): Promise<ProbeOutcome> {
  const allowed = ['Unisex Adult', 'Men', 'Women', 'Boys', 'Girls'];
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: [
        'You select eBay item specifics.',
        'Reply with exactly one value copied verbatim from the allowed list.',
        'No explanation, no quotes, no punctuation of your own.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        'Product: BIC Xtra-Smooth Mechanical Pencils, 40-Count Pack, school and office supplies',
        'Aspect: Department',
        `Allowed values: ${allowed.join(' | ')}`,
      ].join('\n'),
    },
  ];

  const { response, latencyMs } = await chat(baseUrl, apiKey, model, messages, ASPECT_TEMPERATURE, 64);
  const base = readOutcome('item specific', response, latencyMs);

  if (base.text.length === 0) {
    return { ...base, ok: false, detail: 'empty content — the model spent the budget thinking.' };
  }
  if (!allowed.includes(base.text)) {
    return {
      ...base,
      ok: false,
      detail: 'not an exact allowed value — the resolver would discard it and fall back.',
    };
  }
  return { ...base, ok: true, detail: 'exact match from the allowed list' };
}

function report(outcome: ProbeOutcome): void {
  log(`\n${outcome.ok ? 'PASS' : 'FAIL'}  ${outcome.name}`);
  log(
    `      ${outcome.latencyMs}ms · finish=${outcome.finishReason} · ` +
      `tokens in=${outcome.promptTokens} out=${outcome.completionTokens}`
  );
  log(`      ${outcome.detail}`);
  log(`      -> ${outcome.text || '(empty)'}`);
}

async function run(): Promise<number> {
  let args: { model?: string };
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error: unknown) {
    logError(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    return 2;
  }

  const baseUrl = (process.env.LLM_BASE_URL ?? '').trim().replace(/\/$/, '');
  const apiKey = (process.env.LLM_API_KEY ?? '').trim();
  const model = args.model ?? (process.env.LLM_CONTENT_MODEL ?? '').trim();

  if (!baseUrl) {
    logError('LLM_BASE_URL is not set');
    return 2;
  }
  if (!model) {
    logError('LLM_CONTENT_MODEL is not set (or pass --model)');
    return 2;
  }

  log(`endpoint : ${baseUrl}`);
  log(`model    : ${model}`);
  log(`api key  : ${apiKey ? 'set' : 'MISSING — hosted providers will reject this'}`);

  const outcomes: ProbeOutcome[] = [];
  for (const probe of [probeTitle, probeAspect]) {
    try {
      outcomes.push(await probe(baseUrl, apiKey, model));
    } catch (error: unknown) {
      logError(`\nFAIL  request failed: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
  }

  outcomes.forEach(report);
  const failed = outcomes.filter((outcome) => !outcome.ok);
  log(`\n${failed.length === 0 ? 'All probes passed.' : `${failed.length} probe(s) failed.`}`);
  return failed.length === 0 ? 0 : 1;
}

run()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    logError(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
