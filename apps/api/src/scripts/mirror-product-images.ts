// apps/api/src/scripts/mirror-product-images.ts
//
// Mirror the description image of products that predate the image mirror.
//
//   pnpm --filter api run mirror:images -- --limit 100000
//   pnpm --filter api run mirror:images -- --dry-run
//
// Resumable by construction: it claims only rows whose watermark is NULL, and
// `ImageMirrorService` stamps each row as it succeeds, so an interrupted run
// resumes where it stopped and a re-run costs nothing for rows already done.
//
// Sequential, with a small delay between rows, on purpose. This is the one
// place that fetches from Amazon in bulk from a single datacenter IP, and that
// IP is shared with the Playwright checkout pool — being throttled here would
// degrade order fulfillment, which matters far more than finishing sooner.
//
// Exit codes:
//   0 — completed (including a dry run)
//   2 — bad arguments
//   1 — configuration missing, or a fatal failure

import 'reflect-metadata';

import * as path from 'path';

import * as dotenv from 'dotenv';
import { Pool } from 'pg';

import { ImageMirrorService } from '../modules/image-mirror/image-mirror.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DEFAULT_LIMIT = 5000;
const DELAY_MS = 120;

const USAGE = [
  'Usage: pnpm --filter api run mirror:images -- [--limit N] [--dry-run]',
  '',
  '  --limit N   Maximum products to process (default 5000)',
  '  --dry-run   Report how many would be mirrored, write nothing',
].join('\n');

interface Args {
  limit: number;
  dryRun: boolean;
}

class ArgError extends Error {}

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: DEFAULT_LIMIT, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--limit') {
      const value = Number(argv[i + 1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new ArgError(`--limit needs a positive integer, got "${argv[i + 1] ?? ''}"`);
      }
      args.limit = value;
      i += 1;
      continue;
    }
    throw new ArgError(`unknown argument "${token}"`);
  }
  return args;
}

const log = (message: string): void => void process.stdout.write(`${message}\n`);
const logError = (message: string): void => void process.stderr.write(`${message}\n`);
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface PendingRow {
  id: string;
  url: string;
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

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // The service reaches ConfigService and DatabaseService through one method
  // each, so plain objects are enough. That keeps the script from booting the
  // Nest container — and with it every scheduler and queue worker, which a
  // backfill has no business starting.
  //
  // `database.query` returns the ROW ARRAY, not the raw pg `QueryResult` —
  // `DatabaseService.query<T>()` resolves to `Promise<T[]>`, so this shim has
  // to match that shape even though `ImageMirrorService.ensureMirrored` never
  // reads the return value today.
  const config = { get: (key: string) => process.env[key] };
  const database = {
    query: async (text: string, params?: unknown[]): Promise<unknown[]> => {
      const result = await pool.query<Record<string, unknown>>(text, params);
      return result.rows;
    },
  };
  const mirror = new ImageMirrorService(config as never, database as never);

  if (!mirror.isConfigured()) {
    logError('R2_* / IMAGE_CDN_BASE_URL are not all set — nothing to do.');
    await pool.end();
    return 1;
  }

  try {
    const { rows } = await pool.query<PendingRow>(
      `SELECT id, image_urls->>0 AS url
         FROM products
        WHERE image_mirrored_at IS NULL
          AND image_urls->>0 IS NOT NULL
        ORDER BY id ASC
        LIMIT $1`,
      [args.limit],
    );

    log(`${rows.length} product(s) pending.`);
    if (args.dryRun) {
      log('Dry run — nothing written.');
      return 0;
    }

    let mirrored = 0;
    let skipped = 0;
    for (const [index, row] of rows.entries()) {
      // ensureMirrored never throws: a failure returns null, leaves the
      // watermark NULL, and is retried on that ASIN's next listing.
      const url = await mirror.ensureMirrored(row.id, row.url, false);
      if (url) {
        mirrored += 1;
      } else {
        skipped += 1;
      }
      if ((index + 1) % 100 === 0) {
        log(`  ${index + 1}/${rows.length} (${mirrored} mirrored, ${skipped} skipped)`);
      }
      await sleep(DELAY_MS);
    }

    log(`Done: ${mirrored} mirrored, ${skipped} skipped, ${rows.length} examined.`);
    if (skipped > 0) {
      log('Skipped rows keep a NULL watermark and are retried on their next listing.');
    }
    return 0;
  } catch (error: unknown) {
    logError(`backfill failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await pool.end();
  }
}

void run().then((code) => {
  process.exit(code);
});
