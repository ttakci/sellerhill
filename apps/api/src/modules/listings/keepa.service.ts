import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IProductDataProvider,
  type KeepaApiMeta,
  type KeepaBulkResult,
  type KeepaSingleResult,
  type ProductData,
} from '@repo/shared';
import axios from 'axios';

/**
 * Raw Keepa API product response shape for type safety
 */
interface KeepaProductRaw {
  asin?: string;
  title?: string;
  description?: string;
  brand?: string;
  manufacturer?: string;
  model?: string;
  categoryTree?: Array<{ name: string }>;
  imagesCSV?: string;
  features?: string[];
  stats?: {
    buyBoxPrice?: number;
    buyBoxShipping?: number;
    buyBoxSellerId?: string;
    buyBoxAvailabilityMessage?: string;
    stockBuyBox?: number;
    stockAmazon?: number;
    availabilityAmazon?: number;
    totalOfferCount?: number;
    avg30?: number[];
    avg90?: number[];
    current?: number[];
  };
}

/**
 * Top-level Keepa /product response. tokensConsumed/tokensLeft/refillIn are
 * returned on every response and captured for token-cost tracking.
 */
interface KeepaResponse {
  products?: KeepaProductRaw[];
  tokensConsumed?: number;
  tokensLeft?: number;
  refillIn?: number; // ms until next token refill
}

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
   * Fetch full product details (Metadata + Price + Stock) + token metadata.
   * Implements IProductDataProvider (product only); callers needing token
   * attribution use getProductDetailsWithMeta.
   *
   * `history=0` skips Keepa's price-history arrays — we only need the current
   * snapshot, so this halves token cost (~2 → ~1 token/ASIN).
   */
  async getProductDetails(asin: string): Promise<ProductData | null> {
    return (await this.getProductDetailsWithMeta(asin)).product;
  }

  /** Single-ASIN fetch returning token metadata alongside product data. */
  async getProductDetailsWithMeta(asin: string): Promise<KeepaSingleResult> {
    this.logger.log(`Fetching full Keepa data for ASIN: ${asin}`);

    try {
      const response = await axios.get<KeepaResponse>(this.baseUrl, {
        params: {
          key: this.apiKey,
          domain: 1,
          asin: asin,
          stock: 1,
          stats: 90,
          history: 0,
        },
        timeout: 30000,
      });

      const products = response.data?.products;
      const meta = this.extractMeta(response.data, 1);
      if (!products || products.length === 0) {
        this.logger.warn(`No product data returned from Keepa for ASIN ${asin}`);
        return { product: null, meta };
      }

      const product = products[0];
      return { product: this.normalizeProduct(product, asin), meta };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to fetch Keepa product details for ${asin}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Bulk fetch (max 100 ASINs per Keepa request) returning token metadata.
   * One HTTP call per batch preserves Keepa bulk efficiency at scale.
   */
  async getProducts(asins: string[]): Promise<KeepaBulkResult> {
    const targetAsins = asins.slice(0, 100);
    const emptyMeta = this.emptyMeta(targetAsins.length);

    if (targetAsins.length === 0) {
      return { products: [], meta: emptyMeta };
    }

    this.logger.log(`Fetching Keepa data for ${targetAsins.length} ASINs in a single request`);

    try {
      const response = await axios.get<KeepaResponse>(this.baseUrl, {
        params: {
          key: this.apiKey,
          domain: 1,
          asin: targetAsins.join(','),
          stock: 1,
          stats: 90,
          history: 0,
        },
        timeout: 60000,
      });

      const rawProducts: KeepaProductRaw[] = response.data?.products || [];
      const meta = this.extractMeta(response.data, targetAsins.length);

      const products = rawProducts
        .filter((p) => p && p.asin)
        .map((product) => {
          const { price, stock, sellerId } = this.extractPriceAndStock(product);
          return {
            asin: product.asin!,
            price,
            stock,
            sellerId,
            lastSync: new Date(),
            raw: product as unknown as Record<string, unknown>,
            // also expose normalized metadata for the refresh worker
            title: product.title,
            description: product.description,
            imageUrls: this.extractImages(product.imagesCSV),
            brand: product.brand,
            category: product.categoryTree ? product.categoryTree[product.categoryTree.length - 1]?.name : undefined,
            features: product.features || [],
          };
        });

      return { products, meta };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to fetch Keepa bulk data for ${targetAsins.length} ASINs: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Build a normalized ProductData from a raw Keepa product object.
   */
  private normalizeProduct(product: KeepaProductRaw, asin: string): ProductData {
    const imageUrls = this.extractImages(product.imagesCSV);
    const { price, stock } = this.extractPriceAndStock(product);
    const category = product.categoryTree ? product.categoryTree[product.categoryTree.length - 1]?.name : undefined;

    const specs: Record<string, string> = {};
    if (product.brand) {
      specs['Brand'] = product.brand;
    }
    if (product.manufacturer) {
      specs['Manufacturer'] = product.manufacturer;
    }
    if (product.model) {
      specs['Model'] = product.model;
    }

    return {
      asin,
      title: product.title || 'Unknown Product',
      description: product.description || '',
      imageUrls,
      brand: product.brand || 'Unknown',
      category,
      manufacturer: product.manufacturer || product.brand || 'Unknown',
      features: product.features || [],
      specs,
      price: {
        current: price,
        currency: 'USD',
        avg30: product.stats?.avg30?.[0] ? product.stats.avg30[0] / 100 : undefined,
        avg90: product.stats?.avg90?.[0] ? product.stats.avg90[0] / 100 : undefined,
      },
      stock,
      raw: product as unknown as Record<string, unknown>,
    };
  }

  /** Extract token metadata from a Keepa response, falling back to ASIN count. */
  private extractMeta(data: KeepaResponse | undefined, asinCount: number): KeepaApiMeta {
    return {
      tokensConsumed: data?.tokensConsumed ?? asinCount,
      tokensLeft: data?.tokensLeft,
      refillIn: data?.refillIn,
    };
  }

  private emptyMeta(asinCount: number): KeepaApiMeta {
    return { tokensConsumed: asinCount };
  }

  /**
   * Helper to extract price and stock from Keepa product object
   */
  private extractPriceAndStock(product: KeepaProductRaw): { price: number; stock: number; sellerId?: string } {
    let price = 0;
    let stock = 0;
    let sellerId: string | undefined;

    const stats = product.stats;
    if (!stats) {
      return { price, stock, sellerId };
    }

    // 1. EXTRACT STOCK
    if (typeof stats.stockBuyBox === 'number' && stats.stockBuyBox >= 0) {
      stock = stats.stockBuyBox;
    } else if (typeof stats.stockAmazon === 'number' && stats.stockAmazon >= 0) {
      stock = stats.stockAmazon;
    } else {
      stock = this.extractStockFromStats(stats, product.asin || '');
    }

    // 2. EXTRACT PRICE
    if (typeof stats.buyBoxPrice === 'number' && stats.buyBoxPrice > 0) {
      const shipping = (stats.buyBoxShipping ?? 0) > 0 ? stats.buyBoxShipping! : 0;
      price = (stats.buyBoxPrice + shipping) / 100;
      sellerId = stats.buyBoxSellerId;
    } else {
      const newPrice = stats.current?.[1] ?? 0;
      const bbPriceCurrent = stats.current?.[30] ?? 0;
      const amzPrice = stats.current?.[0] ?? 0;

      const rawPrice = newPrice > 0 ? newPrice : bbPriceCurrent > 0 ? bbPriceCurrent : amzPrice > 0 ? amzPrice : 0;
      price = rawPrice / 100;
      sellerId = stats.buyBoxSellerId || undefined;
    }

    return { price, stock, sellerId };
  }

  /**
   * Helper to extract stock from product.stats
   */
  private extractStockFromStats(stats: KeepaProductRaw['stats'], _asin: string): number {
    if (!stats) {
      return 0;
    }

    if (stats.availabilityAmazon === 1) {
      return 0;
    }

    const offerCount = stats.totalOfferCount || stats.current?.[17] || stats.current?.[11];
    if (typeof offerCount === 'number' && offerCount > 0) {
      return offerCount;
    }

    if (stats.availabilityAmazon === 0 || stats.buyBoxAvailabilityMessage === 'In Stock') {
      return 1;
    }

    return 0;
  }

  /**
   * Helper to convert Keepa imagesCSV to full URLs
   */
  private extractImages(imagesCSV: string | undefined): string[] {
    if (!imagesCSV) {
      return [];
    }
    return imagesCSV.split(',').map((img) => `https://images-na.ssl-images-amazon.com/images/I/${img}`);
  }
}
