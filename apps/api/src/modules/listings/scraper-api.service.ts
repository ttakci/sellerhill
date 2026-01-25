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
          country: 'us',
          tld: 'com',
        },
        timeout: 30000,
      });

      if (!response.data) {
        this.logger.warn(`No product data returned for ASIN ${asin}`);
        return null;
      }

      const product = response.data;

      // Extensive logging of keys for debugging
      this.logger.debug(`ScraperAPI response for ${asin}: ${Object.keys(product).join(', ')}`);

      // Extract structured specifications
      const specs = this.extractSpecifications(product);

      // Robust field extraction with fallbacks
      const title = product.name || product.title || 'Unknown Product';
      const rawPrice =
        product.pricing || product.price || product.buybox_winner?.price?.value || product.buybox_winner?.price;
      const currency = product.currency || product.buybox_winner?.price?.currency || 'USD';

      // Brand Cleanup
      let brand = product.brand || 'Unknown';
      if (brand.startsWith('Visit the ') && brand.endsWith(' Store')) {
        brand = brand.replace('Visit the ', '').replace(' Store', '').trim();
      }

      const imageUrls = this.extractImages(product);

      // Map to normalized ProductData
      return {
        asin: product.asin || asin,
        title: title,
        description: product.full_description || product.description || product.feature_bullets?.join('\n') || '',
        imageUrls: imageUrls,
        brand: brand,
        category: product.product_category || product.categories?.[0]?.name || product.categories?.[0],
        manufacturer: product.manufacturer || product.product_information?.manufacturer || brand,
        weight: this.parseWeight(product.item_weight || product.product_information?.item_weight),
        dimensions: this.parseDimensions(product.product_dimensions || product.product_information?.product_dimensions),
        features: product.feature_bullets || [],
        specs: specs,
        price: {
          current: this.parsePrice(rawPrice),
          currency: currency,
        },
        stock:
          product.availability?.quantity ||
          product.buybox_winner?.availability?.quantity ||
          (product.availability?.status?.includes('In Stock') ? 10 : 0),
        raw: product,
      };
    } catch (error: any) {
      this.logger.error(`Failed to fetch product from ScraperAPI for ASIN ${asin}: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract and normalize product images from various possible formats
   */
  private extractImages(product: any): string[] {
    const images: Set<string> = new Set();

    const addImage = (img: any) => {
      if (!img) return;
      if (typeof img === 'string' && img.startsWith('http')) {
        images.add(img);
      } else if (typeof img === 'object' && img.link && typeof img.link === 'string') {
        images.add(img.link);
      }
    };

    // Try 'images' array (can be strings or objects)
    if (Array.isArray(product.images)) {
      product.images.forEach(addImage);
    }

    // Try 'main_image'
    addImage(product.main_image);

    // Try 'image_data'
    if (Array.isArray(product.image_data)) {
      product.image_data.forEach(addImage);
    }

    // Try 'image_links'
    if (Array.isArray(product.image_links)) {
      product.image_links.forEach(addImage);
    }

    const finalImages = Array.from(images);
    if (finalImages.length === 0) {
      this.logger.warn(`No valid images found for product. Keys: ${Object.keys(product).join(', ')}`);
    }

    return finalImages;
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
    if (priceValue === null || priceValue === undefined) return 0;

    // Handle object format (sometimes buybox_winner.price)
    if (typeof priceValue === 'object') {
      const val = priceValue.value ?? priceValue.amount ?? priceValue.current_price;
      if (val !== undefined) return this.parsePrice(val);
      return 0;
    }

    if (typeof priceValue === 'number') {
      return priceValue;
    }

    if (typeof priceValue === 'string') {
      // Remove currency symbols, commas and parse
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
