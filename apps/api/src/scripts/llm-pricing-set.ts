// apps/api/src/scripts/llm-pricing-set.ts
//
// Operator-only CLI to record what the configured LLM provider charges, so the
// admin Costs / FinOps surfaces can turn logged tokens into money.
//
//   pnpm --filter api exec tsx src/scripts/llm-pricing-set.ts \
//     --provider google --model gemini-3.1-flash-lite \
//     --input-per-1m 0 --output-per-1m 0
//
// Why a CLI and not a migration: the model id lives in env (LLM_CONTENT_MODEL)
// and provider prices change without our code changing. A hardcoded migration
// would be stale the day a tier is repriced or the model is swapped.
//
// Without a row here, `buildLlmUsageEvents` computes a NULL cost and the admin
// panel renders an em dash. That is deliberate — an unknown cost is never shown
// as 0. A real zero (a genuinely free tier) is a different thing, and recording
// it explicitly is how you tell the two apart.
//
// Prices are given per MILLION tokens in whole currency units (dollars) and
// stored as micro-units, matching the platform-wide micro-USD convention.
//
// Effective-dated: an existing open row for (provider, model, currency) is
// closed at NOW() and the new one opened at NOW(), in one transaction, so
// historical usage keeps the price that applied when it was incurred.
//
// Exit codes:
//   0 — pricing written
//   2 — bad arguments
//   1 — DB/transaction failure

import 'reflect-metadata';

import * as path from 'path';

import * as dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const USAGE = [
  'Usage: pnpm --filter api exec tsx src/scripts/llm-pricing-set.ts \\',
  '         --provider <name> --model <id> --input-per-1m <price> --output-per-1m <price>',
  '         [--embedding-per-1m <price>] [--currency USD]',
  '',
  'Prices are per MILLION tokens, in whole currency units (e.g. 0.30 = $0.30/1M).',
  '--provider must match what LlmService logs (the LLM_PROVIDER env value).',
].join('\n');

const MICROS_PER_UNIT = 1_000_000;

interface PricingArgs {
  provider: string;
  model: string;
  inputPerMillion: number;
  outputPerMillion: number;
  embeddingPerMillion: number;
  currency: string;
}

class PricingArgError extends Error {}

function log(message: string): void {
  console.warn(message);
}

function logError(message: string): void {
  console.error(message);
}

function toMicros(value: number, flag: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new PricingArgError(`${flag} must be a non-negative number`);
  }
  return Math.round(value * MICROS_PER_UNIT);
}

export function parsePricingArgs(argv: string[]): PricingArgs {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!flag.startsWith('--')) {
      throw new PricingArgError(`unexpected argument: ${flag}`);
    }
    if (value === undefined || value.startsWith('--')) {
      throw new PricingArgError(`${flag} requires a value`);
    }
    values.set(flag, value);
  }

  const known = new Set([
    '--provider',
    '--model',
    '--input-per-1m',
    '--output-per-1m',
    '--embedding-per-1m',
    '--currency',
  ]);
  for (const flag of values.keys()) {
    if (!known.has(flag)) {
      throw new PricingArgError(`unknown flag: ${flag}`);
    }
  }

  const provider = (values.get('--provider') ?? '').trim();
  const model = (values.get('--model') ?? '').trim();
  if (!provider || !model) {
    throw new PricingArgError('--provider and --model are required');
  }
  if (!values.has('--input-per-1m') || !values.has('--output-per-1m')) {
    throw new PricingArgError('--input-per-1m and --output-per-1m are required');
  }

  const currency = (values.get('--currency') ?? 'USD').trim().toUpperCase();
  if (currency.length !== 3) {
    throw new PricingArgError('--currency must be a 3-letter code');
  }

  return {
    provider,
    model,
    currency,
    inputPerMillion: toMicros(Number(values.get('--input-per-1m')), '--input-per-1m'),
    outputPerMillion: toMicros(Number(values.get('--output-per-1m')), '--output-per-1m'),
    embeddingPerMillion: toMicros(
      Number(values.get('--embedding-per-1m') ?? '0'),
      '--embedding-per-1m'
    ),
  };
}

async function run(): Promise<number> {
  let args: PricingArgs;
  try {
    args = parsePricingArgs(process.argv.slice(2));
  } catch (error: unknown) {
    if (error instanceof PricingArgError) {
      logError(`${error.message}\n${USAGE}`);
      return 2;
    }
    throw error;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logError('DATABASE_URL not set');
    return 1;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    /* Close the currently open row first — the partial unique index allows only
       one open row per (provider, model, currency). */
    const closed = await client.query(
      `UPDATE llm_model_pricing SET effective_to = NOW()
        WHERE provider = $1 AND model = $2 AND currency = $3 AND effective_to IS NULL`,
      [args.provider, args.model, args.currency]
    );
    await client.query(
      `INSERT INTO llm_model_pricing
         (provider, model, input_cost_per_million_micros, output_cost_per_million_micros,
          embedding_cost_per_million_micros, currency, effective_from)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        args.provider,
        args.model,
        args.inputPerMillion,
        args.outputPerMillion,
        args.embeddingPerMillion,
        args.currency,
      ]
    );
    await client.query('COMMIT');
    log(
      `pricing set: ${args.provider}/${args.model} ` +
        `in=${args.inputPerMillion} out=${args.outputPerMillion} micros per 1M ${args.currency}` +
        (closed.rowCount ? ` (superseded ${closed.rowCount} open row)` : '')
    );
    return 0;
  } catch (error: unknown) {
    await client.query('ROLLBACK').catch(() => undefined);
    logError(error instanceof Error ? error.message : String(error));
    return 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    logError(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
