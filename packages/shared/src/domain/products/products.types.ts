/**
 * Products Domain Types
 */

/**
 * Product DTO (Amazon product cached from Keepa)
 */
export interface ProductDto {
  id: string;
  asin: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  imageUrls: string[];
  brand?: string;
  category?: string;
  features?: string[];
  lastSyncAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Product Sync Request
 */
export interface SyncProductRequest {
  asin: string;
  forceSync?: boolean;
}
