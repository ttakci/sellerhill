// apps/api/src/scripts/aquiline-probe.ts
//
// Operator diagnostic for the Aquiline Integration API.
//
//   pnpm --filter api exec tsx src/scripts/aquiline-probe.ts [flags]
//
// WHY THIS EXISTS
// ---------------
// Aquiline publishes no sandbox, and the OpenAPI document it does publish is
// silent on the things most likely to break us: the webhook payload body (the
// document is OpenAPI 3.0.3, which has no `webhooks:` field at all), any size
// limit on the uploaded Amazon HTML, rate limits, and the shape of an error
// body. Waiting on support to relay each answer from their engineering team is
// slower and less precise than asking the API.
//
// Same role as `llm:check` for the LLM provider and `ebay:aspect-probe` for
// eBay taxonomy: find out before the pipeline depends on it.
//
// COST MODEL — READ BEFORE ADDING A FLAG
// --------------------------------------
// The stages are ordered by REVERSIBILITY, not by expense:
//
//   stage 0  read-only            free, repeatable
//   stage 2  order upsert + HTML  believed free (shipments are billed by
//                                 `assign`), repeatable
//   stage 3  assign               spends 1 of the plan's monthly shipments;
//                                 the allowance resets
//   stage 1  create profile       PERMANENT. `/v1/profiles/{id}` exposes only
//                                 GET and PATCH — there is no DELETE, while
//                                 `/v1/webhooks/{id}` has one, so the omission
//                                 is deliberate. Starter includes 10 profiles
//                                 and a created one can never be reclaimed.
//
// Hence stage 0 runs by default and every other stage needs an explicit flag;
// the two that cannot be undone or cost money need an extra confirmation flag.
// Do not add a "run everything" switch.
//
// Exit codes:
//   0 — every requested probe completed (findings are printed, not asserted)
//   1 — a probe failed in a way that blocks the integration
//   2 — bad arguments or missing configuration

import 'reflect-metadata';

import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Diagnostic output.
 *
 * Routed through `console.warn` rather than `console.log` for the same reason
 * `llm-check.ts` does it: the repo lints `no-console` with only `warn`/`error`
 * allowed, and a file-wide `eslint-disable` would suppress real findings along
 * with the intended output.
 */
function log(message: string): void {
  console.warn(message);
}

function logError(message: string): void {
  console.error(message);
}

const DEFAULT_BASE_URL = 'https://aquiline-tracking.com/app/api/integration';

const USAGE = [
  'Usage: pnpm --filter api exec tsx src/scripts/aquiline-probe.ts [flags]',
  '',
  'Stage 0 (default, free, read-only):',
  '  (no flags)                     GET /v1/me, /v1/profiles, /v1/webhooks + a',
  '                                 deliberate 404 to reveal the error body shape.',
  '',
  'Stage 1 (PERMANENT — consumes a profile slot that cannot be reclaimed):',
  '  --create-profile <profileId>   create it, then POST the same id again to',
  '                                 learn whether repeat creation is idempotent',
  '  --profile-email <email>        optional amazonAccountEmail hint',
  '  --yes-permanent                required; without it the stage is refused',
  '',
  'Stage 2 (believed free, repeatable):',
  '  --profile <profileId>          profile to work under (required for 2-4)',
  '  --upsert-order <amazonOrderId> upsert one order',
  '  --upload-html <file>           upload ship-track HTML for --upsert-order',
  '  --pad-to-mb <n>                grow the HTML with a comment to find the',
  '                                 size limit without changing its content',
  '  --tracking-url <url>           the ship-track URL the HTML came from',
  '',
  'Stage 3 (BILLABLE — spends one of the monthly shipments):',
  '  --assign                       assign, then assign again to test idempotency',
  '  --yes-billable                 required; without it the stage is refused',
  '',
  'Stage 4 (free):',
  '  --register-webhook <url>       register a receiver and print the response',
  '',
  'Reads AQUILINE_API_KEY (as "<tokenId>.<tokenSecret>") and optional',
  'AQUILINE_BASE_URL from apps/api/.env. Never writes to the SellerHill database.',
].join('\n');

interface Args {
  createProfile?: string;
  profileEmail?: string;
  profile?: string;
  upsertOrder?: string;
  uploadHtml?: string;
  padToMb?: number;
  trackingUrl?: string;
  assign: boolean;
  registerWebhook?: string;
  yesPermanent: boolean;
  yesBillable: boolean;
}

class ArgError extends Error {}

function parseArgs(argv: string[]): Args {
  const args: Args = { assign: false, yesPermanent: false, yesBillable: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const takeValue = (): string => {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new ArgError(`${flag} requires a value`);
      }
      i += 1;
      return value;
    };
    switch (flag) {
      case '--create-profile': args.createProfile = takeValue(); break;
      case '--profile-email': args.profileEmail = takeValue(); break;
      case '--profile': args.profile = takeValue(); break;
      case '--upsert-order': args.upsertOrder = takeValue(); break;
      case '--upload-html': args.uploadHtml = takeValue(); break;
      case '--pad-to-mb': args.padToMb = Number(takeValue()); break;
      case '--tracking-url': args.trackingUrl = takeValue(); break;
      case '--assign': args.assign = true; break;
      case '--register-webhook': args.registerWebhook = takeValue(); break;
      case '--yes-permanent': args.yesPermanent = true; break;
      case '--yes-billable': args.yesBillable = true; break;
      case '--help': case '-h': log(USAGE); process.exit(0); break;
      default: throw new ArgError(`Unknown flag: ${flag}`);
    }
  }
  return args;
}

interface Probe {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: unknown;
  raw: string;
  ms: number;
}

/**
 * One raw HTTP call, printing everything.
 *
 * Deliberately does NOT reuse `AquilineClient`: the point is to observe what
 * the provider actually sends, including the fields and headers our own types
 * do not model yet. Going through the typed client would hide exactly the
 * information this script exists to find.
 */
async function call(
  method: string,
  route: string,
  options: { body?: unknown; baseUrl: string; token: string },
): Promise<Probe> {
  const url = `${options.baseUrl.replace(/\/+$/, '')}${route}`;
  const startedAt = Date.now();
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${options.token}`,
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const raw = await response.text();
  let body: unknown = raw;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    /* leave as text — a non-JSON error body is itself a finding */
  }
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return { status: response.status, ok: response.ok, headers, body, raw, ms: Date.now() - startedAt };
}

function report(label: string, probe: Probe): void {
  const mark = probe.ok ? 'OK  ' : 'FAIL';
  log(`\n[${mark}] ${label} — ${probe.status} in ${probe.ms}ms`);
  log(JSON.stringify(probe.body, null, 2).slice(0, 4000));
}

/**
 * Rate-limit headers, if the provider sends any.
 *
 * The API document says nothing about rate limits, and the only alternative to
 * reading them off a response is deliberately hammering the endpoint — which is
 * rude and risks being flagged. If nothing shows up here, it becomes a support
 * question rather than an experiment.
 */
function reportRateLimitHeaders(probe: Probe): void {
  const interesting = Object.entries(probe.headers).filter(([key]) =>
    /ratelimit|retry-after|x-quota|x-usage/i.test(key),
  );
  log('\n--- rate-limit headers ---');
  log(
    interesting.length === 0
      ? 'none advertised — ask support (Q5)'
      : interesting.map(([k, v]) => `  ${k}: ${v}`).join('\n'),
  );
}

async function main(): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    logError(`${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }

  const token = process.env.AQUILINE_API_KEY?.trim();
  const baseUrl = process.env.AQUILINE_BASE_URL?.trim() || DEFAULT_BASE_URL;
  if (!token) {
    logError('AQUILINE_API_KEY is not set (expected "<tokenId>.<tokenSecret>").\n');
    return 2;
  }
  if (!token.includes('.')) {
    log('Warning: AQUILINE_API_KEY has no "." — the documented format is tokenId.tokenSecret.\n');
  }
  const ctx = { baseUrl, token };
  log(`Aquiline probe against ${baseUrl}`);

  // ---------------------------------------------------------------- stage 0
  log('\n=== stage 0 — read-only ===');
  const me = await call('GET', '/v1/me', ctx);
  report('GET /v1/me', me);
  if (!me.ok) {
    logError('\nAuth failed — nothing else can run. Check the token and base URL.');
    return 1;
  }
  reportRateLimitHeaders(me);

  const profiles = await call('GET', '/v1/profiles', ctx);
  report('GET /v1/profiles', profiles);
  const items = (profiles.body as { items?: unknown[] })?.items;
  if (Array.isArray(items)) {
    log(`\nProfiles in use: ${items.length}. Starter includes 10, and they cannot be deleted.`);
  }

  report('GET /v1/webhooks', await call('GET', '/v1/webhooks', ctx));

  // The error body shape is undocumented; our client currently classifies on
  // free text. A deliberate 404 is the cheapest way to see the real shape.
  report(
    'GET /v1/profiles/{unknown} (deliberate 404 — reveals the error body)',
    await call('GET', '/v1/profiles/sh-probe-does-not-exist', ctx),
  );

  // ---------------------------------------------------------------- stage 1
  if (args.createProfile) {
    if (!args.yesPermanent) {
      logError(
        '\nRefusing --create-profile without --yes-permanent.\n' +
          'A profile consumes one of the plan slots FOREVER: the API has no ' +
          'DELETE /v1/profiles/{id}, and there is no sandbox, so a throwaway ' +
          'test profile is indistinguishable from a real one.',
      );
      return 2;
    }
    log('\n=== stage 1 — create profile (PERMANENT) ===');
    const createBody = {
      accountOrigin: 'amazon',
      profileId: args.createProfile,
      label: args.createProfile,
      marketplaceHost: 'www.amazon.com',
      ...(args.profileEmail ? { amazonAccountEmail: args.profileEmail } : {}),
    };
    report('POST /v1/profiles', await call('POST', '/v1/profiles', { ...ctx, body: createBody }));

    // Q11: is repeat creation idempotent? Our design derives the profile id
    // deterministically and relies on being able to re-POST after a crash, so
    // a 409 here would mean adding an explicit "does it exist?" read first.
    report(
      'POST /v1/profiles again, same id (Q11 — idempotent, 409, or duplicate?)',
      await call('POST', '/v1/profiles', { ...ctx, body: createBody }),
    );
  }

  const profileId = args.profile ?? args.createProfile;

  // ---------------------------------------------------------------- stage 2
  if (args.upsertOrder) {
    if (!profileId) {
      logError('\n--upsert-order needs --profile <profileId>.');
      return 2;
    }
    log('\n=== stage 2 — order upsert + HTML ===');
    report(
      'POST /v1/profiles/{p}/orders/upsert',
      await call('POST', `/v1/profiles/${encodeURIComponent(profileId)}/orders/upsert`, {
        ...ctx,
        body: {
          orders: [
            {
              marketplaceOrderId: args.upsertOrder,
              status: 'Shipping',
              ...(args.trackingUrl ? { trackingUrl: args.trackingUrl } : {}),
            },
          ],
        },
      }),
    );
  }

  if (args.uploadHtml) {
    if (!profileId || !args.upsertOrder) {
      logError('\n--upload-html needs --profile and --upsert-order.');
      return 2;
    }
    if (!args.trackingUrl) {
      logError('\n--upload-html needs --tracking-url (the page the HTML came from).');
      return 2;
    }
    let html = fs.readFileSync(path.resolve(args.uploadHtml), 'utf8');

    // Q1: grow the SAME document with an HTML comment. Padding rather than
    // generating synthetic markup keeps the content valid, so a rejection can
    // only be about size — a synthetic page would be refused as
    // `wrong_page_type` long before any limit was reached.
    if (args.padToMb && Number.isFinite(args.padToMb)) {
      const target = args.padToMb * 1024 * 1024;
      if (target > html.length) {
        html += `<!--${'x'.repeat(target - html.length - 7)}-->`;
      }
    }
    log(`\nUploading ${(html.length / 1024 / 1024).toFixed(2)} MB of HTML`);
    report(
      'POST /v1/profiles/{p}/orders/{o}/tracking-html (Q1 — size limit)',
      await call(
        'POST',
        `/v1/profiles/${encodeURIComponent(profileId)}/orders/${encodeURIComponent(args.upsertOrder)}/tracking-html`,
        { ...ctx, body: { trackingUrl: args.trackingUrl, html } },
      ),
    );
  }

  // ---------------------------------------------------------------- stage 3
  if (args.assign) {
    if (!profileId || !args.upsertOrder || !args.trackingUrl) {
      logError('\n--assign needs --profile, --upsert-order and --tracking-url.');
      return 2;
    }
    if (!args.yesBillable) {
      logError(
        '\nRefusing --assign without --yes-billable. It spends one of the ' +
          "plan's monthly Aquiline shipments (300 on Starter).",
      );
      return 2;
    }
    log('\n=== stage 3 — assign (BILLABLE) ===');
    const route = `/v1/profiles/${encodeURIComponent(profileId)}/orders/${encodeURIComponent(args.upsertOrder)}/assign`;
    // Follows the schema's Amazon example: `retailer`, no `carrier`. Support's
    // 2026-08-13 reply showed `carrier: "Amazon"` instead — the schema
    // documents `carrier` as "required for non-Amazon assign", so sending it
    // here risks `assign_validation`. Q13 asks them to confirm.
    const assignBody = {
      trackingUrl: args.trackingUrl,
      retailer: 'amazon-us',
      marketplaceHost: 'www.amazon.com',
      sourceTracking: 'Amazon',
    };
    report('POST …/assign (Q4 — does it work right after an accepted upload?)',
      await call('POST', route, { ...ctx, body: assignBody }));

    // Q3: support says a repeat assign is idempotent and returns
    // `reused: true`, but that field is in no documented schema. Comparing the
    // plan counter before and after is what actually proves we are not billed
    // twice, because a retry on the conversion path is normal.
    const second = await call('POST', route, { ...ctx, body: assignBody });
    report('POST …/assign again (Q3 — same number? billed twice?)', second);
    report('GET /v1/me after two assigns (compare planUsed with stage 0)',
      await call('GET', '/v1/me', ctx));
  }

  // ---------------------------------------------------------------- stage 4
  if (args.registerWebhook) {
    log('\n=== stage 4 — webhook registration ===');
    report(
      'POST /v1/webhooks (Q2 — payload shape is learned from what arrives)',
      await call('POST', '/v1/webhooks', {
        ...ctx,
        body: {
          url: args.registerWebhook,
          events: [
            'tracking.html.accepted',
            'tracking.html.applied',
            'tracking.html.rejected',
            'tracking.problem.opened',
            'tracking.problem.cleared',
          ],
        },
      }),
    );
    log(
      '\nThe secret is returned ONCE — copy it into AQUILINE_WEBHOOK_SECRET now.\n' +
        'There is no PATCH for a webhook, only create and delete.',
    );
  }

  log('\nDone.');
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    logError(`\nProbe crashed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
