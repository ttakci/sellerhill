import type { AmazonAccountStatus } from './amazon.enums';

export interface AmazonAccountDto {
  id: string;
  userId: string;
  label?: string;
  email: string;
  status: AmazonAccountStatus;
  lastVerifiedAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAmazonAccountRequest {
  label?: string;
  email: string;
  password: string;
  twoFactorSecret?: string;
}

export interface UpdateAmazonAccountRequest {
  label?: string;
  password?: string;
  twoFactorSecret?: string;
}

export interface AmazonOrderLinkRequest {
  amazonAccountId: string;
  amazonOrderId: string;
}

export interface AmazonScrapedOrderData {
  amazonOrderId: string;
  orderDate?: string;
  status?: string;
  items: {
    title: string;
    price: number;
    quantity: number;
    asin?: string;
  }[];
  subtotal: number;
  shipping: number;
  tax: number;
  grandTotal: number;
  trackingNumber?: string;
  trackingCarrier?: string;
  trackingUrl?: string;
  /**
   * True when the order page was reached but the financial summary could not be
   * parsed (DOM changed or all values were zero/NaN). Consumers MUST NOT
   * overwrite existing cost fields when this is true — see
   * `AmazonController.linkAmazonOrder` (Task 5: scrape integrity).
   */
  costCaptureFailed: boolean;
}

/**
 * Tagged result of Amazon order-financials extraction.
 * - `ok: true` — at least one non-zero value was parsed.
 * - `ok: false` — the summary selectors missed or every parsed value was 0/NaN;
 *   callers must treat this as a scrape failure and never silently zero costs.
 */
export type AmazonFinancials =
  | { ok: true; subtotal: number; shipping: number; tax: number; grandTotal: number }
  | { ok: false };

export interface AmazonOrderStatusResult {
  amazonOrderId: string;
  status: AmazonOrderStatus;
  trackingNumber?: string;
  trackingCarrier?: string;
}

export type AmazonOrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

/** Tracking-number conversion provider. Only LOCAL is active; API is reserved (no-op stub). */
export enum TrackingConversionProvider {
  LOCAL = 'local',
  API = 'api',
}
