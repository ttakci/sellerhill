import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AutoFulfillStatus } from '@repo/shared';
import type { Page } from 'playwright';

import { DatabaseService } from '../../common/database/database.service';
import { OrderSyncService } from '../orders/order-sync.service';

import { AmazonRateLimiter } from './amazon-rate-limiter.service';
import { AmazonScrapingService } from './amazon-scraping.service';
import { AmazonTrackingQueueService } from './amazon-tracking-queue.service';
import { AutoFulfillBlockedReason, shouldSkipFulfillStart } from './auto-fulfill-helpers';
import { BrowserStateManager } from './browser-state-manager.service';
import { ProxyService } from './proxy.service';

/**
 * Fail-closed obstacle. Thrown by every step helper in this service to signal
 * a deliberate stop (captcha, cap exceeded, out of stock, …). The runner
 * (`runForOrder`) catches this, marks the order `blocked`, and returns WITHOUT
 * rethrowing — BullMQ will NOT retry. Any other error (Playwright crash,
 * network, DB) is rethrown so BullMQ retries the whole job.
 */
export class AutoFulfillBlockedError extends Error {
  constructor(public readonly reason: AutoFulfillBlockedReason, message?: string) {
    super(message ?? reason);
    this.name = 'AutoFulfillBlockedError';
  }
}

/** Result of a successful Place Order click — parsed from the confirmation DOM. */
export interface PlacedResult {
  amazonOrderId: string;
  purchasePrice: number;
  tax: number;
  shipping: number;
}

/** Subset of the orders shipping_address JSONB needed for ship-to selection. */
interface Address {
  fullName?: string;
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
}

// ---------------------------------------------------------------------------
// FRAGILE: Amazon checkout-flow DOM selectors.
//
// Keep ALL selectors in this one block so a DOM change on Amazon's side is a
// one-place patch. Amazon rotates obfuscated class names frequently; the
// data-testid / id attributes below are more stable but not guaranteed. VERIFY
// against a live session during dry-run before relying on output. Each step
// helper throws a typed `AutoFulfillBlockedError` on its specific failure so
// the runner can record a precise `blocked_reason` for the operator.
// ---------------------------------------------------------------------------
const CHECKOUT_SELECTORS = {
  // --- Product page (/dp/ASIN) ---
  unavailableText: [
    '#availability span:has-text("Currently unavailable")',
    '#availability span:has-text("Unavailable")',
    'div[data-feature-name="outOfStock"]',
  ],
  addToCartButton: [
    '#add-to-cart-button',
    'input[name="submit.add-to-cart"]',
    '[data-testid="add-to-cart-button"]',
  ],
  buyNowButton: '#buy-now-button',
  quantitySelect: '#quantity, #selectQuantity select, select[name="quantity"]',

  // "Added to Cart" / Cart page interstitials
  goToCartLink: [
    'a:has-text("Go to Cart")',
    'a[href*="/gp/cart/view.html"]',
    '#sw-gtc a',
  ],

  // --- Checkout flow entrance ---
  proceedToCheckoutButton: [
    'input[name="proceedToRetailCheckout"]',
    'a:has-text("Proceed to checkout")',
    '[data-testid="proceed-to-checkout-button"]',
    '#sc-proceed-to-checkout-squeeze-box-content > div > div > a',
  ],

  // --- MFA / captcha friction during checkout auth ---
  mfaOtpInput: '#auth-mfa-otpcode',
  captchaInput: '#captchacharacters',
  captchaImage: 'img[src*="captcha"]',

  // --- Ship-to address selection ---
  // Amazon's address list is a radio group on the "Choose your shipping
  // address" page. Each address is a `[data-address-id="…"]` block.
  addressRadio: [
    'input[name="shipmentAddressRadioGroup"]',
    'input[type="radio"][name*="address"]',
  ],
  addressBlock: '[data-address-id], .address-block, div.address-row',
  addNewAddressLink: [
    'a:has-text("Add an address")',
    'a[data-test-id="add-new-address"]',
    'a[id*="add-new-address"]',
  ],
  addressFormContinueButton: [
    'input[name="ship-address"]',
    'button:has-text("Ship to this address")',
    '#enterAddressSubmit',
  ],
  useSelectedAddressButton: [
    'input[name="useSelectedAddress"]',
    'a:has-text("Use this address")',
    '[data-testid="use-this-address"]',
  ],

  // --- Payment selection ---
  // Default payment radio (already-added credit card).
  useSelectedPaymentButton: [
    'input[name="ppw-widgetEvent:ExecutePaymentMethodSelection"]',
    'a:has-text("Use this payment method")',
    '[data-testid="use-this-payment-method"]',
  ],
  // Decline / payment-error friction text after selecting a card.
  paymentDeclineText: [
    '#payErrorBox:has-text("declined")',
    '#payErrorBox:has-text("invalid")',
    'div.a-alert-content:has-text("payment method could not be charged")',
  ],

  // --- Review step (the HARD-CAP checkpoint) ---
  reviewGrandTotal: [
    '#subtotals-marketplace-table td.grand-total',
    '#rev-summary td:has-text("Grand Total") + td',
    'span:has-text("Grand Total:")',
    '#order-summary td[data-testid="grand-total"]',
    'div[data-testid="grand-total-amount"]',
  ],
  placeYourOrderButton: [
    'input[name="placeYourOrder1"]',
    'input[name="submit.place-order"]',
    'button:has-text("Place your order")',
    '[data-testid="place-your-order-button"]',
  ],

  // --- Confirmation page (after successful Place Order) ---
  confirmationOrderId: [
    '[data-testid="order-id"]',
    '.confirmation-id',
    'a[href*="orderID="]',
  ],
  confirmationSummary: '#order-summary, .order-summary, [data-testid="order-summary"]',

  // Generic Amazon signin-redirect URL fragments.
  signinUrlFragments: ['/signin', '/ap/signin'],
} as const;

/**
 * Step-structured Playwright checkout flow for A2 Automated Amazon Fulfillment.
 *
 * Lifecycle (runForOrder):
 * 1. Idempotency re-check: re-read `auto_fulfill_status` on start; if the
 *    order is already in a terminal state (placed / blocked / dry_run /
 *    skipped), no-op. This is what prevents a BullMQ retry from double-ordering.
 * 2. Set `running` and run `checkout()` under the per-account rate limiter
 *    (1-concurrent SingletonLock invariant + ban-risk throttle).
 * 3. On `AutoFulfillBlockedError` → mark `blocked` and return WITHOUT throwing
 *    (deliberate stop, no retry). On any other error → rethrow so BullMQ
 *    retries (transport / infra failure).
 *
 * Money only leaves after the review-step HARD CAP passes AND the Place Order
 * button is clicked once. Blocked/dry_run paths never reach the click.
 */
@Injectable()
export class AmazonCheckoutService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AmazonCheckoutService.name);
  /**
   * Min inter-action delay — human-like pacing, also slows the whole flow.
   * Clamped to [1000, 60000] ms so a typo'd env value cannot stall the
   * concurrency-1 worker (R9 — the worker is single-threaded across orders).
   */
  private readonly minTimeMs = clampInt(
    process.env.AUTO_FULFILL_CHECKOUT_MIN_TIME_MS,
    4500,
    1000,
    60_000,
  );
  /** Hard cap can be disabled per-env (emergencies). Defaults ON. */
  private readonly hardStop = process.env.AUTO_FULFILL_REVIEW_CAP_HARD_STOP !== 'false';
  private readonly evidenceDir =
    process.env.FULFILLMENT_EVIDENCE_DIR || path.join(process.cwd(), 'fulfillment-evidence');
  /** Evidence PNG retention; per-order dirs older than this are swept. */
  private readonly evidenceTtlDays = clampInt(
    process.env.FULFILLMENT_EVIDENCE_TTL_DAYS,
    7,
    1,
    365,
  );
  /** How often the evidence-TTL sweep runs (ms). Default: hourly. */
  private readonly evidenceSweepIntervalMs = 60 * 60 * 1000;
  private evidenceSweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly scraping: AmazonScrapingService,
    private readonly rateLimiter: AmazonRateLimiter,
    private readonly browserState: BrowserStateManager,
    private readonly orderSync: OrderSyncService,
    private readonly trackingQueue: AmazonTrackingQueueService,
    private readonly proxyService: ProxyService,
  ) {}

  onModuleInit(): void {
    // Evidence screenshots accumulate (one per blocked stage per order). Sweep
    // per-order dirs older than the TTL so `fulfillment-evidence/` cannot fill
    // the disk. Best-effort — failures are logged, never thrown.
    this.evidenceSweepTimer = setInterval(() => {
      void this.sweepEvidence();
    }, this.evidenceSweepIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.evidenceSweepTimer) {
      clearInterval(this.evidenceSweepTimer);
      this.evidenceSweepTimer = null;
    }
  }

  /**
   * Entry point for the auto-fulfill BullMQ processor (Task 8 wires the queue).
   *
   * Money-leak safety: the idempotency re-check at the top is what makes a
   * BullMQ retry safe — if a previous attempt already PLACED/BLOCKED/DRY_RUN,
   * we no-op regardless of how the retry was scheduled.
   */
  async runForOrder(ebayOrderId: string, amazonAccountId: string): Promise<void> {
    // Idempotency: never double-order on BullMQ retry.
    const [order] = await this.db.query<{ auto_fulfill_status: AutoFulfillStatus }>(
      `SELECT auto_fulfill_status FROM orders WHERE ebay_order_id = $1`,
      [ebayOrderId],
    );
    if (!order || shouldSkipFulfillStart(order.auto_fulfill_status)) {
      this.logger.log(`skip fulfill ${ebayOrderId}: status ${order?.auto_fulfill_status}`);
      return;
    }
    // R1 — runtime proxy guard (defense-in-depth). `assertCanEnable` checks at
    // enable time, but an operator can remove the proxy env afterwards. Auto-
    // fulfill MUST NOT run over the bare server IP (ban + money risk); fail
    // closed here before any browser action. Existing scraping still falls back
    // to direct (no regression) — only checkout is hard-blocked.
    if (!this.proxyService.isConfigured()) {
      await this.block(
        ebayOrderId,
        'proxy_required',
        'no residential proxy configured — auto-fulfill hard-blocked',
      );
      return;
    }
    await this.setStatus(ebayOrderId, AutoFulfillStatus.RUNNING);

    try {
      await this.rateLimiter.schedule(amazonAccountId, () =>
        this.checkout(ebayOrderId, amazonAccountId),
      );
    } catch (err) {
      if (err instanceof AutoFulfillBlockedError) {
        await this.block(ebayOrderId, err.reason, err.message);
        return; // deliberate stop — do NOT throw (no BullMQ retry)
      }
      // transport/infra — let BullMQ retry; processor marks `failed` on exhaustion.
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // checkout() — step-structured flow. Each step can throw a typed
  // `AutoFulfillBlockedError` to abort fail-closed. Runs entirely under the
  // per-account rate limiter (see runForOrder).
  // -------------------------------------------------------------------------
  private async checkout(ebayOrderId: string, amazonAccountId: string): Promise<void> {
    const { userId, asin, quantity, ship, capTotal, dryRun } = await this.loadInputs(
      ebayOrderId,
      amazonAccountId,
    );
    if (!asin) {throw new AutoFulfillBlockedError('no_asin');}

    // Step 1: session/login (reuse scraping's login incl. 2FA-TOTP). The page
    // returned is authenticated and lives in the proxy-aware persistent
    // context for the account — all subsequent steps reuse it.
    const page = await this.ensureLoggedIn(amazonAccountId, userId);
    try {
      await this.humanDelay();

      // Step 2: product page + add to cart
      await page.goto(`https://www.amazon.com/dp/${asin}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await this.humanDelay();
      if (await this.isUnavailable(page)) {
        await this.snap(page, ebayOrderId, 'unavailable');
        throw new AutoFulfillBlockedError('out_of_stock');
      }
      await this.setQuantityAndAddToCart(page, quantity);

      // Step 3: proceed to checkout + address
      await this.humanDelay();
      await this.clickFirstAvailable(page, CHECKOUT_SELECTORS.goToCartLink, 'go-to-cart');
      await this.humanDelay();
      await this.clickFirstAvailable(
        page,
        CHECKOUT_SELECTORS.proceedToCheckoutButton,
        'proceed-to-checkout',
      );
      await this.detectCaptchaOrOtp(page); // throws 'captcha' | 'otp'
      await this.selectShipToAddress(page, ship); // throws 'address' on friction

      // Step 4: payment
      await this.humanDelay();
      await this.selectDefaultPayment(page); // throws 'payment' on decline signals

      // Step 5: review-step HARD CAP — read total, abort if over cap (no click).
      await this.humanDelay();
      const grandTotal = await this.readReviewGrandTotal(page);
      if (!Number.isFinite(grandTotal) || grandTotal <= 0) {
        await this.snap(page, ebayOrderId, 'review-total-missing');
        throw new AutoFulfillBlockedError(
          'cap',
          `unparseable review grandTotal (${grandTotal}); refusing to proceed without cap check`,
        );
      }
      if (this.hardStop && capTotal !== Number.POSITIVE_INFINITY && grandTotal > capTotal) {
        await this.snap(page, ebayOrderId, 'cap');
        throw new AutoFulfillBlockedError(
          'cap',
          `grandTotal ${grandTotal.toFixed(2)} > cap ${capTotal.toFixed(2)}`,
        );
      }

      // Step 6: place order OR dry-run.
      // Dry-run MUST stop before any place-order click — no money leaves.
      if (dryRun) {
        await this.snap(page, ebayOrderId, 'dry_run_review');
        await this.setStatus(ebayOrderId, AutoFulfillStatus.DRY_RUN);
        this.logger.log(
          `dry-run stop ${ebayOrderId}: grandTotal=${grandTotal.toFixed(2)} cap=${capTotal === Number.POSITIVE_INFINITY ? 'inf' : capTotal.toFixed(2)}`,
        );
        return;
      }

      await this.humanDelay();
      // I-2 (money-safety): if clickFirstAvailable / waitForLoadState throw
      // AFTER the browser already received the click event (navigation-
      // intercepted / element-detached race), rethrow → BullMQ retry →
      // idempotency sees RUNNING → checkout() re-enters → a SECOND Place Order
      // click on the live session = double-order. Swallow the click+wait error
      // (log at warn) and unconditionally fall through to parseConfirmation,
      // which either proves the order (→ PLACED) or throws 'no_confirmation'
      // (→ blocked, no retry). Any click-transport error becomes a fail-closed
      // block instead of a retriable propagation.
      try {
        await this.clickFirstAvailable(
          page,
          CHECKOUT_SELECTORS.placeYourOrderButton,
          'place-your-order',
        );
      } catch (err) {
        this.logger.warn(
          `place-order click threw; falling through to confirmation parse: ${(err as Error).message}`,
        );
      }
      await page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => undefined);
      const placed = await this.parseConfirmation(page); // throws 'no_confirmation'
      await this.onPlaced(ebayOrderId, amazonAccountId, placed);
      await this.setStatus(ebayOrderId, AutoFulfillStatus.PLACED);
      this.logger.log(
        `placed ${ebayOrderId}: amazon=${placed.amazonOrderId} total=${(
          placed.purchasePrice +
          placed.tax +
          placed.shipping
        ).toFixed(2)}`,
      );
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  // -------------------------------------------------------------------------
  // Step helpers — adapt selectors to live Amazon DOM during dry-run tuning.
  // Each throws a typed AutoFulfillBlockedError on its specific failure.
  // -------------------------------------------------------------------------

  /**
   * Step 1: open an authenticated page. Delegates to
   * `AmazonScrapingService.ensureAuthenticatedPage` (session reuse + login incl
   * 2FA — single login code path). Translates scraping's generic login errors
   * into the appropriate typed blocked reason (captcha / otp / login).
   */
  private async ensureLoggedIn(accountId: string, userId: string): Promise<Page> {
    try {
      const page = await this.scraping.ensureAuthenticatedPage(userId, accountId);
      // Even after a successful session reuse, a soft captcha / OTP can appear
      // on the first navigation. Probe once before handing the page off.
      await page
        .goto('https://www.amazon.com/gp/css/homepage.html', {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        })
        .catch(() => undefined);
      await this.detectCaptchaOrOtp(page);
      return page;
    } catch (err) {
      if (err instanceof AutoFulfillBlockedError) {throw err;}
      const msg = err instanceof Error ? err.message : String(err);
      if (/2FA|otp|mfa/i.test(msg)) {throw new AutoFulfillBlockedError('otp', msg);}
      if (/captcha/i.test(msg)) {throw new AutoFulfillBlockedError('captcha', msg);}
      if (/login failed|Invalid credentials/i.test(msg)) {
        throw new AutoFulfillBlockedError('login', msg);
      }
      throw new AutoFulfillBlockedError('login', msg);
    }
  }

  /** Step 2a: detect "Currently unavailable" or missing Add to Cart. */
  private async isUnavailable(page: Page): Promise<boolean> {
    for (const sel of CHECKOUT_SELECTORS.unavailableText) {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 500 }).catch(() => false)) {
        return true;
      }
    }
    // No add-to-cart button AND no buy-now = not purchasable right now.
    const addVisible = await page
      .locator(CHECKOUT_SELECTORS.addToCartButton.join(', '))
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    const buyVisible = await page
      .locator(CHECKOUT_SELECTORS.buyNowButton)
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);
    return !addVisible && !buyVisible;
  }

  /** Step 2b: set quantity on product page, click Add to Cart. */
  private async setQuantityAndAddToCart(page: Page, qty: number): Promise<void> {
    if (qty > 1) {
      const qtySelect = page.locator(CHECKOUT_SELECTORS.quantitySelect).first();
      if (await qtySelect.isVisible({ timeout: 1500 }).catch(() => false)) {
        // Try exact value, fall back to highest available.
        const opts = await qtySelect.locator('option').count().catch(() => 0);
        if (opts >= qty) {
          await qtySelect.selectOption(String(qty)).catch(() => undefined);
        } else if (opts > 0) {
          await qtySelect.selectOption({ index: opts }).catch(() => undefined);
        }
      }
    }
    const addBtn = page.locator(CHECKOUT_SELECTORS.addToCartButton.join(', ')).first();
    if (!(await addBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
      throw new AutoFulfillBlockedError('out_of_stock', 'no visible Add to Cart button');
    }
    await addBtn.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined);
  }

  /**
   * Step 3a: detect MFA / captcha on the checkout auth surface. Both block
   * checkout fail-closed: a robot cannot solve them, and forcing-through would
   * lock the account. Throws typed reasons for the operator.
   */
  private async detectCaptchaOrOtp(page: Page): Promise<void> {
    const otp = page.locator(CHECKOUT_SELECTORS.mfaOtpInput).first();
    if (await otp.isVisible({ timeout: 1000 }).catch(() => false)) {
      throw new AutoFulfillBlockedError(
        'otp',
        'Amazon prompted for MFA OTP code mid-checkout (session expired)',
      );
    }
    const captcha = page.locator(CHECKOUT_SELECTORS.captchaInput).first();
    if (await captcha.isVisible({ timeout: 1000 }).catch(() => false)) {
      throw new AutoFulfillBlockedError('captcha', 'Amazon captcha page presented');
    }
  }

  /**
   * Step 3b: select the buyer's ship-to address. Amazon's address book is a
   * radio group; we match by full-name + zip when possible (most stable across
   * layouts), fall back to the default-highlighted address, and finally to
   * "Add an address" when nothing matches (the form path is then exercised).
   *
   * Throws `'address'` on any validation friction — Amazon's "address could
   * not be verified" interstitial is a hard stop because guessing leads to
   * mis-shipped orders.
   */
  private async selectShipToAddress(page: Page, ship: Address): Promise<void> {
    const anyRadio = page.locator(CHECKOUT_SELECTORS.addressRadio.join(', '));
    const radioCount = await anyRadio.count().catch(() => 0);

    if (radioCount > 0) {
      let matched = false;
      if (ship.fullName || ship.zipCode) {
        const blocks = page.locator(CHECKOUT_SELECTORS.addressBlock);
        const blockCount = await blocks.count().catch(() => 0);
        for (let i = 0; i < blockCount; i++) {
          const blk = blocks.nth(i);
          const text = ((await blk.textContent().catch(() => '')) ?? '');
          const nameOk = !ship.fullName || text.includes(ship.fullName);
          const zipOk = !ship.zipCode || text.includes(ship.zipCode);
          if (nameOk && zipOk) {
            const radio = blk.locator('input[type="radio"]').first();
            if (await radio.isVisible({ timeout: 500 }).catch(() => false)) {
              await radio.check();
              matched = true;
              break;
            }
          }
        }
      }
      if (!matched) {
        // Use whatever Amazon pre-selected (default address) — best effort.
        this.logger.debug('no exact address match; using Amazon default');
      }
    } else if (ship.street) {
      // No existing addresses on account — add one. This is the riskier path.
      const addLink = page
        .locator(CHECKOUT_SELECTORS.addNewAddressLink.join(', '))
        .first();
      if (await addLink.isVisible({ timeout: 1500 }).catch(() => false)) {
        await addLink.click();
        await page
          .waitForLoadState('domcontentloaded', { timeout: 10_000 })
          .catch(() => undefined);
        try {
          await page
            .locator('#address-ui-widgets-enterAddressFullName')
            .first()
            .fill(ship.fullName ?? '');
          await page
            .locator('#address-ui-widgets-enterAddressLine1')
            .first()
            .fill(ship.street ?? '');
          if (ship.street2) {
            await page.locator('#address-ui-widgets-enterAddressLine2').first().fill(ship.street2);
          }
          await page
            .locator('#address-ui-widgets-enterAddressCity')
            .first()
            .fill(ship.city ?? '');
          await page
            .locator('#address-ui-widgets-enterAddressStateOrRegion')
            .first()
            .fill(ship.state ?? '');
          await page
            .locator('#address-ui-widgets-enterAddressPostalCode')
            .first()
            .fill(ship.zipCode ?? '');
          if (ship.phone) {
            await page
              .locator('#address-ui-widgets-enterAddressPhoneNumber')
              .first()
              .fill(ship.phone);
          }
          const submit = page
            .locator(CHECKOUT_SELECTORS.addressFormContinueButton.join(', '))
            .first();
          await submit.click();
          await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new AutoFulfillBlockedError('address', `add-address form failed: ${msg}`);
        }
        const validationErr = page
          .locator(
            'div.a-alert-content:has-text("could not be verified"), div.a-alert-content:has-text("not valid")',
          )
          .first();
        if (await validationErr.isVisible({ timeout: 1500 }).catch(() => false)) {
          const txt = ((await validationErr.textContent()) ?? '').trim().slice(0, 200);
          throw new AutoFulfillBlockedError('address', `validation: ${txt}`);
        }
      }
    }

    // If a "use this address" / continue button is present, click it.
    const useBtn = page
      .locator(CHECKOUT_SELECTORS.useSelectedAddressButton.join(', '))
      .first();
    if (await useBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await useBtn.click();
      await page
        .waitForLoadState('domcontentloaded', { timeout: 15_000 })
        .catch(() => undefined);
      // Post-submit we may bounce back to the same page on a validation issue.
      const stillOnAddressPage =
        (page.url().includes('address') || page.url().includes('selectaddress')) &&
        (await page
          .locator(CHECKOUT_SELECTORS.useSelectedAddressButton.join(', '))
          .first()
          .isVisible({ timeout: 500 })
          .catch(() => false));
      if (stillOnAddressPage) {
        throw new AutoFulfillBlockedError(
          'address',
          'address selection did not advance (Amazon re-presented the page)',
        );
      }
    }
  }

  /**
   * Step 4: select the account's default payment method and confirm. Throws
   * `'payment'` on any decline-signal text Amazon surfaces post-selection.
   */
  private async selectDefaultPayment(page: Page): Promise<void> {
    // Amazon pre-selects the default instrument on the review page. Click the
    // "Use this payment method" button only if it is present; otherwise the
    // page is already past payment selection (modern single-page checkout).
    const useBtn = page
      .locator(CHECKOUT_SELECTORS.useSelectedPaymentButton.join(', '))
      .first();
    if (await useBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await useBtn.click();
      await page
        .waitForLoadState('domcontentloaded', { timeout: 15_000 })
        .catch(() => undefined);
    }

    // Decline-signal detection — any visible "declined" / "invalid" text on a
    // payment-related alert is a hard stop (the robot cannot retry a card).
    for (const sel of CHECKOUT_SELECTORS.paymentDeclineText) {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 1000 }).catch(() => false)) {
        const txt = ((await loc.textContent().catch(() => '')) ?? '').trim().slice(0, 200);
        throw new AutoFulfillBlockedError('payment', `decline signal: ${txt}`);
      }
    }
  }

  /**
   * Step 5: read the review-page grand total. This is the figure compared
   * against the hard cap. Throws nothing on its own — the caller checks
   * finite/positive and the cap. Returning NaN lets the caller treat
   * unparseable totals as a block (rather than a silent $0).
   */
  private async readReviewGrandTotal(page: Page): Promise<number> {
    for (const sel of CHECKOUT_SELECTORS.reviewGrandTotal) {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 2500 }).catch(() => false)) {
        const txt = ((await loc.textContent().catch(() => '')) ?? '');
        // First currency-looking token in the cell.
        const m = txt.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
        if (m) {
          const n = parseFloat(m[1].replace(/,/g, ''));
          if (Number.isFinite(n) && n > 0) {return n;}
        }
      }
    }
    return Number.NaN;
  }

  /**
   * Step 6 (post-click): parse the confirmation page. Throws
   * `'no_confirmation'` if no Amazon order id can be extracted — this is the
   * worst-case signal: we may have placed an order but cannot prove it. The
   * operator must inspect the evidence screenshots and the account's order
   * history manually.
   */
  private async parseConfirmation(page: Page): Promise<PlacedResult> {
    await this.humanDelay();
    let amazonOrderId = '';
    for (const sel of CHECKOUT_SELECTORS.confirmationOrderId) {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 3000 }).catch(() => false)) {
        const href = await loc.getAttribute('href').catch(() => null);
        if (href) {
          const m = href.match(/orderID=([0-9A-Z-]+)/i);
          if (m) {
            amazonOrderId = m[1];
            break;
          }
        }
        const txt = ((await loc.textContent().catch(() => '')) ?? '');
        const m = txt.match(/(\d{3}-\d{7}-\d{7})/);
        if (m) {
          amazonOrderId = m[1];
          break;
        }
      }
    }
    if (!amazonOrderId) {
      throw new AutoFulfillBlockedError(
        'no_confirmation',
        'confirmation page did not expose an Amazon order id',
      );
    }

    // Best-effort cost parse from the confirmation summary block. Missing
    // values default to 0 — the trusted value is the amazonOrderId; Task 7's
    // post-purchase link re-scrapes the order detail page for canonical costs.
    let purchasePrice = 0;
    let tax = 0;
    let shipping = 0;
    const summary = page.locator(CHECKOUT_SELECTORS.confirmationSummary).first();
    if (await summary.isVisible({ timeout: 1500 }).catch(() => false)) {
      const txt = ((await summary.textContent().catch(() => '')) ?? '');
      const grab = (pattern: RegExp): number => {
        const m = txt.match(pattern);
        if (!m?.[1]) {return 0;}
        return parseFloat(m[1].replace(/,/g, '')) || 0;
      };
      purchasePrice =
        grab(/subtotal[:\s]*\$?([\d,]+\.?\d*)/i) ||
        grab(/items[:\s]*\$?([\d,]+\.?\d*)/i) ||
        grab(/merchandise[:\s]*\$?([\d,]+\.?\d*)/i);
      tax =
        grab(/tax[:\s]*\$?([\d,]+\.?\d*)/i) ||
        grab(/estimated tax[:\s]*\$?([\d,]+\.?\d*)/i);
      shipping =
        grab(/shipping[:\s]*\$?([\d,]+\.?\d*)/i) ||
        grab(/postage[:\s]*\$?([\d,]+\.?\d*)/i);
    }

    return { amazonOrderId, purchasePrice, tax, shipping };
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  /**
   * Click the first matching selector in a list. Does NOT throw on miss —
   * many Amazon flow steps are skippable depending on layout, and a wrong
   * block here would prevent legitimate orders. Downstream steps throw their
   * own typed reason if the flow genuinely cannot continue.
   */
  private async clickFirstAvailable(
    page: Page,
    selectors: readonly string[],
    label: string,
  ): Promise<void> {
    for (const sel of selectors) {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loc.click();
        await page
          .waitForLoadState('domcontentloaded', { timeout: 15_000 })
          .catch(() => undefined);
        return;
      }
    }
    this.logger.debug(`clickFirstAvailable: no visible selector for ${label}`);
  }

  /** Human-like inter-action delay with bounded jitter. */
  private async humanDelay(): Promise<void> {
    const base = this.minTimeMs;
    const jitter = Math.floor(Math.random() * 800);
    await new Promise((r) => setTimeout(r, base + jitter));
  }

  /** Capture a full-page screenshot as audit evidence under fulfillment-evidence/<ebayOrderId>/. */
  private async snap(page: Page, ebayOrderId: string, stage: string): Promise<void> {
    try {
      const dir = path.join(this.evidenceDir, ebayOrderId);
      await fs.mkdir(dir, { recursive: true });
      await page.screenshot({
        path: path.join(dir, `${stage}-${Date.now()}.png`),
        fullPage: true,
      });
    } catch (err) {
      // Evidence capture must NEVER fail the flow — log and continue.
      this.logger.warn(
        `evidence snap failed for ${ebayOrderId}/${stage}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Periodic best-effort sweep of `fulfillment-evidence/<ebayOrderId>/` dirs.
   * Removes any per-order dir whose newest file is older than
   * `FULFILLMENT_EVIDENCE_TTL_DAYS`. Never throws — disk cleanup is ops, not
   * correctness. `fulfillment-evidence/` is admin-only (filesystem perms) and
   * not backed up; see CLAUDE.md "Backups & monitoring".
   */
  private async sweepEvidence(): Promise<void> {
    let root: string[];
    try {
      root = await fs.readdir(this.evidenceDir);
    } catch {
      // Dir doesn't exist yet (no blocked/dry-run orders) — nothing to sweep.
      return;
    }
    const ttlMs = this.evidenceTtlDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const entry of root) {
      const dir = path.join(this.evidenceDir, entry);
      try {
        const stat = await fs.stat(dir);
        if (!stat.isDirectory()) {
          continue;
        }
        // Use the directory's mtime as the "last touched" proxy. Screenshots
        // are written into the dir, which updates mtime on most filesystems.
        if (now - stat.mtimeMs > ttlMs) {
          await fs.rm(dir, { recursive: true, force: true });
          this.logger.log(`swept evidence dir ${entry} (older than ${this.evidenceTtlDays}d)`);
        }
      } catch (err) {
        this.logger.warn(
          `evidence sweep skipped ${entry}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Load everything the checkout flow needs from the DB in one query. Joins
   * amazon_accounts for the per-account cap + dry-run flag and resolves the
   * ASIN via listings → products. Throws `no_asin` if no row at all (order
   * missing or account mismatch).
   */
  private async loadInputs(
    ebayOrderId: string,
    accountId: string,
  ): Promise<{
    userId: string;
    asin: string | null;
    quantity: number;
    ship: Address;
    capTotal: number;
    dryRun: boolean;
  }> {
    const [row] = await this.db.query<{
      user_id: string;
      asin: string | null;
      quantity: number;
      shipping_address: unknown;
      auto_fulfill_cap_total: string | number | null;
      auto_fulfill_dry_run: boolean;
    }>(
      `SELECT o.user_id, p.asin, o.quantity, o.shipping_address,
              a.auto_fulfill_cap_total, a.auto_fulfill_dry_run
         FROM orders o
         LEFT JOIN listings l ON l.id = o.listing_id
         LEFT JOIN products p ON p.id = l.product_id
         JOIN amazon_accounts a ON a.id = $2 AND a.user_id = o.user_id
        WHERE o.ebay_order_id = $1`,
      [ebayOrderId, accountId],
    );
    if (!row) {throw new AutoFulfillBlockedError('no_asin');}

    const rawCap = row.auto_fulfill_cap_total;
    // Fail-closed on unparseable cap: Number('xyz') is NaN, and NaN comparisons
    // are always false → the cap check would silently never fire (fail-open on
    // the money path). Throw at the source so no caller ever sees a NaN cap.
    // null is the legitimate "no cap configured" signal → Infinity backstop
    // (the producer already skips null-cap accounts; this is defence-in-depth).
    if (rawCap !== null && !Number.isFinite(Number(rawCap))) {
      throw new AutoFulfillBlockedError(
        'cap',
        `unparseable auto_fulfill_cap_total: ${rawCap}`,
      );
    }
    const capTotal = rawCap === null ? Number.POSITIVE_INFINITY : Number(rawCap);
    return {
      userId: row.user_id,
      asin: row.asin,
      quantity: row.quantity ?? 1,
      ship: (row.shipping_address as Address) ?? ({} as Address),
      capTotal,
      dryRun: !!row.auto_fulfill_dry_run,
    };
  }

  /**
   * Post-purchase DB write + profit recompute + tracking kickoff.
   *
   * MONEY-SAFETY HARD CONTRACT (I-3): this method MUST be fail-soft. After a
   * confirmed placement (parseConfirmation proved an Amazon order id), NO path
   * may propagate a non-blocked error — a thrown error → BullMQ retry →
   * `runForOrder` idempotency re-check sees `RUNNING` (not PLACED) → checkout()
   * re-enters → a SECOND Place Order click on the live session = double-order.
   *
   * Layering (every layer is wrapped to NEVER throw):
   *   1. Atomic UPDATE writing real costs + `amazon_order_id` +
   *      `cost_capture_status='linked'` + `auto_fulfill_status='placed'`.
   *      Including `auto_fulfill_status='placed'` in THIS update means the
   *      order is terminal the instant the write commits.
   *   2. On Layer 1 failure: minimal fallback UPDATE setting just
   *      `amazon_order_id` + `auto_fulfill_status='placed'` (+ attempted_at)
   *      so the order is marked PLACED and will NOT be re-clicked even if the
   *      costs write failed. The tracker + cost-capture paths can reconcile
   *      costs later from the amazon_order_id.
   *   3. `recomputeProfit` (A1 single-writer → trusted net_profit) in its own
   *      best-effort try/catch.
   *   4. `scheduleOrderTracking` (existing tracker keys off amazon_order_id)
   *      in its own best-effort try/catch.
   *
   * Only if even Layer 2 throws do we log a critical error — but still DO NOT
   * rethrow. The operator will see the row stuck at RUNNING + can investigate;
   * that's better than a guaranteed double-order from a re-click.
   */
  private async onPlaced(
    ebayOrderId: string,
    amazonAccountId: string,
    placed: PlacedResult,
  ): Promise<void> {
    let orderId: string | null = null;

    // Layer 1: atomic UPDATE — real costs + amazon_order_id + linked + placed.
    try {
      const rows = await this.db.query<{ id: string }>(
        `UPDATE orders SET
           amazon_account_id          = $1,
           amazon_order_id            = $2,
           purchase_price             = $3,
           amazon_tax                 = $4,
           amazon_shipping            = $5,
           amazon_linked_at           = CURRENT_TIMESTAMP,
           cost_capture_status        = 'linked',
           auto_fulfill_status        = 'placed',
           auto_fulfill_attempted_at  = CURRENT_TIMESTAMP,
           updated_at                 = CURRENT_TIMESTAMP
         WHERE ebay_order_id = $6
         RETURNING id`,
        [
          amazonAccountId,
          placed.amazonOrderId,
          placed.purchasePrice,
          placed.tax,
          placed.shipping,
          ebayOrderId,
        ],
      );
      orderId = rows[0]?.id ?? null;
    } catch (err) {
      // Layer 2: minimal fallback — mark PLACED so a retry cannot re-click.
      this.logger.error(
        `onPlaced primary UPDATE failed for ${ebayOrderId}; attempting minimal PLACED fallback: ${(err as Error).message}`,
        (err as Error).stack,
      );
      try {
        const rows = await this.db.query<{ id: string }>(
          `UPDATE orders SET
             amazon_order_id           = $1,
             auto_fulfill_status       = 'placed',
             auto_fulfill_attempted_at = CURRENT_TIMESTAMP,
             updated_at                = CURRENT_TIMESTAMP
           WHERE ebay_order_id = $2
           RETURNING id`,
          [placed.amazonOrderId, ebayOrderId],
        );
        orderId = rows[0]?.id ?? null;
      } catch (fallbackErr) {
        // Worst case: even the minimal fallback threw. DO NOT rethrow —
        // surface as critical log; operator sees the row stuck at RUNNING.
        this.logger.error(
          `onPlaced minimal fallback ALSO failed for ${ebayOrderId} — row stuck at RUNNING, manual investigation required (costs/tracking will not auto-reconcile): ${(fallbackErr as Error).message}`,
          (fallbackErr as Error).stack,
        );
      }
    }

    // Layer 3 (best-effort): A1 trusted net_profit recompute. Costs are
    // already on the row; this just computes + persists net_profit. Owns its
    // own try/catch so it can never propagate to runForOrder's catch.
    try {
      await this.orderSync.recomputeProfit(ebayOrderId);
    } catch (err) {
      this.logger.error(
        `onPlaced recomputeProfit failed for ${ebayOrderId} (costs already written; recompute can be re-run): ${(err as Error).message}`,
        (err as Error).stack,
      );
    }

    // Layer 4 (best-effort): Amazon tracking scheduler kickoff — the existing
    // tracker polls Amazon status (shipped→eBay shipped, delivered→completed).
    // Keys off order.id (UUID), not ebay_order_id. Owns its own try/catch.
    try {
      const id = orderId ?? (await this.orderIdFor(ebayOrderId));
      if (id) {
        await this.trackingQueue.scheduleOrderTracking(id, amazonAccountId);
      } else {
        this.logger.warn(
          `onPlaced could not resolve order id for ${ebayOrderId} — tracking scheduler skipped (reconcile manually)`,
        );
      }
    } catch (err) {
      this.logger.error(
        `onPlaced scheduleOrderTracking failed for ${ebayOrderId} (tracking can be reconciled later via reconcileSchedulers): ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  /**
   * Resolve the internal order UUID from the eBay order id. Used by onPlaced
   * to key the Amazon tracking scheduler (which keys off `order.id`, not
   * `ebay_order_id`). Returns null if the order is gone (shouldn't happen
   * mid-onPlaced, but defensive — caller skips the tracking kickoff).
   */
  private async orderIdFor(ebayOrderId: string): Promise<string | null> {
    const [row] = await this.db.query<{ id: string }>(
      `SELECT id FROM orders WHERE ebay_order_id = $1`,
      [ebayOrderId],
    );
    return row?.id ?? null;
  }

  /** Update auto_fulfill status + attempted_at. Optional blocked_reason. */
  private async setStatus(
    ebayOrderId: string,
    status: AutoFulfillStatus,
    reason?: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE orders SET auto_fulfill_status = $1,
          auto_fulfill_blocked_reason = COALESCE($2, auto_fulfill_blocked_reason),
          auto_fulfill_attempted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE ebay_order_id = $3`,
      [status, reason ?? null, ebayOrderId],
    );
  }

  /** Mark an order blocked. Deliberate stop — caller returns, no rethrow. */
  private async block(
    ebayOrderId: string,
    reason: AutoFulfillBlockedReason,
    msg?: string,
  ): Promise<void> {
    this.logger.warn(`fulfill blocked ${ebayOrderId}: ${reason} (${msg ?? ''})`);
    await this.setStatus(ebayOrderId, AutoFulfillStatus.BLOCKED, reason);
    // Notification (in-app needs-attention list reads blocked status directly)
    // — no email in scope.
  }
}

/**
 * Parse an env int with a fallback + inclusive clamps. Guards against a typo'd
 * env value stalling the concurrency-1 worker (`minTimeMs`) or filling disk
 * (`evidenceTtlDays`). Invalid/empty → `fallback`; parsed value clamped to
 * `[min, max]`.
 */
function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}
