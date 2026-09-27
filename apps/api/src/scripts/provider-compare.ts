/**
 * Read-only Keepa vs scraper comparison for the same ASINs.
 *
 *   pnpm --filter api provider:compare -- --asins B0...,B0...
 *
 * Proxies come from the SCRAPER_PROXIES env var (apps/api/.env) ONLY. There is
 * deliberately no command-line flag: a credential-bearing proxy URL on the
 * command line lands in shell history and the process list. Spends Keepa tokens
 * (~7 per ASIN). Prints one row per ASIN and field that differs, then totals.
 * Use it before relying on the scraper, and after an Amazon layout change.
 *
 * Writes nothing: no DB connection, no NestJS bootstrap. Proxy URLs carry
 * credentials and are never printed — only their count.
 */
import 'reflect-metadata';

import * as path from 'path';

import { ConfigService } from '@nestjs/config';
import {
  AmazonMarketplace,
  ScraperFetchMode,
  ScraperLane,
  SourceFetchOutcome,
  type ScraperProductResult,
} from '@repo/shared';
import * as dotenv from 'dotenv';

import { extractCategoryPath, type KeepaRawProduct } from '../modules/listings/keepa-normalizer';
import { KeepaService } from '../modules/listings/keepa.service';
import { keepaStockStatusToSource } from '../modules/listings/scraper-refresh';
import { ScraperClient, parseProxyList } from '../modules/listings/scraper.client';
import { mapScraperProduct } from '../modules/listings/source-content-mapper';
import { normalizeScraperCommerce } from '../modules/listings/source-product-normalizer';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/** Same floor the panel defaults `scraper.inStockFloor` to. */
const IN_STOCK_FLOOR = 20;
/** Small requests keep each call well inside the client's 200 s timeout. */
const SCRAPER_CHUNK = 10;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const asins = (arg('asins') ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  if (asins.length === 0) {
    console.error('usage: provider:compare -- --asins B0...,B0...   (proxies: SCRAPER_PROXIES env only)');
    process.exit(2);
  }
  const config = new ConfigService(process.env);
  const keepa = new KeepaService(config);
  const scraper = new ScraperClient(config);
  const proxies = parseProxyList(process.env.SCRAPER_PROXIES ?? '');
  console.warn(`${asins.length} ASINs, ${proxies.length} prox${proxies.length === 1 ? 'y' : 'ies'}`);

  const { products, meta } = await keepa.getProducts(asins, AmazonMarketplace.AMAZON_US);
  console.warn(`keepa: ${products.length} products, tokensConsumed=${meta.tokensConsumed}, tokensLeft=${meta.tokensLeft ?? '?'}`);
  const keepaByAsin = new Map(products.map((p) => [p.asin, p]));

  const scraped: ScraperProductResult[] = [];
  for (let i = 0; i < asins.length; i += SCRAPER_CHUNK) {
    scraped.push(
      ...(await scraper.fetchProducts({
        marketplace: 'US',
        asins: asins.slice(i, i + SCRAPER_CHUNK),
        mode: ScraperFetchMode.FULL,
        lane: ScraperLane.INTERACTIVE,
        proxies,
        perIpRequestsPerSecond: 1,
      })),
    );
  }

  const diffs: Record<string, number> = {};
  const note = (asin: string, field: string, k: unknown, s: unknown): void => {
    diffs[field] = (diffs[field] ?? 0) + 1;
    console.warn(`${asin}\t${field}\tkeepa=${JSON.stringify(k)}\tscraper=${JSON.stringify(s)}`);
  };

  for (const r of scraped) {
    const k = keepaByAsin.get(r.asin);
    if (r.outcome !== SourceFetchOutcome.FOUND || !r.content) {
      note(r.asin, 'outcome', k ? 'found' : 'missing', r.outcome);
      continue;
    }
    const obs = normalizeScraperCommerce(r, IN_STOCK_FLOOR);
    if (obs.kind !== 'observed') {
      note(r.asin, 'commerce', 'n/a', obs.kind);
      continue;
    }
    const s = mapScraperProduct(r.asin, r.content, obs.commerce, AmazonMarketplace.AMAZON_US);
    if (!k) {
      note(r.asin, 'keepa', 'missing', 'found');
      continue;
    }
    if (k.price !== s.price.current) {note(r.asin, 'price', k.price, s.price.current);}
    // Keepa's UNKNOWN maps to null (the refresh keeps the stored value then).
    const kStatus = keepaStockStatusToSource(k.stockStatus);
    if (kStatus !== (s.stockStatus ?? null)) {note(r.asin, 'stockStatus', kStatus, s.stockStatus ?? null);}
    if ((k.stock ?? null) !== (s.stock ?? null)) {note(r.asin, 'stock', k.stock ?? null, s.stock ?? null);}
    if ((k.imageUrls?.length ?? 0) !== s.imageUrls.length) {note(r.asin, 'imageCount', k.imageUrls?.length ?? 0, s.imageUrls.length);}
    if ((k.description ?? '').length > 0 !== s.description.length > 0) {
      note(r.asin, 'hasDescription', Boolean(k.description), Boolean(s.description));
    }
    const kSpecs = Object.keys(k.specs ?? {}).length;
    const sSpecs = Object.keys(s.specs ?? {}).length;
    if (kSpecs > sSpecs) {note(r.asin, 'specsFewer', kSpecs, sSpecs);}
    const kBarcode = Boolean(k.identifiers?.upc || k.identifiers?.ean || k.identifiers?.gtin);
    const sBarcode = Boolean(s.identifiers?.upc || s.identifiers?.ean || s.identifiers?.gtin);
    if (kBarcode !== sBarcode) {note(r.asin, 'barcode', kBarcode, sBarcode);}
    // The exact derivation that writes products.category_path on the Keepa path.
    const kPath = k.raw ? extractCategoryPath(k.raw as unknown as KeepaRawProduct) : undefined;
    if (kPath !== s.categoryPath) {note(r.asin, 'categoryPath', kPath, s.categoryPath);}
  }
  console.warn(`\n${scraped.length} ASINs compared. Differences by field: ${JSON.stringify(diffs)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
