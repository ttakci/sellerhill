import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IProductDataProvider, KeepaProduct, ProductData } from '@repo/shared';
import axios from 'axios';

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
      const response = await axios.get(this.baseUrl, {
        params: {
          key: this.apiKey,
          domain: 1, // 1 = Amazon.com
          asin: asin,
          stock: 1, // 1 token total: Essential for stats.stockBuyBox field
          stats: 90, // Included in the same token: Vital for current price snapshots
        },
        timeout: 30000,
      });

      const products = response.data?.products;
      if (!products || products.length === 0) {
        this.logger.warn(`No product data returned from Keepa for ASIN ${asin}`);
        return null;
      }

      const product = products[0];

      // 1. Extract Images
      const imageUrls = this.extractImages(product.imagesCSV);

      // 2. Extract Price and Stock
      const { price, stock, sellerId } = this.extractPriceAndStock(product);

      // 3. Extract Category
      const category = product.categoryTree ? product.categoryTree[product.categoryTree.length - 1]?.name : undefined;

      // 4. Extract Specs (Keepa doesn't provide structured specs like ScraperAPI, but we can try)
      const specs: Record<string, string> = {};
      if (product.brand) specs['Brand'] = product.brand;
      if (product.manufacturer) specs['Manufacturer'] = product.manufacturer;
      if (product.model) specs['Model'] = product.model;

      return {
        asin,
        title: product.title || 'Unknown Product',
        description: product.description || '',
        imageUrls: imageUrls,
        brand: product.brand || 'Unknown',
        category: category,
        manufacturer: product.manufacturer || product.brand || 'Unknown',
        features: product.features || [],
        specs: specs,
        price: {
          current: price,
          currency: 'USD',
          avg30: product.stats?.avg30?.[0] ? product.stats.avg30[0] / 100 : undefined,
          avg90: product.stats?.avg90?.[0] ? product.stats.avg90[0] / 100 : undefined,
        },
        stock: stock,
        raw: product,
      };
    } catch (error: any) {
      this.logger.error(`Failed to fetch Keepa product details for ${asin}: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch product price and stock for 1 ASIN (1 token)
   * Simple version for sync tasks
   */
  async getProduct(asin: string): Promise<KeepaProduct | null> {
    const details = await this.getProductDetails(asin);
    if (!details) return null;

    return {
      asin: details.asin,
      price: details.price.current,
      stock: details.stock || 0,
      sellerId: undefined, // Seller ID is handled during extraction if needed
      lastSync: new Date(),
      raw: details.raw,
    };
  }

  /**
   * Bulk Fetch (max 100 ASIN, parallel)
   */
  async getProducts(asins: string[]): Promise<KeepaProduct[]> {
    this.logger.log(`Fetching Keepa data for ${asins.length} ASINs`);

    const targetAsins = asins.slice(0, 100);
    const results = await Promise.allSettled(targetAsins.map((asin) => this.getProduct(asin)));

    return results
      .filter((r): r is PromiseFulfilledResult<KeepaProduct> => r.status === 'fulfilled' && r.value !== null)
      .map((r) => r.value);
  }

  /**
   * Helper to extract price and stock from Keepa product object
   */
  /**
   * Helper to extract price and stock from Keepa product object
   * Token-optimized version: uses stats object directly.
   */
  private extractPriceAndStock(product: any): { price: number; stock: number; sellerId?: string } {
    let price = 0;
    let stock = 0;
    let sellerId: string | undefined;

    const stats = product.stats;
    if (!stats) {
      return { price, stock, sellerId };
    }

    // 1. EXTRACT STOCK (Priority: stats.stockBuyBox from 'stock' parameter)
    if (typeof stats.stockBuyBox === 'number' && stats.stockBuyBox >= 0) {
      stock = stats.stockBuyBox;
      this.logger.debug(`Stock read from stats.stockBuyBox: ${stock}`);
    } else if (typeof stats.stockAmazon === 'number' && stats.stockAmazon >= 0) {
      stock = stats.stockAmazon;
      this.logger.debug(`Stock read from stats.stockAmazon: ${stock}`);
    } else {
      // Conservative estimate if exact number is missing
      stock = this.extractStockFromStats(stats, product.asin);
    }

    // 2. EXTRACT PRICE (Primary: Buy Box summary, Fallback: Price index 1 from current snapshot)
    if (typeof stats.buyBoxPrice === 'number' && stats.buyBoxPrice > 0) {
      const shipping = stats.buyBoxShipping > 0 ? stats.buyBoxShipping : 0;
      price = (stats.buyBoxPrice + shipping) / 100;
      sellerId = stats.buyBoxSellerId;
      this.logger.debug(`Price read from buyBox stats: ${price} (Seller: ${sellerId})`);
    } else {
      // stats.buyBoxPrice is -2 when buybox param is not used.
      // Fallback: Check 'current' snapshot (Index 1=New, 30=BuyBox, 0=Amazon)
      const newPrice = stats.current?.[1];
      const bbPriceCurrent = stats.current?.[30];
      const amzPrice = stats.current?.[0];

      // Prefer New Price (index 1) as it's typically available with basic 1-token queries
      const rawPrice = newPrice > 0 ? newPrice : bbPriceCurrent > 0 ? bbPriceCurrent : amzPrice > 0 ? amzPrice : 0;
      price = rawPrice / 100;
      sellerId = stats.buyBoxSellerId || undefined;
      this.logger.debug(`Price read from stats index 1 (New): ${price}`);
    }

    return { price, stock, sellerId };
  }

  /**
   * Helper to extract stock from product.stats
   */
  private extractStockFromStats(stats: any, asin: string): number {
    if (!stats) return 0;

    // Check availabilityAmazon (0: In Stock, 1: Out of Stock, etc.)
    if (stats.availabilityAmazon === 1) {
      return 0; // Explicitly out of stock
    }

    // Index 3 in stats.current is Sales Rank, not Stock.
    // Real-time stock for Amazon is not always exported in stats.current.

    // Conservative proxy: use offer count (assume each seller has only 1 unit)
    const offerCount = stats.totalOfferCount || stats.current?.[17] || stats.current?.[11];
    if (typeof offerCount === 'number' && offerCount > 0) {
      this.logger.debug(`Exact stock unknown for ${asin}, assuming 1 unit per offer for ${offerCount} offers.`);
      return offerCount; // 1 unit per offer
    }

    // If Amazon is in stock but exact count unknown, return 1 as worst-case
    if (stats.availabilityAmazon === 0 || stats.buyBoxAvailabilityMessage === 'In Stock') {
      return 1;
    }

    return 0;
  }

  /**
   * Helper to convert Keepa imagesCSV to full URLs
   */
  private extractImages(imagesCSV: string): string[] {
    if (!imagesCSV) return [];
    return imagesCSV.split(',').map((img) => `https://images-na.ssl-images-amazon.com/images/I/${img}`);
  }
}
