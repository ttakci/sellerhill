import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import {
  AmazonAccountStatus,
  AmazonMarketplace,
  buildAmazonSiteUrl,
  type AmazonScrapedOrderData,
} from '@repo/shared';
import type { Locator, Page } from 'playwright';

import { AmazonAccountsService } from './amazon-accounts.service';
import { probeAmazonAuth } from './amazon-auth-state';
import { AmazonOrderParserService } from './amazon-order-parser.service';
import { AmazonRateLimiter } from './amazon-rate-limiter.service';
import { BrowserStateManager } from './browser-state-manager.service';

export interface ScrapingProgress {
  stage: 'logging_in' | 'navigating' | 'scraping' | 'saving' | 'done' | 'error';
  message: string;
}

/**
 * True when `href`, resolved against `originUrl`, is a safe target to navigate an
 * authenticated Amazon session to: HTTPS and the SAME hostname as the marketplace
 * origin we already trust (built via `buildAmazonSiteUrl`, never hardcoded). The
 * "Track package" anchor comes from Amazon's own rendered page and is expected to
 * resolve within Amazon's own site — a different host, a non-https scheme
 * (`http:`, `javascript:`, `data:`, …) or a malformed href is refused rather than
 * navigated to, because that navigation happens inside a session holding the
 * seller's real, logged-in Amazon cookies.
 */
export function isTrustedAmazonTrackingUrl(href: string, originUrl: string): boolean {
  try {
    const resolved = new URL(href, originUrl);
    const origin = new URL(originUrl);
    return resolved.protocol === 'https:' && resolved.hostname === origin.hostname;
  } catch {
    return false;
  }
}

/**
 * One row from the account "Your Orders" list page (Amazon order-list scrape).
 * Returned by `AmazonScrapingService.scrapeAccountOrders`. Mirrors what the
 * per-order detail-page scrape produces, but limited to the fields the auto
 * cost-capture matcher needs. `asin` is optional because the list view may
 * hide it behind a navigation; the matcher rejects candidates without ASIN
 * equality, so a missing ASIN here simply means that Amazon order can't be
 * auto-linked from the list (it'll still be linkable manually).
 */
export interface AmazonListOrderRow {
  amazonOrderId: string;
  asin?: string;
  quantity: number;
  grandTotal: number;
  tax: number;
  shipping: number;
  purchasePrice: number;
  orderDate: Date;
}

/**
 * Discriminated scrape result for `scrapeAccountOrders`. `suspect` flags a
 * 0-row scrape that we cannot confidently call "legit empty" — either Amazon
 * redirected away from the orders URL (captcha / signin / soft-block) OR the
 * first page had zero order cards (broken selector or unrendered DOM). In both
 * cases the caller MUST NOT advance `last_orders_sync_at` — next tick re-pulls
 * the same window. A non-empty `rows` always implies `suspect = false`.
 */
export interface ScrapedAccountOrders {
  rows: AmazonListOrderRow[];
  suspect: boolean;
}

// Amazon now returns HTTP 404 for the bare `/ap/signin` path. The OpenID
// parameters are required to initialize the unified-auth flow (observed live
// 2026-07-30). Keep this centralized: verification, scraping and checkout all
// delegate to performLogin, so there must be only one login entry URL.
const AMAZON_SIGN_IN_URL =
  'https://www.amazon.com/ap/signin?openid.return_to=https%3A%2F%2Fwww.amazon.com%2F&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=usflex&openid.mode=checkid_setup&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0';

const AMAZON_LOGIN_SELECTORS = {
  // Legacy Amazon used #ap_email. Unified Auth (2026) uses #ap_email_login.
  emailInput: '#ap_email_login, #ap_email, input[name="email"]',
  continueButton: '#continue, input[type="submit"]:visible, button[type="submit"]:visible',
  // Unified Auth can insert `/ax/claim/intent` after email submission. The
  // observed page exposes exactly one visible submit and no credential fields;
  // clicking it confirms the requested sign-in intent and advances to password.
  claimIntentContinue: 'input[type="submit"]:visible, button[type="submit"]:visible',
  passwordInput:
    '#ap_password_login, #ap_password, input[name="password"]:visible, input[type="password"]:visible',
  signInButton: '#signInSubmit, input[type="submit"]:visible, button[type="submit"]:visible',
  mfaInput: '#auth-mfa-otpcode, input[name="otpCode"]',
  mfaSubmit: '#auth-signin-button, input[type="submit"]:visible, button[type="submit"]:visible',
  /**
   * "Keep me signed in". Off by default; checking it extends session life, which
   * cuts repeat logins — and every extra login is another chance for Amazon to
   * raise a challenge that stops an order.
   */
  keepSignedInCheckbox: '#auth-rememberMe-checkbox, input[name="rememberMe"]',
  /** OTP "don't ask on this device again" — same session-longevity rationale. */
  mfaRememberDevice: '#auth-mfa-remember-device, input[name="rememberDevice"]',
  /**
   * Registration form. Amazon shows this when it does not recognize the email —
   * it must NEVER be filled in. Creating an unintended Amazon account under the
   * customer's email is a destructive side effect, and the fields overlap with
   * the sign-in form enough that a blind fill lands here (observed live:
   * "Create account" with `#ap_customer_name` + a re-enter-password field).
   */
  registrationForm: '#ap_customer_name, input[name="customerName"], #ap_password_check',
} as const;

// ---------------------------------------------------------------------------
// FRAGILE: Amazon "Your Orders" list-page DOM selectors.
//
// Keep ALL selectors in this one block so a DOM change on Amazon's side is a
// one-place patch. These mirror Amazon's modernized React orders page
// (https://www.amazon.com/your-orders/orders) as observed in 2024-2025.
// Amazon rotates obfuscated class names frequently; the data-component /
// data-testid attributes are more stable but not guaranteed. VERIFY against a
// live session before relying on output (controller-deferred — see task brief).
// Per-row extraction is wrapped in try/catch so one bad card never fails the
// whole batch.
// ---------------------------------------------------------------------------
const ORDER_LIST_SELECTORS = {
  // Each order is a card. Amazon has shipped multiple layouts — try each.
  orderCard: [
    '[data-component="order-card"]',
    '.yo1JGqUWoy0k__order-card',
    '.order-card',
    '[data-testid="order-card"]',
  ],
  // "View order details" / invoice link carries the orderId in the URL.
  orderDetailsLink:
    'a[href*="orderID="], a[href*="order-details"], a[href*="/gp/your-account/order-details"]',
  // Order id literal fallback ("Order # 111-2222222-3333333").
  orderIdText: '[data-testid="order-id"], .order-id',
  // "Placed on January 15, 2025" — date the order was placed.
  orderDate: '[data-testid="order-date"], .order-date, [data-component="orderDate"]',
  // Total amount row ("Total: $42.99" or "Order Total: $42.99").
  total: '[data-testid="order-total"], .order-total, .yo1JGqUWoy0k__order-total',
  // Financial sub-rows inside the card's cost summary.
  financialSummary: '[data-testid="order-summary"], .order-summary, .payment-breakdown',
  // First product link in the card — usually carries ASIN in /dp/ASIN or /gp/product/ASIN.
  productLink: 'a[href*="/dp/"], a[href*="/gp/product/"], a[href*="/gp/product/"]',
  // Quantity inputs (rare on list view — default to 1 when missing).
  quantity: '.item-view-qty, .quantity, [data-testid="quantity"]',
  // Pagination "next" button to walk back through history.
  nextPageButton: 'ul.a-pagination li.a-last a, a[aria-label="Next"]',
} as const;

@Injectable()
export class AmazonScrapingService {
  private readonly logger = new Logger(AmazonScrapingService.name);

  constructor(
    private readonly accountsService: AmazonAccountsService,
    private readonly parserService: AmazonOrderParserService,
    private readonly browserStateManager: BrowserStateManager,
    private readonly rateLimiter: AmazonRateLimiter
  ) {}

  /**
   * Capture a login-failure screenshot before the page is closed.
   *
   * Every failure path in `performLogin` closes the page and throws a text
   * message, which left login blocks with no visual evidence at all — the one
   * class of failure where the DOM is the whole story (which Amazon screen came
   * up, and why). Written next to the checkout evidence so an operator finds
   * both in one place. Best-effort: never let diagnostics break the flow.
   */
  private async snapLoginFailure(
    page: Page,
    amazonAccountId: string,
    stage: string
  ): Promise<void> {
    try {
      const root =
        process.env.FULFILLMENT_EVIDENCE_DIR || path.join(process.cwd(), 'fulfillment-evidence');
      const dir = path.join(root, 'login', amazonAccountId);
      await fs.mkdir(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `${stage}-${Date.now()}.png`), fullPage: true });
    } catch (err) {
      this.logger.warn(`login evidence snap failed (${stage}): ${(err as Error).message}`);
    }
  }

  async scrapeOrder(
    userId: string,
    amazonAccountId: string,
    amazonOrderId: string,
    onProgress?: (progress: ScrapingProgress) => void
  ): Promise<AmazonScrapedOrderData> {
    return this.rateLimiter.schedule(amazonAccountId, () =>
      this.doScrapeOrder(userId, amazonAccountId, amazonOrderId, onProgress)
    );
  }

  private async doScrapeOrder(
    userId: string,
    amazonAccountId: string,
    amazonOrderId: string,
    onProgress?: (progress: ScrapingProgress) => void
  ): Promise<AmazonScrapedOrderData> {
    const account = await this.accountsService.getDecrypted(userId, amazonAccountId);

    try {
      onProgress?.({ stage: 'logging_in', message: 'Logging into Amazon...' });

      // Check if existing session is valid
      const hasValidSession = await this.browserStateManager.isSessionValid(amazonAccountId);

      let page;
      if (hasValidSession) {
        const context = await this.browserStateManager.getContext(amazonAccountId);
        page = await context.newPage();
        this.logger.debug(`Reusing existing session for account ${amazonAccountId}`);
      } else {
        page = await this.performLogin(amazonAccountId, account.email, account.decryptedPassword, account.decryptedTwoFactorSecret, account.marketplace as AmazonMarketplace);
      }

      try {
        onProgress?.({ stage: 'navigating', message: 'Navigating to order page...' });

        const orderUrl = `${buildAmazonSiteUrl(account.marketplace as AmazonMarketplace)}/gp/your-account/order-details/ref=ppx_yo_dt_b_order_details_o00?ie=UTF8&orderID=${amazonOrderId}`;
        await page.goto(orderUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        // Check if order page loaded correctly
        const pageUrl = page.url();
        if (pageUrl.includes('/signin') || pageUrl.includes('/ap/signin')) {
          // Session expired mid-request, re-login
          await page.close();
          await this.browserStateManager.clearState(amazonAccountId);
          page = await this.performLogin(amazonAccountId, account.email, account.decryptedPassword, account.decryptedTwoFactorSecret, account.marketplace as AmazonMarketplace);
          await page.goto(orderUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(2000);
        }

        onProgress?.({ stage: 'scraping', message: 'Scraping order details...' });

        const scrapedData = await this.parserService.parseOrderPage(page, amazonOrderId);

        onProgress?.({ stage: 'saving', message: 'Saving order data...' });

        // Save browser state for session reuse
        await this.browserStateManager.saveState(amazonAccountId);

        // Mark account as used
        await this.accountsService.markUsed(amazonAccountId);
        await this.accountsService.markVerified(userId, amazonAccountId);

        onProgress?.({ stage: 'done', message: 'Complete' });

        return scrapedData;
      } finally {
        await page.close();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Scraping failed for order ${amazonOrderId}: ${message}`);

      // Mark account as invalid if credentials failed
      if (message.includes('login failed') || message.includes('Invalid credentials')) {
        await this.accountsService.updateStatus(userId, amazonAccountId, AmazonAccountStatus.INVALID);
        await this.browserStateManager.clearState(amazonAccountId);
      }

      onProgress?.({ stage: 'error', message });
      throw error;
    }
  }

  async scrapeOrderStatus(
    userId: string,
    amazonAccountId: string,
    amazonOrderId: string
  ): Promise<{ status: string; trackingNumber?: string; trackingCarrier?: string }> {
    return this.rateLimiter.schedule(amazonAccountId, () =>
      this.doScrapeOrderStatus(userId, amazonAccountId, amazonOrderId)
    );
  }

  private async doScrapeOrderStatus(
    userId: string,
    amazonAccountId: string,
    amazonOrderId: string
  ): Promise<{ status: string; trackingNumber?: string; trackingCarrier?: string }> {
    const account = await this.accountsService.getDecrypted(userId, amazonAccountId);

    const hasValidSession = await this.browserStateManager.isSessionValid(amazonAccountId);

    let page;
    if (hasValidSession) {
      const context = await this.browserStateManager.getContext(amazonAccountId);
      page = await context.newPage();
    } else {
      page = await this.performLogin(amazonAccountId, account.email, account.decryptedPassword, account.decryptedTwoFactorSecret, account.marketplace as AmazonMarketplace);
    }

    try {
      const orderUrl = `${buildAmazonSiteUrl(account.marketplace as AmazonMarketplace)}/gp/your-account/order-details/ref=ppx_yo_dt_b_order_details_o00?ie=UTF8&orderID=${amazonOrderId}`;
      await page.goto(orderUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Save state after successful navigation
      await this.browserStateManager.saveState(amazonAccountId);

      return await this.parserService.parseOrderStatus(page);
    } finally {
      await page.close();
    }
  }

  /**
   * Order status AND the ship-track page HTML, in ONE rate-limiter slot.
   *
   * Aquiline wants the ship-track page (never order-details) roughly daily for an
   * in-flight order. Doing it in a second slot would cost a second Chromium page,
   * a second session check and a 3s per-account wait, and would double the slots
   * an in-flight order consumes against a platform ceiling of
   * AMAZON_GLOBAL_CONCURRENCY x 86,400 browser-seconds/day.
   *
   * The decisive reason is correctness, though: an Amazon order can ship as
   * several packages and the real tracking URL carries a package index. Reading
   * the link Amazon itself renders — while still on order-details — is what
   * avoids the provider's own `tracking_url_mismatch` / `wrong_page_type`
   * problems. A constructed URL cannot know the index.
   */
  async scrapeOrderStatusWithTrackingHtml(
    userId: string,
    amazonAccountId: string,
    amazonOrderId: string
  ): Promise<{
    status: string;
    trackingNumber?: string;
    trackingCarrier?: string;
    trackingUrl?: string;
    trackingHtml?: string;
  }> {
    return this.rateLimiter.schedule(amazonAccountId, () =>
      this.doScrapeOrderStatusWithTrackingHtml(userId, amazonAccountId, amazonOrderId)
    );
  }

  private async doScrapeOrderStatusWithTrackingHtml(
    userId: string,
    amazonAccountId: string,
    amazonOrderId: string
  ): Promise<{
    status: string;
    trackingNumber?: string;
    trackingCarrier?: string;
    trackingUrl?: string;
    trackingHtml?: string;
  }> {
    const account = await this.accountsService.getDecrypted(userId, amazonAccountId);

    const hasValidSession = await this.browserStateManager.isSessionValid(amazonAccountId);

    let page;
    if (hasValidSession) {
      const context = await this.browserStateManager.getContext(amazonAccountId);
      page = await context.newPage();
    } else {
      page = await this.performLogin(amazonAccountId, account.email, account.decryptedPassword, account.decryptedTwoFactorSecret, account.marketplace as AmazonMarketplace);
    }

    try {
      const orderUrl = `${buildAmazonSiteUrl(account.marketplace as AmazonMarketplace)}/gp/your-account/order-details/ref=ppx_yo_dt_b_order_details_o00?ie=UTF8&orderID=${amazonOrderId}`;
      await page.goto(orderUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Save state after successful navigation
      await this.browserStateManager.saveState(amazonAccountId);

      const parsed = await this.parserService.parseOrderStatus(page);

      let trackingHtml: string | undefined;
      if (parsed.trackingUrl) {
        const origin = buildAmazonSiteUrl(account.marketplace as AmazonMarketplace);
        if (!isTrustedAmazonTrackingUrl(parsed.trackingUrl, origin)) {
          this.logger.warn(
            `Ship-track HTML capture skipped for order ${amazonOrderId}: tracking URL is not a trusted Amazon host`
          );
        } else {
          try {
            const trackingHref = new URL(parsed.trackingUrl, origin).toString();
            await page.goto(trackingHref, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(1500);
            trackingHtml = await page.content();
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(
              `Ship-track HTML capture failed for order ${amazonOrderId}: ${message}`
            );
          }
        }
      }

      return { ...parsed, trackingHtml };
    } finally {
      await page.close();
    }
  }

  /**
   * Verifies that stored credentials can log into Amazon (2FA-aware).
   * Runs under the per-account rate limiter, reuses performLogin (the only
   * login code path), and never throws — callers get a result object.
   */
  async testLogin(
    userId: string,
    amazonAccountId: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.rateLimiter.schedule(amazonAccountId, async () => {
      const account = await this.accountsService.getDecrypted(userId, amazonAccountId);
      try {
        const page = await this.performLogin(
          amazonAccountId,
          account.email,
          account.decryptedPassword,
          account.decryptedTwoFactorSecret,
          account.marketplace as AmazonMarketplace
        );
        await page.close();
        return { success: true };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Verify login failed for account ${amazonAccountId}: ${message}`);
        return { success: false, error: message };
      }
    });
  }

  /**
   * Open an authenticated page for the given Amazon account, reusing an existing
   * persistent session when valid and falling back to a full login (incl. 2FA)
   * otherwise. Returns a fresh Page that the caller MUST `close()` in a
   * `finally` block. Used by the auto-fulfill checkout flow (Task 6) so it does
   * not reimplement login/session handling — single login code path.
   *
   * Same rate-limit + browser-state invariants as `doScrapeOrder`: the caller
   * must already be inside `AmazonRateLimiter.schedule(accountId, …)` (the
   * checkout service wraps the whole flow in one schedule call). On a signin
   * redirect detected after the page opens, the caller is expected to re-login
   * by calling this method again; that recovery path is intentionally NOT
   * duplicated here.
   */
  async ensureAuthenticatedPage(
    userId: string,
    amazonAccountId: string,
  ): Promise<Page> {
    const account = await this.accountsService.getDecrypted(userId, amazonAccountId);
    const hasValidSession = await this.browserStateManager.isSessionValid(amazonAccountId);
    if (hasValidSession) {
      const context = await this.browserStateManager.getContext(amazonAccountId);
      return context.newPage();
    }
    return this.performLogin(
      amazonAccountId,
      account.email,
      account.decryptedPassword,
      account.decryptedTwoFactorSecret,
      account.marketplace as AmazonMarketplace,
    );
  }

  /**
   * Scrape the account's "Your Orders" list page and return all orders placed
   * since `since`. Powers the auto cost-capture job (Task 7).
   *
   * Reuses the same stealth/rate-limit/browser-state stack as `scrapeOrder`:
   * session-isolated per account, scheduled through the per-account limiter
   * (1 concurrent, 3s apart). Walks pagination backwards from the most recent
   * order until it sees an order older than `since`, then stops.
   *
   * SELECTORS ARE FRAGILE — see `ORDER_LIST_SELECTORS` above. This method is
   * best-effort: per-order try/catch means a single broken card is logged and
   * skipped; transport failures bubble up so BullMQ retries the whole job.
   * Returns an empty array if no recent orders — never throws on DOM misses.
   */
  async scrapeAccountOrders(
    userId: string,
    amazonAccountId: string,
    since: Date,
  ): Promise<ScrapedAccountOrders> {
    return this.rateLimiter.schedule(amazonAccountId, () =>
      this.doScrapeAccountOrders(userId, amazonAccountId, since),
    );
  }

  private async doScrapeAccountOrders(
    userId: string,
    amazonAccountId: string,
    since: Date,
  ): Promise<ScrapedAccountOrders> {
    const account = await this.accountsService.getDecrypted(userId, amazonAccountId);

    const hasValidSession = await this.browserStateManager.isSessionValid(amazonAccountId);

    let page: Page;
    if (hasValidSession) {
      const context = await this.browserStateManager.getContext(amazonAccountId);
      page = await context.newPage();
    } else {
      page = await this.performLogin(
        amazonAccountId,
        account.email,
        account.decryptedPassword,
        account.decryptedTwoFactorSecret,
        account.marketplace as AmazonMarketplace,
      );
    }

    try {
      // The modernized orders page. `timeFilter` broadens the window; we still
      // filter by exact `since` cutoff in code so the matcher only sees fresh
      // rows. The page itself only paginates so far back — if the user hasn't
      // synced in >1 year, we miss older orders (acceptable: cost-capture is
      // best-effort, controller-mediated for any gap).
      const ordersUrl = `${buildAmazonSiteUrl(account.marketplace as AmazonMarketplace)}/your-orders/orders?timeFilter=year-` +
        new Date().getFullYear();
      await page.goto(ordersUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(1500);

      // If Amazon bounced us to signin, the cached session is stale — re-login
      // once and retry navigation. Same recovery as `doScrapeOrder`.
      if (page.url().includes('/signin') || page.url().includes('/ap/signin')) {
        await page.close();
        await this.browserStateManager.clearState(amazonAccountId);
        page = await this.performLogin(
          amazonAccountId,
          account.email,
          account.decryptedPassword,
          account.decryptedTwoFactorSecret,
          account.marketplace as AmazonMarketplace,
        );
        await page.goto(ordersUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForTimeout(1500);
      }

      // Redirect-recheck: after signin recovery, if the URL still doesn't look
      // like the orders page (captcha / verify-email / soft-block / wrong-path
      // redirect), mark the scrape suspect so the caller does NOT advance the
      // watermark. A 0-row result from a non-orders page is NOT a legit empty.
      const postNavUrl = page.url();
      let suspect = !postNavUrl.includes('/your-orders/orders');

      const results: AmazonListOrderRow[] = [];
      const sinceMs = since.getTime();
      let walkedPastSince = false;
      const maxPages = 10; // hard stop — don't walk forever on a malformed DOM

      for (let pageNum = 1; pageNum <= maxPages && !walkedPastSince; pageNum++) {
        const cards = await this.locateOrderCards(page);
        const cardCount = await cards.count().catch(() => 0);
        if (cardCount === 0) {
          // 0 cards on page 1 is the canary for a broken-selector regression
          // or unrendered DOM — treat as suspect so the watermark isn't
          // advanced. 0 cards on later pages is the natural end of pagination
          // and is NOT suspect.
          if (pageNum === 1) {
            suspect = true;
            this.logger.warn(
              `Account ${amazonAccountId}: no order cards on page 1 — ` +
                `possible DOM/selector regression (suspect scrape).`,
            );
          } else {
            this.logger.debug(
              `Account ${amazonAccountId}: no order cards on page ${pageNum} — stopping.`,
            );
          }
          break;
        }

        for (let i = 0; i < cardCount; i++) {
          try {
            const row = await this.extractListOrderRow(page, i);
            if (!row) {continue;}

            if (row.orderDate.getTime() < sinceMs) {
              // Hit history older than the cutoff — no need to keep paging.
              walkedPastSince = true;
              break;
            }
            results.push(row);
          } catch (err) {
            // Per-card failure isolation — never fail the whole job for one row.
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `Account ${amazonAccountId}: card ${i} on page ${pageNum} skipped: ${msg}`,
            );
          }
        }

        if (walkedPastSince) {break;}

        // Try to advance to the next page. If there's no next button (or it's
        // disabled), we've reached the end of the visible history.
        const next = page.locator(ORDER_LIST_SELECTORS.nextPageButton).first();
        const hasNext = await next.isVisible({ timeout: 1000 }).catch(() => false);
        if (!hasNext) {break;}
        try {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {}),
            next.click(),
          ]);
          await page.waitForTimeout(1000);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Account ${amazonAccountId}: pagination stopped: ${msg}`);
          break;
        }
      }

      await this.browserStateManager.saveState(amazonAccountId);
      await this.accountsService.markUsed(amazonAccountId);

      // A non-empty result cannot be suspect by construction — we found real
      // order cards and parsed them. Clear any transient suspect flag set
      // before the loop navigated to a good page.
      const finalSuspect = results.length > 0 ? false : suspect;
      this.logger.log(
        `Account ${amazonAccountId}: scraped ${results.length} orders since ${since.toISOString()}` +
          (finalSuspect ? ' (SUSPECT — watermark will not advance)' : ''),
      );
      return { rows: results, suspect: finalSuspect };
    } finally {
      await page.close();
    }
  }

  /**
   * Locate all order-card elements on the current page, trying each known
   * selector in order. Returns the first matching Locator (callers `.count()`
   * to surface zero = no cards = end of history / DOM change).
   */
  private async locateOrderCards(page: Page): Promise<Locator> {
    for (const sel of ORDER_LIST_SELECTORS.orderCard) {
      const locator = page.locator(sel);
      const count = await locator.count().catch(() => 0);
      if (count > 0) {
        return locator;
      }
    }
    return page.locator(ORDER_LIST_SELECTORS.orderCard[0]);
  }

  /**
   * Best-effort extraction of a single order-list row. Returns `null` when the
   * card was missing the orderId (the only field we can't fake). Missing
   * financials default to 0 — the matcher will then fail amount-tolerance and
   * simply not link that row (no harm done; controller-mediated re-link still
   * works via the order-detail scraper).
   */
  private async extractListOrderRow(
    page: Page,
    cardIndex: number,
  ): Promise<AmazonListOrderRow | null> {
    // Re-resolve the card locator so the helper works regardless of which
    // alternate selector matched above.
    const cards = await this.locateOrderCards(page);
    const card = cards.nth(cardIndex);

    // Order ID — prefer URL-bearing link, fall back to literal text.
    let amazonOrderId: string | undefined;
    const detailsLink = card.locator(ORDER_LIST_SELECTORS.orderDetailsLink).first();
    if (await detailsLink.isVisible({ timeout: 500 }).catch(() => false)) {
      const href = await detailsLink.getAttribute('href').catch(() => null);
      const m = href?.match(/orderID=([0-9A-Z-]+)/i);
      amazonOrderId = m?.[1];
    }
    if (!amazonOrderId) {
      const idEl = card.locator(ORDER_LIST_SELECTORS.orderIdText).first();
      if (await idEl.isVisible({ timeout: 500 }).catch(() => false)) {
        const txt = (await idEl.textContent()) ?? '';
        const m = txt.match(/(\d{3}-\d{7}-\d{7})/);
        amazonOrderId = m?.[1];
      }
    }
    if (!amazonOrderId) {return null;}

    // Order date — "Placed on January 15, 2025".
    let orderDate = new Date();
    const dateEl = card.locator(ORDER_LIST_SELECTORS.orderDate).first();
    if (await dateEl.isVisible({ timeout: 500 }).catch(() => false)) {
      const txt = (await dateEl.textContent()) ?? '';
      const parsed = new Date(txt.replace(/.*placed on/i, '').trim());
      if (!Number.isNaN(parsed.getTime())) {orderDate = parsed;}
    }

    // ASIN from the first product link.
    let asin: string | undefined;
    const productLink = card.locator(ORDER_LIST_SELECTORS.productLink).first();
    if (await productLink.isVisible({ timeout: 500 }).catch(() => false)) {
      const href = await productLink.getAttribute('href').catch(() => null);
      const m = href?.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
      asin = m?.[1];
    }

    // Quantity — list view rarely exposes this; default to 1 (the matcher
    // requires exact equality, so an unknown qty means no link — safe miss).
    let quantity = 1;
    const qtyEl = card.locator(ORDER_LIST_SELECTORS.quantity).first();
    if (await qtyEl.isVisible({ timeout: 500 }).catch(() => false)) {
      const txt = (await qtyEl.textContent()) ?? '';
      const m = txt.match(/\d+/);
      if (m) {quantity = parseInt(m[0], 10) || 1;}
    }

    // Financials — try the card-local summary; fall back to the total line.
    let grandTotal = 0;
    let tax = 0;
    let shipping = 0;
    let purchasePrice = 0;

    const summary = card.locator(ORDER_LIST_SELECTORS.financialSummary).first();
    if (await summary.isVisible({ timeout: 500 }).catch(() => false)) {
      const txt = (await summary.textContent()) ?? '';
      const parsed = this.parseListFinancials(txt);
      grandTotal = parsed.grandTotal;
      tax = parsed.tax;
      shipping = parsed.shipping;
      purchasePrice = parsed.subtotal || grandTotal - tax - shipping;
    }
    if (grandTotal === 0) {
      const totalEl = card.locator(ORDER_LIST_SELECTORS.total).first();
      if (await totalEl.isVisible({ timeout: 500 }).catch(() => false)) {
        const txt = (await totalEl.textContent()) ?? '';
        const m = txt.match(/\$?([\d,]+(?:\.\d{2})?)/);
        if (m) {grandTotal = parseFloat(m[1].replace(/,/g, '')) || 0;}
      }
    }
    if (purchasePrice === 0 && grandTotal > 0) {
      purchasePrice = Math.max(0, grandTotal - tax - shipping);
    }

    return {
      amazonOrderId,
      asin,
      quantity,
      grandTotal,
      tax,
      shipping,
      purchasePrice,
      orderDate,
    };
  }

  /**
   * Parse the financial summary block from an order card. Same shape as the
   * single-order parser but operates on the smaller list-view summary text.
   * Returns zeros on miss — caller decides whether to fall back to the total
   * line.
   */
  private parseListFinancials(text: string): {
    subtotal: number;
    shipping: number;
    tax: number;
    grandTotal: number;
  } {
    const grab = (pattern: RegExp): number => {
      const m = text.match(pattern);
      if (!m?.[1]) {return 0;}
      return parseFloat(m[1].replace(/,/g, '')) || 0;
    };
    const subtotal =
      grab(/subtotal[:\s]*\$?([\d,]+\.?\d*)/i) ||
      grab(/merchandise[:\s]*\$?([\d,]+\.?\d*)/i);
    const shipping = grab(/shipping[:\s]*\$?([\d,]+\.?\d*)/i);
    const tax =
      grab(/tax[:\s]*\$?([\d,]+\.?\d*)/i) ||
      grab(/estimated tax[:\s]*\$?([\d,]+\.?\d*)/i);
    const grandTotal =
      grab(/grand total[:\s]*\$?([\d,]+\.?\d*)/i) ||
      grab(/total[:\s]*\$?([\d,]+\.?\d*)/i) ||
      grab(/order total[:\s]*\$?([\d,]+\.?\d*)/i);
    return { subtotal, shipping, tax, grandTotal };
  }

  private async performLogin(
    amazonAccountId: string,
    email: string,
    password: string,
    twoFactorSecret: string | null,
    marketplace: AmazonMarketplace = AmazonMarketplace.AMAZON_US
  ): Promise<import('playwright').Page> {
    const context = await this.browserStateManager.getContext(amazonAccountId);
    const page = await context.newPage();

    const response = await page.goto(AMAZON_SIGN_IN_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const emailInput = page.locator(AMAZON_LOGIN_SELECTORS.emailInput).first();
    const emailVisible = await emailInput
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    if (!emailVisible) {
      // No email field can mean the OPPOSITE of a failure: Amazon skips the
      // sign-in form when the session is already authenticated. Probe before
      // reporting an error, otherwise a healthy session is thrown away and the
      // caller blocks the order on `login` (observed live: the storefront
      // rendered "Hello, <name>" with the item already in the cart).
      const alreadyAuthed = await probeAmazonAuth(page);
      if (alreadyAuthed.authenticated) {
        this.logger.debug(
          `Amazon skipped the sign-in form for ${amazonAccountId}: session already authenticated`
        );
        await this.browserStateManager.saveState(amazonAccountId);
        return page;
      }

      // Amazon also skips the email step when it REMEMBERS the identity and
      // asks only for the password ("Sign in" showing the saved name/email).
      // That is a normal returning-customer screen, not a broken selector, so
      // continue from the password step instead of failing the order.
      const passwordOnly = await page
        .locator(AMAZON_LOGIN_SELECTORS.passwordInput)
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (!passwordOnly) {
        const status = response?.status() ?? 'unknown';
        const title = await page.title().catch(() => 'unknown');
        const url = page.url();
        await this.snapLoginFailure(page, amazonAccountId, 'no-email-field');
        await page.close();
        throw new Error(
          `Amazon login page did not expose an email field (HTTP ${status}, URL ${url}, title ${title})`
        );
      }
      this.logger.debug(
        `Amazon remembered the identity for ${amazonAccountId}: entering at the password step`
      );
      await this.submitPasswordAndChallenges(page, password, twoFactorSecret, amazonAccountId);
    } else {
      await this.submitCredentialsOnPage(page, email, password, twoFactorSecret, amazonAccountId);
    }

    // A submit completing without an error is NOT proof of authentication.
    // Land on the storefront and require a positive signed-in signal; Unified
    // Auth can remain under /ax/claim/* and the old code falsely marked such
    // sessions ACTIVE, causing checkout to run on a signed-out page.
    await page.goto(buildAmazonSiteUrl(marketplace), {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);
    const authProbe = await probeAmazonAuth(page);
    if (!authProbe.authenticated) {
      await this.snapLoginFailure(page, amazonAccountId, 'auth-not-proven');
      await page.close();
      await this.browserStateManager.clearState(amazonAccountId);
      throw new Error(
        `Amazon authentication could not be proven (route=${authProbe.route}; authRoute=${authProbe.authRoute}; authControl=${authProbe.authControlVisible}; signedOutNav=${authProbe.signedOutNav}; signedInNav=${authProbe.signedInNav}; accountMarker=${authProbe.accountPageMarker})`
      );
    }

    // Save only a positively-proven authenticated session.
    await this.browserStateManager.saveState(amazonAccountId);

    return page;
  }

  /**
   * Drive Amazon's credential flow on the page as it currently stands: email →
   * optional intent confirmation → password → challenge resolution (TOTP).
   *
   * Extracted from `performLogin` because Amazon runs the SAME flow as an
   * "in-context authentication" step when entering checkout from a browsing
   * session (observed live: `signin/checkout-perf-initiate-and-store.html`,
   * `InContextAuthBaseAssets`). Re-driving it in place is what lets checkout
   * recover without abandoning the cart — and without a customer ever typing a
   * password or an OTP, which the product promise requires.
   *
   * Assumes an email field is already visible. Does NOT prove authentication or
   * persist state; the caller decides how to verify (account-page probe for a
   * fresh login, challenge-absence for a mid-checkout recovery).
   */
  private async submitCredentialsOnPage(
    page: Page,
    email: string,
    password: string,
    twoFactorSecret: string | null,
    amazonAccountId: string,
    closePageOnAbort = true
  ): Promise<void> {
    const emailInput = page.locator(AMAZON_LOGIN_SELECTORS.emailInput).first();
    await emailInput.fill(email);
    await page.locator(AMAZON_LOGIN_SELECTORS.continueButton).first().click();
    await page.waitForTimeout(2000);
    await this.assertNotRegistrationForm(page, amazonAccountId, closePageOnAbort);

    // Amazon Unified Auth (2026) may insert an intent-confirmation page between
    // the email and password steps. It has no credentials and exactly one
    // visible submit control. Advance only on the known route and only when the
    // control count is exactly one — fail closed if Amazon changes the page.
    if (new URL(page.url()).pathname === '/ax/claim/intent') {
      const intentSubmit = page.locator(AMAZON_LOGIN_SELECTORS.claimIntentContinue);
      const intentSubmitCount = await intentSubmit.count().catch(() => 0);
      if (intentSubmitCount !== 1) {
        await page.close();
        throw new Error(
          `Amazon claim-intent page exposed ${intentSubmitCount} submit controls; expected exactly one`
        );
      }
      await intentSubmit.first().click();
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(2000);
      await this.assertNotRegistrationForm(page, amazonAccountId, closePageOnAbort);
    }

    const passwordInput = page.locator(AMAZON_LOGIN_SELECTORS.passwordInput).first();
    const passwordVisible = await passwordInput
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    if (!passwordVisible) {
      const title = await page.title().catch(() => 'unknown');
      // Query strings can contain long opaque challenge IDs and made the useful
      // DOM diagnostics fall past the UI's truncation boundary. Keep only the
      // origin + path; no credential or claim value is needed to identify flow.
      const url = new URL(page.url());
      const route = `${url.origin}${url.pathname}`;
      // Diagnose only coarse DOM signals and control metadata — never body text
      // or input values, because unified-auth can echo the customer's email.
      const [captcha, accountError, passkey, otp, controls] = await Promise.all([
        page.locator('#captchacharacters, img[src*="captcha"]').first().isVisible().catch(() => false),
        page.locator('#auth-error-message-box, .a-alert-error').first().isVisible().catch(() => false),
        page.locator('[data-testid*="passkey"], button:has-text("passkey")').first().isVisible().catch(() => false),
        page.locator(AMAZON_LOGIN_SELECTORS.mfaInput).first().isVisible().catch(() => false),
        page.locator('input:visible, button:visible').evaluateAll((elements) =>
          elements.slice(0, 12).map((element) => ({
            tag: element.tagName.toLowerCase(),
            id: element.id || null,
            name: element.getAttribute('name'),
            type: element.getAttribute('type'),
            testId: element.getAttribute('data-testid'),
          }))
        ).catch(() => []),
      ]);
      await this.snapLoginFailure(page, amazonAccountId, 'password-step-unavailable');
      if (closePageOnAbort) {
        await page.close();
      }
      throw new Error(
        `Amazon password step unavailable: route=${route}; title=${title}; captcha=${captcha}; accountError=${accountError}; passkey=${passkey}; otp=${otp}; controls=${JSON.stringify(controls)}`
      );
    }
    await this.submitPasswordAndChallenges(
      page,
      password,
      twoFactorSecret,
      amazonAccountId,
      closePageOnAbort
    );
  }

  /**
   * Submit the password and resolve any post-password challenge.
   *
   * Separate from the email step because Amazon serves a password-only "Sign in"
   * screen for a remembered identity — there is no email field to fill, and
   * treating that as a failure blocked orders on a perfectly normal returning-
   * customer screen.
   *
   * TOTP is fully automatic from the encrypted account secret; the worker never
   * has an interactive branch, so an unsupported challenge fails closed.
   */
  private async submitPasswordAndChallenges(
    page: Page,
    password: string,
    twoFactorSecret: string | null,
    amazonAccountId: string,
    closePageOnAbort = true
  ): Promise<void> {
    const passwordInput = page.locator(AMAZON_LOGIN_SELECTORS.passwordInput).first();
    await passwordInput.fill(password);

    // "Keep me signed in" — Amazon leaves this OFF by default, which is why the
    // session kept lapsing and every run paid for a fresh login (and drew more
    // challenges). Checking it materially extends session life. Best-effort: the
    // checkbox is absent on some layouts.
    const keepSignedIn = page.locator(AMAZON_LOGIN_SELECTORS.keepSignedInCheckbox).first();
    if (await keepSignedIn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await keepSignedIn.check().catch(() => undefined);
    }

    await page.locator(AMAZON_LOGIN_SELECTORS.signInButton).first().click();
    await page.waitForTimeout(3000);

    for (let step = 0; step < 4; step++) {
      const authMfa = page.locator(AMAZON_LOGIN_SELECTORS.mfaInput).first();
      if (await authMfa.isVisible({ timeout: 2000 }).catch(() => false)) {
        if (!twoFactorSecret) {
          await page.close();
          throw new Error('Amazon requires 2FA but no secret key is configured for this account');
        }

        const { generateSync } = await import('otplib');
        const totpCode = generateSync({ secret: twoFactorSecret });
        await authMfa.fill(totpCode);
        // Ask Amazon to trust this device so subsequent runs are not challenged
        // again — each OTP round trip is another opportunity for the flow to be
        // interrupted mid-checkout. Best-effort.
        const rememberDevice = page.locator(AMAZON_LOGIN_SELECTORS.mfaRememberDevice).first();
        if (await rememberDevice.isVisible({ timeout: 1000 }).catch(() => false)) {
          await rememberDevice.check().catch(() => undefined);
        }
        await page.locator(AMAZON_LOGIN_SELECTORS.mfaSubmit).first().click();
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => undefined);
        await page.waitForTimeout(2500);
        continue;
      }

      const captchaVisible = await page
        .locator('#captchacharacters, img[src*="captcha"]')
        .first()
        .isVisible()
        .catch(() => false);
      if (captchaVisible) {
        await this.snapLoginFailure(page, amazonAccountId, 'captcha');
        if (closePageOnAbort) {
          await page.close();
        }
        throw new Error('Amazon captcha challenge blocked automated login');
      }

      const loginError = page.locator('#auth-error-message-box .a-alert-content, .a-alert-error .a-alert-content').first();
      if (await loginError.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Do not persist Amazon's raw message: Unified Auth may echo account
        // identifiers. A stable typed message is enough for the account status.
        await this.snapLoginFailure(page, amazonAccountId, 'credentials-rejected');
        if (closePageOnAbort) {
          await page.close();
        }
        await this.browserStateManager.clearState(amazonAccountId);
        throw new Error('Amazon login failed: credentials or challenge rejected');
      }

      break;
    }
  }

  /**
   * Abort if Amazon presented its "Create account" form.
   *
   * DESTRUCTIVE-ACTION GUARD. Amazon shows registration when it does not
   * recognize the email, and its fields overlap the sign-in form enough that a
   * blind password fill lands in the signup flow — observed live, one submit
   * away from creating an unintended Amazon account under the customer's
   * address. Never fill it; fail closed so the operator fixes the credentials.
   *
   * Closes the page so no caller can keep interacting with the signup form.
   */
  private async assertNotRegistrationForm(
    page: Page,
    amazonAccountId: string,
    closePage = true
  ): Promise<void> {
    const onRegistration = await page
      .locator(AMAZON_LOGIN_SELECTORS.registrationForm)
      .first()
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    if (!onRegistration) {
      return;
    }
    await this.snapLoginFailure(page, amazonAccountId, 'create-account-form');
    // The mid-checkout caller owns its page (it snaps evidence and blocks the
    // order), so it opts out of closing.
    if (closePage) {
      await page.close().catch(() => undefined);
    }
    throw new Error(
      'Amazon presented the create-account form: this email is not a recognized Amazon customer. ' +
        'Refusing to continue — an automated signup would create an unintended Amazon account. ' +
        'Verify the buyer account email is registered at amazon.com.'
    );
  }

  /**
   * Resolve an Amazon in-context authentication challenge WITHOUT leaving the
   * page. Used mid-checkout: Amazon interrupts the cart→checkout transition with
   * its own sign-in step, so abandoning the page (full re-login) loses the
   * checkout context and the challenge simply reappears.
   *
   * Returns true when the challenge was resolved and no auth control remains.
   * Never throws for "no challenge present" — the caller checks first.
   */
  async resolveInContextChallenge(
    page: Page,
    userId: string,
    amazonAccountId: string
  ): Promise<boolean> {
    const account = await this.accountsService.getDecrypted(userId, amazonAccountId);

    // The in-context form sometimes starts at the password step (Amazon already
    // knows the identity), so an email field is not guaranteed.
    const emailVisible = await page
      .locator(AMAZON_LOGIN_SELECTORS.emailInput)
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // Same destructive-action guard as the fresh-login path, checked BEFORE any
    // fill: if Amazon is offering registration here, filling the form would
    // create an unintended account. Returning false makes the caller fail closed
    // (it does not close the page — the checkout page must stay owned by the
    // checkout flow, which snaps evidence and blocks the order).
    const onRegistration = await page
      .locator(AMAZON_LOGIN_SELECTORS.registrationForm)
      .first()
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    if (onRegistration) {
      this.logger.error(
        `Amazon offered the create-account form during checkout for account ${amazonAccountId}; refusing to fill it`
      );
      return false;
    }

    if (emailVisible) {
      await this.submitCredentialsOnPage(
        page,
        account.email,
        account.decryptedPassword,
        account.decryptedTwoFactorSecret,
        amazonAccountId,
        false
      );
    } else if (
      await page
        .locator(AMAZON_LOGIN_SELECTORS.passwordInput)
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      await this.submitPasswordAndChallenges(
        page,
        account.decryptedPassword,
        account.decryptedTwoFactorSecret,
        amazonAccountId,
        false
      );
    } else {
      // OTP-only screen: Amazon accepts the existing session but wants a second
      // factor (typical when it re-verifies identity at checkout). Answer it from
      // the stored secret — no customer interaction, per the product contract.
      const authMfa = page.locator(AMAZON_LOGIN_SELECTORS.mfaInput).first();
      if (!(await authMfa.isVisible({ timeout: 2000 }).catch(() => false))) {
        return false;
      }
      if (!account.decryptedTwoFactorSecret) {
        throw new Error('Amazon requires 2FA but no secret key is configured for this account');
      }
      const { generateSync } = await import('otplib');
      await authMfa.fill(generateSync({ secret: account.decryptedTwoFactorSecret }));
      const rememberDevice = page.locator(AMAZON_LOGIN_SELECTORS.mfaRememberDevice).first();
      if (await rememberDevice.isVisible({ timeout: 1000 }).catch(() => false)) {
        await rememberDevice.check().catch(() => undefined);
      }
      await page.locator(AMAZON_LOGIN_SELECTORS.mfaSubmit).first().click();
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(2500);
    }

    // Persist the refreshed session for subsequent runs.
    await this.browserStateManager.saveState(amazonAccountId);

    // Success = no credential/OTP control left on the page.
    const stillChallenged = await page
      .locator(AMAZON_LOGIN_SELECTORS.emailInput)
      .or(page.locator(AMAZON_LOGIN_SELECTORS.passwordInput))
      .or(page.locator(AMAZON_LOGIN_SELECTORS.mfaInput))
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    return !stillChallenged;
  }
}
