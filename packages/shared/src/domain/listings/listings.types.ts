/**
 * Listings Domain Types
 */

/**
 * eBay Business Policy Type
 */
export enum PolicyType {
  PAYMENT = 'payment',
  SHIPPING = 'shipping',
  RETURN = 'return',
}

/**
 * Listing Status
 */
export enum ListingStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  RETRYING = 'retrying',
}

/**
 * Listing Job Status
 */
export enum ListingJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Listing DTO
 */
export interface ListingDto {
  id: string;
  userId: string;
  asin: string;
  productId: string;
  title: string;
  description?: string;
  price: number;
  quantity: number;
  imageUrls: string[];
  ebayListingId?: string;
  listingSettingsGroupId: string;
  paymentPolicyId: string;
  shippingPolicyId: string;
  returnPolicyId: string;
  status: ListingStatus;
  purchasePrice?: number;
  estimatedProfit?: number;
  profitMargin?: number;
  roi?: number;
  soldCount?: number;
  watchCount?: number;
  viewCount?: number;
  category?: string;
  brand?: string;
  sourceStock?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Listing Job DTO (tracks bulk listing creation)
 */
export interface ListingJobDto {
  id: string;
  userId: string;
  totalAsins: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  status: ListingJobStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Listing Job Item DTO (individual ASIN in a job)
 */
export interface ListingJobItemDto {
  id: string;
  jobId: string;
  asin: string;
  productId?: string;
  listingId?: string;
  status: ListingStatus;
  ebayItemId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create Listings Request (Bulk)
 */
export interface CreateListingsRequest {
  asins: string[];
  listingSettingsGroupId: string;
  paymentPolicyId: string;
  shippingPolicyId: string;
  returnPolicyId: string;
}

/**
 * eBay Business Policy DTO
 */
export interface EbayBusinessPolicyDto {
  id: string;
  name: string;
  description?: string;
  type: PolicyType;
}

/**
 * Listing Queue Job Data
 */
export interface ListingQueueJobData {
  jobId: string;
  userId: string;
  asin: string;
  listingSettingsGroupId: string;
  paymentPolicyId: string;
  shippingPolicyId: string;
  returnPolicyId: string;
}

/**
 * Listing Creation Data - used by eBay service for creating listings
 * Replaces `any` types in eBay service methods
 */
export interface ListingCreationData {
  title: string;
  description: string;
  brand: string;
  specs?: Record<string, string>;
  features?: string[];
  quantity: number;
  imageUrls: string[];
  price: number;
  currency: string;
  country: string;
  postalCode?: string;
  location?: string;
  address1?: string;
  // Calculated metrics
  purchasePrice?: number;
  estimatedProfit?: number;
  profitMargin?: number;
  roi?: number;
}
