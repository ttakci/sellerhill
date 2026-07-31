/**
 * Provider-Agnostic Product Data Types
 * These types represent normalized product data regardless of source (ScraperAPI, etc.)
 */

/**
 * Global trade identifiers + manufacturer part numbers for a product.
 *
 * These drive eBay catalog matching (`product.upc`/`ean`/`mpn`/`brand` on the
 * inventory item), which is what makes eBay auto-populate item specifics and
 * surface the listing in structured-data search. Without them every listing
 * falls back to whatever aspects we can scrape, which is why listings used to
 * publish with two or three specifics and a literal "Unknown".
 */
export interface ProductIdentifiers {
  upc?: string;
  ean?: string;
  /** GTIN-14 when it differs from the UPC/EAN. */
  gtin?: string;
  /** Manufacturer part number (Keepa `partNumber`). */
  mpn?: string;
  model?: string;
  /** ISBN for books/media. */
  isbn?: string;
}

/**
 * Normalized product data structure used throughout the application
 * This is the common interface that all product data providers must conform to
 */
export interface ProductData {
  asin: string;
  title: string;
  description: string;
  imageUrls: string[];
  brand: string;
  category?: string;
  manufacturer?: string;
  weight?: number;
  dimensions?: string;
  features?: string[];
  specs?: Record<string, string>; // Structured specifications (e.g., "Processor": "Intel i5", "RAM": "8GB")
  identifiers?: ProductIdentifiers; // UPC/EAN/MPN/model — eBay catalog matching
  price: {
    current: number;
    currency: string;
    avg30?: number; // 30-day average price
    avg90?: number; // 90-day average price
  };
  stock?: number;
  raw?: Record<string, unknown>; // Original provider response for debugging (ScraperAPI)
  rawKeepaData?: Record<string, unknown>; // Keepa API response for price/stock debugging
  updatedAt?: string;
}

/**
 * Product data provider interface
 * All product data services (ScraperAPI, etc.) must implement this
 */
export interface IProductDataProvider {
  /**
   * Fetch product details by ASIN and return normalized ProductData
   */
  getProductDetails(asin: string): Promise<ProductData | null>;
}
