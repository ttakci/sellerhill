import { Injectable, Logger } from '@nestjs/common';
import { AmazonAccountStatus, type AmazonScrapedOrderData } from '@repo/shared';
import type { Locator, Page } from 'playwright';

import { AmazonAccountsService } from './amazon-accounts.service';
import { AmazonOrderParserService } from './amazon-order-parser.service';
import { AmazonRateLimiter } from './amazon-rate-limiter.service';
import { BrowserStateManager } from './browser-state-manager.service';

export interface ScrapingProgress {
  stage: 'logging_in' | 'navigating' | 'scraping' | 'saving' | 'done' | 'error';
  message: string;
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
        page = await this.performLogin(amazonAccountId, account.email, account.decryptedPassword, account.decryptedTwoFactorSecret);
      }

      try {
        onProgress?.({ stage: 'navigating', message: 'Navigating to order page...' });

        const orderUrl = `https://www.amazon.com/gp/your-account/order-details/ref=ppx_yo_dt_b_order_details_o00?ie=UTF8&orderID=${amazonOrderId}`;
        await page.goto(orderUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        // Check if order page loaded correctly
        const pageUrl = page.url();
        if (pageUrl.includes('/signin') || pageUrl.includes('/ap/signin')) {
          // Session expired mid-request, re-login
          await page.close();
          await this.browserStateManager.clearState(amazonAccountId);
          page = await this.performLogin(amazonAccountId, account.email, account.decryptedPassword, account.decryptedTwoFactorSecret);
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
      page = await this.performLogin(amazonAccountId, account.email, account.decryptedPassword, account.decryptedTwoFactorSecret);
    }

    try {
      const orderUrl = `https://www.amazon.com/gp/your-account/order-details/ref=ppx_yo_dt_b_order_details_o00?ie=UTF8&orderID=${amazonOrderId}`;
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
          account.decryptedTwoFactorSecret
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
      );
    }

    try {
      // The modernized orders page. `timeFilter` broadens the window; we still
      // filter by exact `since` cutoff in code so the matcher only sees fresh
      // rows. The page itself only paginates so far back — if the user hasn't
      // synced in >1 year, we miss older orders (acceptable: cost-capture is
      // best-effort, controller-mediated for any gap).
      const ordersUrl = 'https://www.amazon.com/your-orders/orders?timeFilter=year-' +
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
    twoFactorSecret: string | null
  ): Promise<import('playwright').Page> {
    const context = await this.browserStateManager.getContext(amazonAccountId);
    const page = await context.newPage();

    await page.goto('https://www.amazon.com/ap/signin', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const emailInput = page.locator('#ap_email');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(email);
    await page.locator('#continue').click();
    await page.waitForTimeout(2000);

    const passwordInput = page.locator('#ap_password');
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await passwordInput.fill(password);
    await page.locator('#signInSubmit').click();
    await page.waitForTimeout(3000);

    // Handle 2FA
    const authMfa = page.locator('#auth-mfa-otpcode');
    if (await authMfa.isVisible({ timeout: 3000 }).catch(() => false)) {
      if (!twoFactorSecret) {
        await page.close();
        throw new Error('Amazon requires 2FA but no secret key is configured for this account');
      }

      const { generateSync } = await import('otplib');
      const totpCode = generateSync({ secret: twoFactorSecret });
      await authMfa.fill(totpCode);
      await page.locator('#auth-signin-button').click();
      await page.waitForTimeout(3000);
    }

    // Check for login errors
    const loginError = page.locator('#auth-error-message-box .a-alert-content');
    if (await loginError.isVisible({ timeout: 2000 }).catch(() => false)) {
      const errorText = await loginError.textContent();
      await page.close();
      await this.browserStateManager.clearState(amazonAccountId);
      throw new Error(`Amazon login failed: ${errorText?.trim() || 'Invalid credentials'}`);
    }

    // Save state after successful login
    await this.browserStateManager.saveState(amazonAccountId);

    return page;
  }
}
