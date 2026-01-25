/**
 * Provider-Agnostic Product Data Types
 * These types represent normalized product data regardless of source (ScraperAPI, etc.)
 */

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
  price: {
    current: number;
    currency: string;
    avg30?: number; // 30-day average price
    avg90?: number; // 90-day average price
  };
  stock?: number;
  raw?: any; // Original provider response for debugging (ScraperAPI)
  rawKeepaData?: any; // Keepa API response for price/stock debugging
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
