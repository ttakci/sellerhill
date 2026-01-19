/**
 * Listing Job Entity
 */
export interface ListingJobEntity {
  id: string;
  user_id: string;
  total_asins: number;
  processed_count: number;
  success_count: number;
  failed_count: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Listing Job Item Entity
 */
export interface ListingJobItemEntity {
  id: string;
  job_id: string;
  asin: string;
  product_id: string | null;
  listing_id: string | null;
  status: string;
  ebay_item_id: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}
