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
  kind: string;
  /** When a scheduled job's last group is due (migration 138); NULL = runs at once. */
  scheduled_until?: Date | null;
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
  failure_code: string | null;
  failure_details: Record<string, unknown> | string | null;
  created_at: Date;
  updated_at: Date;
  /** Selected from the joined product row on the seller-facing job detail query. */
  product_title?: string | null;
  product_image_urls?: string[] | string | null;
}
