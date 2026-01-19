import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IProductDataProvider, ProductData } from '@repo/shared';
import axios from 'axios';

/**
 * ScraperAPI Integration Service
 * Implements IProductDataProvider to fetch product data from ScraperAPI
 * 
 * ScraperAPI provides structured product data including:
 * - Full product details with specifications
 * - High-quality images
 * - Pricing information
 * - Technical specifications as key-value pairs
 */
@Injectable()
export class ScraperApiService implements IProductDataProvider {
  private readonly logger = new Logger(ScraperApiService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.scraperapi.com';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('SCRAPER_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('SCRAPER_API_KEY not configured. ScraperAPI service will not work.');
    }
  }

  /**
   * Fetch product details from Amazon via ScraperAPI and return normalized ProductData
   */
  async getProductDetails(asin: string): Promise<ProductData | null> {
    this.logger.log(`Fetching product details for ASIN: ${asin} via ScraperAPI`);

    try {
      // ScraperAPI Amazon Product endpoint
      const response = await axios.get(`${this.baseUrl}/structured/amazon/product`, {
        params: {
          api_key: this.apiKey,
          asin: asin,
          country: 'us', // Default to US Amazon
          tld: 'com',
        },
        timeout: 30000, // 30 second timeout
      });

      if (!response.data) {
        this.logger.warn(`No product data returned for ASIN ${asin}`);
        return null;
      }

      const product = response.data;
      
      // Debug logging to understand response structure
      this.logger.debug(`ScraperAPI response keys: ${Object.keys(product).join(', ')}`);
      this.logger.debug(`Image fields - main_image: ${!!product.main_image}, images: ${!!product.images}, image_data: ${!!product.image_data}`);

      // Extract structured specifications from ScraperAPI response
      const specs = this.extractSpecifications(product);

      // Transform ScraperAPI data to normalized ProductData
      return {
        asin: product.asin || asin,
        title: product.title || 'Unknown Product',
        description: product.description || product.feature_bullets?.join('\n') || '',
        imageUrls: this.extractImages(product),
        brand: product.brand || 'Unknown',
        category: product.categories?.[0]?.name || product.product_category,
        manufacturer: product.manufacturer || product.brand,
        weight: this.parseWeight(product.item_weight),
        dimensions: this.parseDimensions(product.product_dimensions),
        features: product.feature_bullets || [],
        specs: specs, // ✨ Structured specifications from ScraperAPI
        price: {
          current: this.parsePrice(product.buybox_winner?.price?.value || product.price),
          avg30: this.parsePrice(product.buybox_winner?.price?.value || product.price), // ScraperAPI doesn't provide historical avg, use current
          currency: product.buybox_winner?.price?.currency || 'USD',
        },
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        this.logger.warn(`Product not found for ASIN ${asin}`);
        return null;
      }
      
      if (error.response?.status === 401) {
        this.logger.error(`ScraperAPI authentication failed. Check SCRAPER_API_KEY`);
        return null;
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        this.logger.error(`ScraperAPI request timeout for ASIN ${asin}`);
        return null;
      }
      
      this.logger.error(`Failed to fetch product from ScraperAPI for ASIN ${asin}: ${error.message}`, error.stack);
      
      // Log response data if available for debugging
      if (error.response?.data) {
        this.logger.debug(`ScraperAPI error response: ${JSON.stringify(error.response.data).substring(0, 500)}`);
      }
      
      return null;
    }
  }

  /**
   * Extract and normalize product images
   */
  private extractImages(product: any): string[] {
    const images: string[] = [];

    // Main image
    if (product.main_image?.link) {
      images.push(product.main_image.link);
    }

    // Additional images
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((img: any) => {
        if (img.link && !images.includes(img.link)) {
          images.push(img.link);
        }
      });
    }

    // Fallback: Try image_data field (alternative ScraperAPI format)
    if (images.length === 0 && product.image_data && Array.isArray(product.image_data)) {
      product.image_data.forEach((url: string) => {
        if (url && typeof url === 'string' && url.startsWith('http')) {
          images.push(url);
        }
      });
    }

    // Log warning if no images found
    if (images.length === 0) {
      this.logger.warn(`No images found for product. Available fields: ${Object.keys(product).join(', ')}`);
    }

    return images;
  }

  /**
   * Extract structured specifications from product data
   * ScraperAPI provides these in various formats, we normalize them
   */
  private extractSpecifications(product: any): Record<string, string> {
    const specs: Record<string, string> = {};

    // Product details section (most reliable source)
    if (product.product_details) {
      Object.entries(product.product_details).forEach(([key, value]) => {
        if (typeof value === 'string' && value.length < 200) {
          specs[key] = value;
        }
      });
    }

    // Technical details section
    if (product.technical_details) {
      Object.entries(product.technical_details).forEach(([key, value]) => {
        if (typeof value === 'string' && value.length < 200 && !specs[key]) {
          specs[key] = value;
        }
      });
    }

    // Additional product information
    if (product.additional_info) {
      Object.entries(product.additional_info).forEach(([key, value]) => {
        if (typeof value === 'string' && value.length < 200 && !specs[key]) {
          specs[key] = value;
        }
      });
    }

    return specs;
  }

  /**
   * Parse price from various formats
   */
  private parsePrice(priceValue: any): number {
    if (typeof priceValue === 'number') {
      return priceValue;
    }
    
    if (typeof priceValue === 'string') {
      // Remove currency symbols and parse
      const cleaned = priceValue.replace(/[^0-9.]/g, '');
      return parseFloat(cleaned) || 0;
    }

    return 0;
  }

  /**
   * Parse weight from string format (e.g., "2.5 pounds")
   */
  private parseWeight(weight: string | undefined): number | undefined {
    if (!weight) return undefined;
    
    const match = weight.match(/([0-9.]+)/);
    return match ? parseFloat(match[1]) : undefined;
  }

  /**
   * Parse dimensions from string format (e.g., "10 x 8 x 2 inches")
   */
  private parseDimensions(dimensions: string | undefined): string | undefined {
    if (!dimensions) return undefined;
    
    // Clean up and return standardized format
    return dimensions.replace(/\s+/g, ' ').trim();
  }

  /**
   * Check API credits/quota
   */
  async checkCredits(): Promise<{ remaining: number; total: number } | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/account`, {
        params: {
          api_key: this.apiKey,
        },
      });

      return {
        remaining: response.data.requestCount?.remaining || 0,
        total: response.data.requestCount?.total || 0,
      };
    } catch (error: any) {
      this.logger.error(`Failed to check ScraperAPI credits: ${error.message}`);
      return null;
    }
  }
}
