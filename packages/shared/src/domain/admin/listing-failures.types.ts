import type { ListingFailureCode, ListingFailureDetails } from '../listings/listing-failure.types';

/**
 * Operator view of a failed listing attempt.
 *
 * This is the ONLY surface that carries the provider's raw error text. Sellers
 * get the localized `failureCode` message, because eBay's own wording ("Input
 * data for tag <BrandMPN> is invalid or missing") tells them nothing they can
 * act on — while for the engineer on call it is the whole diagnosis. Splitting
 * the two is what lets the seller-facing copy stay actionable without throwing
 * away the detail needed to fix the platform.
 */
export interface AdminListingFailureDto {
  itemId: string;
  jobId: string;
  asin: string;
  userId: string;
  /** Account the failing job belongs to, so support can reach the seller. */
  userEmail: string;
  failureCode: ListingFailureCode | null;
  failureDetails: ListingFailureDetails | null;
  /** Raw provider/internal message. Operator-only — never returned to sellers. */
  technicalMessage: string | null;
  attemptedAt: string;
}

export interface AdminListingFailuresQuery {
  page?: number;
  limit?: number;
  /** Filter to one failure code. */
  failureCode?: ListingFailureCode;
  /** ASIN or seller email prefix. */
  search?: string;
}

/** Count of failures per code for the period, so the worst class is obvious. */
export interface AdminListingFailureBreakdownDto {
  failureCode: ListingFailureCode | null;
  count: number;
}

export interface AdminListingFailuresDto {
  items: AdminListingFailureDto[];
  total: number;
  page: number;
  limit: number;
  breakdown: AdminListingFailureBreakdownDto[];
}
