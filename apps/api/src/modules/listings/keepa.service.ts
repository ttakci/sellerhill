import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IProductDataProvider,
  KeepaStockStatus,
  type KeepaApiMeta,
  type KeepaBulkResult,
  type KeepaProduct,
  type KeepaSingleResult,
  type ProductData,
} from '@repo/shared';
import axios from 'axios';

import {
  chunkAsins,
  dedupeAsins,
  extractCommerce,
  extractImageUrls,
  type KeepaRawProduct,
} from './keepa-normalizer';

/**
 * Top-level Keepa /product response. tokensConsumed/tokensLeft/refillIn/
 * refillRate are returned on every response and captured for token-cost
 * tracking and admission control.
 */
interface KeepaResponse {
  products?: KeepaRawProduct[];
  tokensConsumed?: number;
  tokensLeft?: number;
  refillIn?: number; // ms until next token refill
  refillRate?: number; // tokens generated per minute (plan tier)
  error?: unknown;
}

/** Keepa's hard per-request ASIN limit. Larger inputs are chunked internally. */
const KEEPA_MAX_ASINS_PER_REQUEST = 100;

/**
 * Keepa /product client.
 *
 * Query contract (identical for create + refresh — no per-product tiering):
 *   history=0            smaller payload (no token effect)
 *   stats=90             Statistics object incl. Buy Box fields (free)
 *   offers=20            live marketplace offers — REQUIRED for real stock.
 *                        Keepa charges 6 tokens per FOUND page of 10 offers
 *                        (0 tokens when its offer cache is <1h old).
 *   only-live-offers=1   drop historical offers from the payload (free)
 *   stock=1              per-offer stockCSV (+2 tokens only when the stock
 *                        observation is fresh)
 *
 * Token accounting MUST use the response-reported `tokensConsumed`: observed
 * live costs for the same query range from 0 (cached) to 6+ (offer refresh).
 * Estimating per-ASIN costs locally is wrong by design.
 */
@Injectable()
export class KeepaService implements IProductDataProvider {
  private readonly logger = new Logger(KeepaService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.keepa.com/product';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('KEEPA_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('KEEPA_API_KEY not configured. KeepaService will not work.');
    }
  }

  /**
   * Fetch full product details (metadata + Buy Box price + stock).
   * Implements IProductDataProvider; callers needing token attribution use
   * getProductDetailsWithMeta.
   */
  async getProductDetails(asin: string): Promise<ProductData | null> {
    return (await this.getProductDetailsWithMeta(asin)).product;
  }

  /** Single-ASIN fetch returning token metadata alongside product data. */
  async getProductDetailsWithMeta(asin: string): Promise<KeepaSingleResult> {
    this.logger.log(`Fetching full Keepa data for ASIN: ${asin}`);

    const response = await this.request([asin], 30000);
    const meta = this.extractMeta(response);
    const raw = response.products?.[0];
    if (!raw) {
      this.logger.warn(`No product data returned from Keepa for ASIN ${asin}`);
      return { product: null, meta };
    }
    return { product: this.normalizeProductData(raw, asin), meta };
  }

  /**
   * Bulk fetch returning normalized products + aggregated token metadata.
   * Any number of ASINs may be passed; requests are chunked to Keepa's
   * 100-ASIN-per-request limit and `meta.tokensConsumed` is summed across
   * chunks (balance fields reflect the last chunk — the freshest snapshot).
   */
  async getProducts(asins: string[]): Promise<KeepaBulkResult> {
    const uniqueAsins = dedupeAsins(asins);
    if (uniqueAsins.length === 0) {
      return { products: [], meta: { tokensConsumed: 0 } };
    }

    const chunks = chunkAsins(uniqueAsins, KEEPA_MAX_ASINS_PER_REQUEST);
    this.logger.log(
      `Fetching Keepa data for ${uniqueAsins.length} ASINs in ${chunks.length} request(s)`
    );

    const products: KeepaProduct[] = [];
    let tokensConsumed = 0;
    let lastMeta: KeepaApiMeta = { tokensConsumed: 0 };

    for (const chunk of chunks) {
      const response = await this.request(chunk, 120000);
      lastMeta = this.extractMeta(response);
      tokensConsumed += lastMeta.tokensConsumed;

      for (const raw of response.products ?? []) {
        if (!raw?.asin) {
          continue;
        }
        products.push(this.normalizeKeepaProduct(raw));
      }
    }

    return {
      products,
      meta: { ...lastMeta, tokensConsumed },
    };
  }

  /** One Keepa /product HTTP call. Transport errors propagate to the caller. */
  private async request(asins: string[], timeout: number): Promise<KeepaResponse> {
    const params: Record<string, string | number> = {
      key: this.apiKey,
      domain: 1,
      asin: asins.join(','),
      history: 0,
      stats: 90,
      offers: 20,
      'only-live-offers': 1,
      stock: 1,
    };

    // Freshness/cost lever: `update=N` tells Keepa to serve its own cached
    // offer data when it is younger than N hours (cheap/0 tokens — another
    // Keepa customer already paid for the scrape) and only run a live offer
    // refresh (6 tokens/found page) when older. Unset → Keepa's ~1h default.
    // `update=-1` (never refresh) is deliberately NOT supported: niche ASINs
    // nobody else queries would go permanently stale.
    const updateHours = this.configService.get<number>('KEEPA_UPDATE_HOURS');
    if (updateHours !== undefined && updateHours >= 0) {
      params.update = updateHours;
    }

    try {
      const response = await axios.get<KeepaResponse>(this.baseUrl, { params, timeout });
      return response.data ?? {};
    } catch (error: unknown) {
      this.logger.error(
        `Keepa request failed for ${asins.length} ASIN(s): ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /** Normalized KeepaProduct for the refresh worker (bulk path). */
  private normalizeKeepaProduct(raw: KeepaRawProduct): KeepaProduct {
    const commerce = extractCommerce(raw);
    return {
      asin: raw.asin!,
      price: commerce.price,
      stock: commerce.stock,
      stockStatus: commerce.stockStatus,
      sellerId: commerce.sellerId,
      buyBoxIsAmazon: commerce.buyBoxIsAmazon,
      lastSync: new Date(),
      raw: raw as unknown as Record<string, unknown>,
      title: raw.title,
      description: raw.description,
      imageUrls: extractImageUrls(raw),
      brand: raw.brand,
      category: raw.categoryTree ? raw.categoryTree[raw.categoryTree.length - 1]?.name : undefined,
      features: raw.features || [],
    };
  }

  /** Normalized ProductData for the create path (single-ASIN). */
  private normalizeProductData(raw: KeepaRawProduct, asin: string): ProductData {
    const commerce = extractCommerce(raw);
    const category = raw.categoryTree ? raw.categoryTree[raw.categoryTree.length - 1]?.name : undefined;

    const specs: Record<string, string> = {};
    if (raw.brand) {
      specs['Brand'] = raw.brand;
    }
    if (raw.manufacturer) {
      specs['Manufacturer'] = raw.manufacturer;
    }
    if (raw.model) {
      specs['Model'] = raw.model;
    }

    return {
      asin,
      title: raw.title || 'Unknown Product',
      description: raw.description || '',
      imageUrls: extractImageUrls(raw),
      brand: raw.brand || 'Unknown',
      category,
      manufacturer: raw.manufacturer || raw.brand || 'Unknown',
      features: raw.features || [],
      specs,
      price: {
        current: commerce.price ?? 0,
        currency: 'USD',
        avg30: raw.stats?.avg30?.[0] && raw.stats.avg30[0] > 0 ? raw.stats.avg30[0] / 100 : undefined,
        avg90: raw.stats?.avg90?.[0] && raw.stats.avg90[0] > 0 ? raw.stats.avg90[0] / 100 : undefined,
      },
      // ProductData.stock is non-null; UNKNOWN → 0 here is acceptable on the
      // create path only because a brand-new product has no previous value to
      // preserve and the listing worker blocks live publish at quantity 0.
      stock: commerce.stockStatus === KeepaStockStatus.UNKNOWN ? 0 : (commerce.stock ?? 0),
      raw: raw as unknown as Record<string, unknown>,
    };
  }

  /**
   * Token metadata straight from the response. `tokensConsumed` defaults to 0
   * when absent — NEVER estimated from ASIN count (observed real costs for the
   * same call range 0..6+ depending on Keepa's cache state).
   */
  private extractMeta(data: KeepaResponse | undefined): KeepaApiMeta {
    return {
      tokensConsumed: data?.tokensConsumed ?? 0,
      tokensLeft: data?.tokensLeft,
      refillIn: data?.refillIn,
      refillRate: data?.refillRate,
    };
  }
}
