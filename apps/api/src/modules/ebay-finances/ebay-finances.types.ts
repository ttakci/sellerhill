// apps/api/src/modules/ebay-finances/ebay-finances.types.ts

/** The paging facts of one `getBillingActivities` response — no line is interpreted. */
export interface BillingPage {
  /** Entries in `billingActivities` on this page. */
  count: number;
  /** eBay's `total`, or null when it was not a number. */
  total: number | null;
  /** eBay returned a non-empty `next` URL. */
  hasNext: boolean;
  /** The `feeType` strings on this page, for the log summary only. */
  feeTypes: string[];
}

export interface BillingActivitiesParams {
  /** `transactionDate:[start..end]` (see `buildBillingDateFilter`). */
  filter: string;
  /** Zero-based record offset. */
  offset: number;
}

export interface ClaimedBillingAccount {
  id: string;
  user_id: string;
}
