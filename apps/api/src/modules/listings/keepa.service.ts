import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IProductDataProvider, KeepaProductResponse, ProductData } from '@repo/shared';
import axios from 'axios';

/**
 * Keepa API Integration Service
 * Implements IProductDataProvider to fetch product data from Keepa API
 */
@Injectable()
export class KeepaService implements IProductDataProvider {
  private readonly logger = new Logger(KeepaService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.keepa.com';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('KEEPA_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('KEEPA_API_KEY not configured. Keepa service will not work.');
    }
  }

  /**
   * Fetch product details from Keepa API and return normalized ProductData
   */
  async getProductDetails(asin: string): Promise<ProductData | null> {
    this.logger.log(`Fetching product details for ASIN: ${asin}`);

    try {
      const response = await axios.get<KeepaProductResponse>(`${this.baseUrl}/product`, {
        params: {
          key: this.apiKey,
          domain: 1, // 1 = Amazon.com (US)
          asin: asin,
          stats: 90, // Get 90-day stats
        },
      });

      if (!response.data.products || response.data.products.length === 0) {
        this.logger.warn(`No product found for ASIN ${asin}`);
        return null;
      }

      const product = response.data.products[0];

      // Transform Keepa-specific data to normalized ProductData
      return {
        asin: product.asin,
        title: product.title,
        description: product.description || '',
        imageUrls: product.imagesCSV ? product.imagesCSV.split(',').map(img => `https://m.media-amazon.com/images/I/${img}`) : [],
        brand: product.brand || product.manufacturer || 'Unknown',
        category: product.categoryTree?.[0]?.name,
        manufacturer: product.manufacturer,
        weight: product.packageWeight,
        dimensions: product.packageHeight && product.packageLength && product.packageWidth
          ? `${product.packageHeight}x${product.packageLength}x${product.packageWidth}`
          : undefined,
        features: product.features || [],
        specs: undefined, // Keepa doesn't provide structured specs, will be extracted from features
        price: {
          current: product.stats?.current?.[0] ? product.stats.current[0] / 100 : 0,
          avg30: product.stats?.avg30?.[0] ? product.stats.avg30[0] / 100 : 0,
          currency: 'USD',
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to fetch product from Keepa: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Get tokens left in Keepa account
   */
  async getTokensLeft(): Promise<number> {
    try {
      const response = await axios.get<KeepaProductResponse>(`${this.baseUrl}/product`, {
        params: {
          key: this.apiKey,
          domain: 1,
          asin: 'B00X4WHP5E', // Dummy ASIN just to check tokens
        },
      });
      return response.data.tokensLeft;
    } catch (error: any) {
      this.logger.error(`Failed to check Keepa tokens: ${error.message}`);
      return 0;
    }
  }
}
