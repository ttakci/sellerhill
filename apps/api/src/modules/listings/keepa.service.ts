import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IProductDataProvider, KeepaProduct, ProductData } from '@repo/shared';
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
   * Fetch full product details (Metadata + Price + Stock)
   * This implements IProductDataProvider
   */
  async getProductDetails(asin: string): Promise<ProductData | null> {
    this.logger.log(`Fetching full Keepa data for ASIN: ${asin}`);

    try {
      interface KeepaResponse {
        products?: KeepaProductRaw[];
      }
      const response = await axios.get<KeepaResponse>(this.baseUrl, {
        params: {
          key: this.apiKey,
          domain: 1,
          asin: asin,
          stock: 1,
          stats: 90,
        },
        timeout: 30000,
      });

      const products = response.data?.products;
      if (!products || products.length === 0) {
        this.logger.warn(`No product data returned from Keepa for ASIN ${asin}`);
        return null;
      }

      const product: KeepaProductRaw = products[0];

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
    } catch (error: unknown) {
      this.logger.error(
        `Failed to fetch Keepa product details for ${asin}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Fetch product price and stock for 1 ASIN (1 token)
   */
  async getProduct(asin: string): Promise<KeepaProduct | null> {
    const details = await this.getProductDetails(asin);
    if (!details) {
      return null;
    }

    return {
      asin: details.asin,
      price: details.price.current,
      stock: details.stock || 0,
      sellerId: undefined,
      lastSync: new Date(),
      raw: details.raw as Record<string, unknown>,
    };
  }

  /**
   * Bulk Fetch (max 100 ASIN, SINGLE API CALL)
   * Keepa accepts comma-separated ASINs in a single request.
   * This uses only 1 token instead of N tokens.
   */
  async getProducts(asins: string[]): Promise<KeepaProduct[]> {
    const targetAsins = asins.slice(0, 100);

    if (targetAsins.length === 0) {
      return [];
    }

    this.logger.log(`Fetching Keepa data for ${targetAsins.length} ASINs in a single request`);

    try {
      interface KeepaBulkResponse {
        products?: KeepaProductRaw[];
      }
      const response = await axios.get<KeepaBulkResponse>(this.baseUrl, {
        params: {
          key: this.apiKey,
          domain: 1,
          asin: targetAsins.join(','), // Single request with bulk ASINs
          stock: 1,
          stats: 90,
        },
        timeout: 60000, // Longer timeout for bulk requests
      });

      const products: KeepaProductRaw[] = response.data?.products || [];

      return products
        .filter((p) => p && p.asin)
        .map((product) => {
          const { price, stock } = this.extractPriceAndStock(product);
          return {
            asin: product.asin!,
            price,
            stock,
            sellerId: undefined,
            lastSync: new Date(),
            raw: product as unknown as Record<string, unknown>,
          };
        });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to fetch Keepa bulk data for ${targetAsins.length} ASINs: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
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
