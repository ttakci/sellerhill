/**
 * Keepa API Response Types
 */

export interface KeepaProductResponse {
  timestamp: number;
  tokensLeft: number;
  refillIn: number;
  products: KeepaProduct[];
}

export interface KeepaProduct {
  asin: string;
  domainId: number;
  title: string;
  imagesCSV?: string;
  manufacturer?: string;
  brand?: string;
  label?: string;
  department?: string;
  publisher?: string;
  productGroup?: string;
  model?: string;
  color?: string;
  size?: string;
  edition?: string;
  format?: string;
  features?: string[];
  description?: string;
  categoryTree?: { id: number; name: string }[];
  packageHeight?: number;
  packageLength?: number;
  packageWidth?: number;
  packageWeight?: number;
  stats?: {
    current: number[];
    avg: number[];
    avg30: number[];
    avg90: number[];
    avg180: number[];
  };
  // csv data for historical prices (optional for now)
  csv?: number[][];
}

/**
 * Filtered/Cleaned Keepa Data for our context
 */
export interface KeepaProductData {
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
  specs?: Record<string, string>; // New field for structured specs from ScraperAPI
  price: {
    current: number;
    avg30: number;
    currency: string;
  };
}
