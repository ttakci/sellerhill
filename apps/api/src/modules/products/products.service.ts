import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../../common/database/database.service';

interface ProductPriceAndImage {
  purchasePrice: number;
  productImageUrl: string | null;
}

interface ProductPriceRow {
  price: { current: number } | string;
  image_urls: string[] | string;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async getProductPriceAndImageByListingId(listingId: string): Promise<ProductPriceAndImage | null> {
    const results = await this.databaseService.query<ProductPriceRow>(
      `SELECT p.price, p.image_urls
       FROM products p
       INNER JOIN listings l ON l.product_id = p.id
       WHERE l.id = $1`,
      [listingId],
    );

    if (results.length === 0) {
      return null;
    }

    return this.extractPriceAndImage(results[0]);
  }

  async getProductPriceAndImageByAsin(asin: string): Promise<ProductPriceAndImage | null> {
    const results = await this.databaseService.query<ProductPriceRow>(
      `SELECT price, image_urls FROM products WHERE asin = $1`,
      [asin],
    );

    if (results.length === 0) {
      return null;
    }

    return this.extractPriceAndImage(results[0]);
  }

  async getProductPriceByAsin(asin: string): Promise<number | null> {
    const result = await this.getProductPriceAndImageByAsin(asin);
    return result?.purchasePrice ?? null;
  }

  private extractPriceAndImage(row: ProductPriceRow): ProductPriceAndImage {
    const priceObj = typeof row.price === 'string'
      ? (JSON.parse(row.price) as { current?: number })
      : row.price;

    const imageUrls = Array.isArray(row.image_urls)
      ? row.image_urls
      : this.safeParseJsonArray(row.image_urls);

    return {
      purchasePrice: priceObj?.current || 0,
      productImageUrl: imageUrls[0] || null,
    };
  }

  private safeParseJsonArray(value: string | string[] | null): string[] {
    if (!value) {return [];}
    try {
      const parsed: unknown = JSON.parse(String(value));
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
      return [];
    } catch {
      return [];
    }
  }
}
