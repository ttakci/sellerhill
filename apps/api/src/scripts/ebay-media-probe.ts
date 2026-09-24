// apps/api/src/scripts/ebay-media-probe.ts
//
// Uploads ONE Amazon image to eBay Picture Services and reports exactly what
// comes back, so the choice between EPS and the Cloudflare R2 mirror rests on
// measurement rather than on a reading of the documentation.
//
//   node dist/scripts/ebay-media-probe.js --image-url "<amazon image url>"
//
// WHY THIS EXISTS
// ---------------
// The R2 mirror exists because the eBay description hot-links the Amazon image,
// naming the supplier in every live listing's page source. eBay's own Media API
// could serve the same purpose with no bucket, no CDN, no garbage collector and
// no monthly bill — and `i.ebayimg.com` is the domain a buyer already expects on
// an eBay listing, whereas our own domain identifies the TOOL to a competitor.
//
// Three things decide it, and the documentation answers none of them:
//
//   1. Does `createImageFromUrl` accept an Amazon-hosted URL at all? eBay has to
//      fetch it server-side, and it may refuse a host it does not like.
//   2. What does the returned EPS URL look like, and what is its expirationDate?
//      The docs say an image survives "as long as it is used in an active
//      listing" without defining used — if a description reference does not
//      count, an EPS image in a description would silently expire, and the
//      description is never revised after publish.
//   3. Which host serves the Media API. The docs show `apim.ebay.com` in one
//      place and `apiz.ebay.com` in another; this repo's constants carry a third.
//
// THIS WRITES TO EBAY. One image is uploaded under the connected seller's
// account. It is not free of consequence, but it is bounded and self-cleaning:
// an unused EPS image expires on its own, and the expiry date is one of the
// things being measured. Nothing is published, no listing is touched.
//
// Exit codes:
//   0 — the upload and read-back completed; findings are printed, not asserted
//   2 — bad arguments
//   1 — configuration missing, no connected store, or the probe failed

import 'reflect-metadata';

import * as path from 'path';

import * as dotenv from 'dotenv';
import { Pool } from 'pg';

import { EncryptionUtil } from '../common/utils/encryption.util';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/** The hosts the eBay docs and this repo disagree about. Tried in this order. */
const MEDIA_HOST_CANDIDATES_PRODUCTION = ['https://apim.ebay.com', 'https://apiz.ebay.com', 'https://api.ebay.com'];
const MEDIA_HOST_CANDIDATES_SANDBOX = [
  'https://apim.sandbox.ebay.com',
  'https://apiz.sandbox.ebay.com',
  'https://api.sandbox.ebay.com',
];

const MEDIA_PATH = '/commerce/media/v1_beta/image';

const USAGE = [
  'Usage: node dist/scripts/ebay-media-probe.js --image-url <url> [--account-id <uuid>] [--base-url <url>]',
  '',
  '  --image-url <url>    REQUIRED. An https Amazon product image to upload.',
  '  --account-id <uuid>  Which connected eBay store to upload as.',
  '                       Defaults to the oldest active one.',
  '  --base-url <url>     Skip host discovery and use this Media API host.',
].join('\n');

interface Args {
  imageUrl: string | null;
  accountId: string | null;
  baseUrl: string | null;
}

class ArgError extends Error {}

function parseArgs(argv: string[]): Args {
  const args: Args = { imageUrl: null, accountId: null, baseUrl: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const value = argv[i + 1];
    const needValue = (flag: string): string => {
      if (!value || value.startsWith('--')) {
        throw new ArgError(`${flag} needs a value`);
      }
      i += 1;
      return value;
    };
    if (token === '--image-url') {
      args.imageUrl = needValue('--image-url');
      continue;
    }
    if (token === '--account-id') {
      args.accountId = needValue('--account-id');
      continue;
    }
    if (token === '--base-url') {
      args.baseUrl = needValue('--base-url');
      continue;
    }
    throw new ArgError(`unknown argument "${token}"`);
  }
  if (!args.imageUrl) {
    throw new ArgError('--image-url is required');
  }
  if (!args.imageUrl.startsWith('https://')) {
    throw new ArgError('--image-url must be https — eBay refuses plain http');
  }
  return args;
}

const log = (message: string): void => void process.stdout.write(`${message}\n`);
const logError = (message: string): void => void process.stderr.write(`${message}\n`);

interface AccountRow {
  id: string;
  seller_id: string;
  ebay_username: string | null;
  refresh_token: string;
}

/** Tokens are stored `enc:`-prefixed; a legacy row may still be plaintext. */
function decryptToken(value: string, crypto: EncryptionUtil): string {
  return value.startsWith('enc:') ? crypto.decrypt(value.slice(4)) : value;
}

async function refreshUserToken(tokenUrl: string, clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`token refresh failed (${response.status}): ${text.slice(0, 400)}`);
  }
  const parsed = JSON.parse(text) as { access_token?: string };
  if (!parsed.access_token) {
    throw new Error(`refresh response carried no access_token: ${text.slice(0, 400)}`);
  }
  return parsed.access_token;
}

interface UploadOutcome {
  host: string;
  status: number;
  locationHeader: string | null;
  body: string;
}

/**
 * Try each candidate host until one answers something other than a routing
 * failure. Which host serves this API is one of the things being measured, so
 * every attempt is reported rather than only the one that worked.
 */
async function uploadFromUrl(hosts: string[], token: string, imageUrl: string): Promise<UploadOutcome> {
  let last: UploadOutcome | null = null;
  for (const host of hosts) {
    const url = `${host}${MEDIA_PATH}/create_image_from_url`;
    log(`  trying ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ imageUrl }),
    });
    const body = await response.text();
    const outcome: UploadOutcome = {
      host,
      status: response.status,
      locationHeader: response.headers.get('location'),
      body,
    };
    log(`    → ${response.status}${outcome.locationHeader ? ' (Location header present)' : ''}`);
    if (response.status !== 404) {
      return outcome;
    }
    last = outcome;
  }
  if (!last) {
    throw new Error('no hosts were tried');
  }
  return last;
}

function extractImageId(location: string | null, body: string): string | null {
  if (location) {
    const tail = location.split('/').filter(Boolean).pop();
    if (tail) {
      return tail;
    }
  }
  try {
    const parsed = JSON.parse(body) as { imageId?: string };
    return parsed.imageId ?? null;
  } catch {
    return null;
  }
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
  const encryptionKey = process.env.AMAZON_ENCRYPTION_KEY?.trim();
  const environment = process.env.EBAY_ENVIRONMENT?.trim() || 'production';

  if (!clientId || !clientSecret || !tokenUrl || !encryptionKey) {
    logError('EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_TOKEN_URL and AMAZON_ENCRYPTION_KEY must all be set.');
    return 1;
  }

  const hosts = args.baseUrl
    ? [args.baseUrl.replace(/\/+$/, '')]
    : environment === 'sandbox'
      ? MEDIA_HOST_CANDIDATES_SANDBOX
      : MEDIA_HOST_CANDIDATES_PRODUCTION;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows } = await pool.query<AccountRow>(
      args.accountId
        ? `SELECT id, seller_id, ebay_username, refresh_token FROM ebay_accounts WHERE id = $1`
        : `SELECT id, seller_id, ebay_username, refresh_token FROM ebay_accounts
            WHERE status = 'active' AND refresh_token IS NOT NULL
            ORDER BY created_at ASC LIMIT 1`,
      args.accountId ? [args.accountId] : [],
    );

    const account = rows[0];
    if (!account) {
      logError('No connected eBay store found. Connect one, or pass --account-id.');
      return 1;
    }

    log(`eBay environment : ${environment}`);
    log(`Store            : ${account.ebay_username ?? account.seller_id} (${account.id})`);
    log(`Source image     : ${args.imageUrl}`);
    log('');

    const crypto = new EncryptionUtil(encryptionKey);
    const token = await refreshUserToken(
      tokenUrl,
      clientId,
      clientSecret,
      decryptToken(account.refresh_token, crypto),
    );

    log('1. createImageFromUrl');
    const upload = await uploadFromUrl(hosts, token, args.imageUrl as string);
    log('');

    if (upload.status !== 201) {
      log(`FINDING: eBay refused the upload (HTTP ${upload.status}) from ${upload.host}`);
      log('Response body:');
      log(upload.body.slice(0, 2000));
      log('');
      log('If this is a 400 about the imageUrl, eBay will not fetch Amazon-hosted');
      log('images and the EPS route is closed — the R2 mirror stays.');
      return 0;
    }

    log(`FINDING: eBay ACCEPTED an Amazon-hosted URL. Media host is ${upload.host}`);
    log(`Location header: ${upload.locationHeader ?? '(none)'}`);

    const imageId = extractImageId(upload.locationHeader, upload.body);
    if (!imageId) {
      log('FINDING: could not read an image id from the Location header or body.');
      log(upload.body.slice(0, 2000));
      return 0;
    }
    log(`Image id: ${imageId}`);
    log('');

    log('2. getImage');
    const getUrl = `${upload.host}${MEDIA_PATH}/${imageId}`;
    log(`  ${getUrl}`);
    const getResponse = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const getBody = await getResponse.text();
    log(`    → ${getResponse.status}`);
    log('');

    if (!getResponse.ok) {
      log(`FINDING: getImage failed (${getResponse.status}).`);
      log(getBody.slice(0, 2000));
      return 0;
    }

    const image = JSON.parse(getBody) as {
      imageUrl?: string;
      maxDimensionImageUrl?: string;
      expirationDate?: string;
    };

    log('FINDINGS');
    log(`  EPS URL          : ${image.imageUrl ?? '(none)'}`);
    log(`  Max-dimension URL: ${image.maxDimensionImageUrl ?? '(none)'}`);
    log(`  Expiration date  : ${image.expirationDate ?? '(none returned)'}`);
    log('');
    log('Read the expiration date carefully. It is the date an UNUSED image is');
    log('removed. If we use this same URL as the listing gallery picture, the');
    log('image counts as in use and persists — which is the plan, and is why the');
    log('description reference does not have to be what keeps it alive.');

    return 0;
  } catch (error: unknown) {
    logError(`probe failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await pool.end();
  }
}

void run().then((code) => {
  process.exit(code);
});
