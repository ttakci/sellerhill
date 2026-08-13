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
  // A2 auto-fulfillment per-account overrides. Enabling requires a non-null cap
  // (enforced in AmazonAccountsService). A proxy is no longer required — see
  // `proxyEnabled` below.
  autoFulfillEnabled?: boolean;
  autoFulfillCapTotal?: number | null;
  autoFulfillDryRun?: boolean;
  // Self-service proxy (replaces the platform-paid pool, migration 080). The
  // user supplies their own; when omitted/disabled, browser automation for
  // this account runs bare-IP — never a platform-funded fallback.
  proxyEnabled?: boolean;
  proxyConnectionType?: ProxyConnectionType | null;
  proxyHost?: string | null;
  proxyPort?: number | null;
  proxyUsername?: string | null;
  /** Write-only; omit on update to keep the stored password unchanged. */
  proxyPassword?: string | null;
}

export interface UpdateAmazonAccountRequest {
  label?: string;
  password?: string;
  twoFactorSecret?: string;
  // A2 auto-fulfillment per-account overrides. Enabling requires a non-null cap
  // (enforced in AmazonAccountsService). A proxy is no longer required — see
  // `proxyEnabled` below.
  autoFulfillEnabled?: boolean;
  autoFulfillCapTotal?: number | null;
  autoFulfillDryRun?: boolean;
  // Self-service proxy (replaces the platform-paid pool, migration 080).
  proxyEnabled?: boolean;
  proxyConnectionType?: ProxyConnectionType | null;
  proxyHost?: string | null;
  proxyPort?: number | null;
  proxyUsername?: string | null;
  /** Write-only; omit to keep the stored password unchanged. */
  proxyPassword?: string | null;
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

/**
 * Tracking-number conversion provider — how an Amazon tracking number is turned
 * into the number the eBay buyer sees.
 *
 * LOCAL passes the Amazon number through unchanged under `Amazon_Logistics`,
 * which is honest but tells the buyer who the supplier is. AQUILINE converts it
 * to an `AQUAA…YQ` number carried under the `AQUILINE` carrier, which eBay's
 * Add-Tracking form accepts (verified against a live eBay seller UI, 2026-08-11).
 *
 * `API` is the legacy spelling of the same "use the external provider" choice
 * and resolves to the Aquiline adapter. It was never writable — the
 * store-settings DTO rejected it — so no stored row can carry it; it is kept
 * only so an old value could never crash resolution.
 */
export enum TrackingConversionProvider {
  LOCAL = 'local',
  AQUILINE = 'aquiline',
  /** @deprecated Legacy alias for {@link TrackingConversionProvider.AQUILINE}. */
  API = 'api',
}

/**
 * Proxy transport for a user-supplied, per-Amazon-account proxy (migration
 * 080). Replaces the platform-paid `proxies` pool (that table and
 * `ProxyStatus` are retired, not deleted — see CLAUDE.md "Amazon Scraping —
 * Anti-Ban Strategy").
 */
export enum ProxyConnectionType {
  HTTP = 'http',
  HTTPS = 'https',
  SOCKS5 = 'socks5',
}
