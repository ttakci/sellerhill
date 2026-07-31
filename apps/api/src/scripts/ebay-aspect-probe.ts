// Must precede any @repo/shared import: the billing schemas apply
// class-transformer decorators at module-eval time, which call
// Reflect.getMetadata.
import 'reflect-metadata';

import * as path from 'path';

import * as dotenv from 'dotenv';
import { Pool } from 'pg';

import { buildAspectResolution, type CategoryAspect } from '../modules/ebay/aspect-builder';
import { extractProductAttributes, type KeepaRawProduct } from '../modules/listings/keepa-normalizer';

/**
 * Read-only diagnosis of what item specifics a listing WOULD publish with.
 *
 * Usage: pnpm --filter api ebay:aspect-probe -- --asin B0XXXXXXX [--category 260988]
 *
 * Why this exists: the only way to see why a listing failed used to be to
 * publish it, read eBay's error, guess, and publish again. This resolves the
 * category, fetches its aspect metadata, runs the exact same resolution ladder
 * the create path runs, and prints the decision table — without creating an
 * offer, publishing anything, or spending a Keepa token (product data comes
 * from the local cache).
 */

// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface ProbeArgs {
  asin: string;
  categoryId?: string;
}

class ProbeArgError extends Error {}

export function parseProbeArgs(argv: string[]): ProbeArgs {
  let asin: string | undefined;
  let categoryId: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    // pnpm forwards a bare `--` separator into argv.
    if (flag === '--') {
      continue;
    }
    if (flag === '--asin') {
      asin = value;
      i += 1;
    } else if (flag === '--category') {
      categoryId = value;
      i += 1;
    } else {
      throw new ProbeArgError(`Unknown argument: ${flag}`);
    }
  }

  if (!asin || !/^[A-Z0-9]{10}$/i.test(asin)) {
    throw new ProbeArgError('Usage: --asin <ASIN> [--category <eBay leaf category id>]');
  }

  return { asin: asin.toUpperCase(), categoryId };
}

interface ProductRow {
  asin: string;
  title: string;
  brand: string | null;
  features: string[] | string | null;
  specs: Record<string, string> | string | null;
  identifiers: Record<string, string> | string | null;
  raw_keepa_data: KeepaRawProduct | string | null;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

async function fetchCategoryAspects(
  accessToken: string,
  restApiUrl: string,
  treeId: string,
  categoryId: string
): Promise<CategoryAspect[]> {
  const url =
    `${restApiUrl}/commerce/taxonomy/v1/category_tree/${treeId}` +
    `/get_item_aspects_for_category?category_id=${categoryId}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Accept-Language': 'en-US' },
  });
  if (!response.ok) {
    throw new Error(`Taxonomy request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    aspects?: Array<{
      localizedAspectName: string;
      aspectConstraint?: {
        aspectRequired?: boolean;
        aspectUsage?: string;
        aspectMode?: string;
        itemToAspectCardinality?: string;
        aspectMaxLength?: number;
      };
      aspectValues?: Array<{ localizedValue?: string }>;
    }>;
  };

  return (data.aspects ?? []).map((aspect) => ({
    name: aspect.localizedAspectName,
    required:
      aspect.aspectConstraint?.aspectRequired === true ||
      aspect.aspectConstraint?.aspectUsage === 'REQUIRED' ||
      aspect.aspectConstraint?.aspectMode === 'REQUIRED',
    selectionOnly: aspect.aspectConstraint?.aspectMode === 'SELECTION_ONLY',
    multiValue: aspect.aspectConstraint?.itemToAspectCardinality === 'MULTI',
    maxLength: aspect.aspectConstraint?.aspectMaxLength,
    values: (aspect.aspectValues ?? [])
      .map((value) => value.localizedValue)
      .filter((value): value is string => Boolean(value)),
  }));
}

async function main(): Promise<void> {
  let args: ProbeArgs;
  try {
    args = parseProbeArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const { rows } = await pool.query<ProductRow>(
      `SELECT asin, title, brand, features, specs, identifiers, raw_keepa_data
       FROM products WHERE asin = $1`,
      [args.asin]
    );
    const product = rows[0];
    if (!product) {
      console.error(`ASIN ${args.asin} is not in the local product cache — list it once first.`);
      process.exit(3);
      return;
    }

    let specs = parseJson<Record<string, string>>(product.specs, {});
    let identifiers = parseJson<Record<string, string>>(product.identifiers, {});
    if (Object.keys(specs).length === 0) {
      const raw = parseJson<KeepaRawProduct | null>(product.raw_keepa_data, null);
      if (raw) {
        const derived = extractProductAttributes(raw);
        specs = derived.specs;
        identifiers = derived.identifiers as Record<string, string>;
      }
    }

    // eslint-disable-next-line no-console
    console.log(`\nASIN ${product.asin} — ${product.title}`);
    // eslint-disable-next-line no-console
    console.log(`Harvested attributes: ${Object.keys(specs).length}`);
    // eslint-disable-next-line no-console
    console.log(`Identifiers: ${JSON.stringify(identifiers)}\n`);

    let categoryAspects: CategoryAspect[] = [];
    if (args.categoryId) {
      const { rows: accounts } = await pool.query<{ access_token: string }>(
        `SELECT access_token FROM ebay_accounts WHERE status = 'active' LIMIT 1`
      );
      const token = accounts[0]?.access_token;
      if (token && !token.startsWith('enc:')) {
        categoryAspects = await fetchCategoryAspects(
          token,
          process.env.EBAY_REST_API_URL ?? 'https://api.sandbox.ebay.com',
          process.env.EBAY_SITE_ID ?? '0',
          args.categoryId
        );
        // eslint-disable-next-line no-console
        console.log(
          `Category ${args.categoryId}: ${categoryAspects.length} aspects, ` +
            `${categoryAspects.filter((a) => a.required).length} required\n`
        );
      } else {
        // eslint-disable-next-line no-console
        console.log('eBay token is encrypted at rest — run without --category to probe attributes only.\n');
      }
    }

    const resolution = buildAspectResolution({
      title: product.title,
      brand: product.brand ?? undefined,
      specs,
      features: parseJson<string[]>(product.features, []),
      identifiers,
      categoryAspects,
    });

    // eslint-disable-next-line no-console
    console.log('ASPECT                          VALUE                          LAYER            REQ');
    // eslint-disable-next-line no-console
    console.log('-'.repeat(92));
    for (const decision of resolution.decisions) {
      // eslint-disable-next-line no-console
      console.log(
        `${decision.aspectName.padEnd(32).slice(0, 32)}${(decision.value ?? '—').padEnd(31).slice(0, 31)}` +
          `${decision.layer.padEnd(17)}${decision.required ? 'yes' : ''}`
      );
    }

    // eslint-disable-next-line no-console
    console.log(
      `\nWould publish ${Object.keys(resolution.aspects).length} item specifics. ` +
        `Unresolved required: ${resolution.unresolvedRequired.length === 0 ? 'none' : resolution.unresolvedRequired.join(', ')}\n`
    );
  } catch (error) {
    console.error('Probe failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void main();
