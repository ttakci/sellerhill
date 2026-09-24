// apps/api/src/scripts/ebay-limits-probe.ts
//
// Asks eBay what THIS keyset's real API call limits are, instead of assuming
// the published defaults.
//
//   node dist/scripts/ebay-limits-probe.js                       (deployed container)
//   pnpm --filter api exec tsx src/scripts/ebay-limits-probe.ts  (local — sandbox keyset)
//
// WHY THIS EXISTS
// ---------------
// CLAUDE.md records the gap this closes: `EbayApiResource.ANALYTICS` exists in
// the enum but nothing calls it, so the platform has never asked eBay for its
// real limits and always assumes the configured defaults. A keyset that has
// passed an Application Growth Check does not have those defaults, and neither
// does one eBay has throttled.
//
// The immediate question is narrower. eBay's published limits table gives the
// Media API as "document resource: 1,000,000 API calls per day" — explicitly
// the DOCUMENT resource, with NO figure stated for the IMAGE resource we would
// use to host listing description images. The choice between eBay Picture
// Services and the Cloudflare R2 mirror turns on that number, and reading it
// off a table that does not state it is guessing. Building against a
// documented-but-unverified contract is exactly how the Aquiline integration
// was written against the wrong API once already.
//
// Read-only. Costs one of the Analytics API's 5,000 daily calls, and uses an
// APPLICATION token (client credentials) — no seller account, no database.
// Limits are per keyset, so the answer that matters comes from running this
// against the production keyset, not the sandbox one.
//
// Exit codes:
//   0 — limits retrieved and printed
//   2 — bad arguments
//   1 — configuration missing, or the call failed

import 'reflect-metadata';

import * as path from 'path';

import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const USAGE = [
  'Usage: node dist/scripts/ebay-limits-probe.js [--api-name <name>] [--json]',
  '',
  '  --api-name <name>  Show only this API (e.g. media, inventory, analytics).',
  '                     Matched case-insensitively as a substring.',
  '  --json             Print eBay\'s raw response instead of the table.',
].join('\n');

interface Args {
  apiName: string | null;
  json: boolean;
}

class ArgError extends Error {}

function parseArgs(argv: string[]): Args {
  const args: Args = { apiName: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--json') {
      args.json = true;
      continue;
    }
    if (token === '--api-name') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new ArgError('--api-name needs a value');
      }
      args.apiName = value.toLowerCase();
      i += 1;
      continue;
    }
    throw new ArgError(`unknown argument "${token}"`);
  }
  return args;
}

const log = (message: string): void => void process.stdout.write(`${message}\n`);
const logError = (message: string): void => void process.stderr.write(`${message}\n`);

interface Rate {
  limit: number | null;
  remaining: number | null;
  reset: string | null;
  timeWindow: number | null;
}

interface Resource {
  name: string;
  rates: Rate[];
}

interface RateLimitEntry {
  apiContext: string;
  apiName: string;
  apiVersion: string;
  resources: Resource[];
}

/**
 * An application token. Rate limits belong to the keyset, not to a seller, so
 * this deliberately does not touch the database or any connected store.
 */
async function getApplicationToken(tokenUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    // eBay wants the production scope string even against the sandbox host.
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`token request failed (${response.status}): ${text.slice(0, 400)}`);
  }
  const parsed = JSON.parse(text) as { access_token?: string };
  if (!parsed.access_token) {
    throw new Error(`token response carried no access_token: ${text.slice(0, 400)}`);
  }
  return parsed.access_token;
}

function formatRate(rate: Rate): string {
  const limit = rate.limit ?? '?';
  const remaining = rate.remaining ?? '?';
  const window = rate.timeWindow ? `${rate.timeWindow}s` : '?';
  const reset = rate.reset ?? '?';
  return `limit=${limit}  remaining=${remaining}  window=${window}  resets=${reset}`;
}

async function run(): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error: unknown) {
    logError(error instanceof ArgError ? error.message : String(error));
    logError(USAGE);
    return 2;
  }

  const clientId = process.env.EBAY_CLIENT_ID?.trim();
  const clientSecret = process.env.EBAY_CLIENT_SECRET?.trim();
  const tokenUrl = process.env.EBAY_TOKEN_URL?.trim();
  const restBase = process.env.EBAY_REST_API_URL?.trim();
  const environment = process.env.EBAY_ENVIRONMENT?.trim() || 'unknown';

  if (!clientId || !clientSecret || !tokenUrl || !restBase) {
    logError('EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_TOKEN_URL and EBAY_REST_API_URL must all be set.');
    return 1;
  }

  log(`eBay environment: ${environment}`);
  log(`Keyset (client id): ${clientId.slice(0, 12)}…`);
  log('');

  try {
    const token = await getApplicationToken(tokenUrl, clientId, clientSecret);
    const url = `${restBase.replace(/\/+$/, '')}/developer/analytics/v1_beta/rate_limit/`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const text = await response.text();

    if (!response.ok) {
      logError(`rate_limit call failed (${response.status})`);
      logError(text.slice(0, 1200));
      // 403 here usually means the keyset lacks Analytics access rather than
      // that the limits are unknowable — say so instead of leaving a bare code.
      if (response.status === 403) {
        logError('');
        logError('A 403 here normally means this keyset has no Analytics API access,');
        logError('not that the limits do not exist. That itself is an answer worth having.');
      }
      return 1;
    }

    if (args.json) {
      log(text);
      return 0;
    }

    const parsed = JSON.parse(text) as { rateLimits?: RateLimitEntry[] };
    const entries = parsed.rateLimits ?? [];
    if (entries.length === 0) {
      log('eBay returned no rate-limit entries. Raw body follows:');
      log(text.slice(0, 2000));
      return 0;
    }

    let shown = 0;
    for (const entry of entries) {
      if (args.apiName && !entry.apiName.toLowerCase().includes(args.apiName)) {
        continue;
      }
      shown += 1;
      log(`${entry.apiName}  (${entry.apiContext}, ${entry.apiVersion})`);
      for (const resource of entry.resources ?? []) {
        for (const rate of resource.rates ?? []) {
          log(`    ${resource.name.padEnd(34)} ${formatRate(rate)}`);
        }
      }
      log('');
    }

    if (shown === 0) {
      log(`No API matched "${args.apiName ?? ''}". Names eBay reported:`);
      for (const entry of entries) {
        log(`    ${entry.apiName}`);
      }
    }

    return 0;
  } catch (error: unknown) {
    logError(`probe failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

void run().then((code) => {
  process.exit(code);
});
