import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  AmazonMarketplace,
  AutoFulfillStatus,
  buildAmazonProductUrl,
  buildAmazonSiteUrl,
  OrderCostCaptureStatus,
  PlatformSettingKey,
  SIMULATED_AMAZON_ORDER_PREFIX,
} from '@repo/shared';
import type { Page } from 'playwright';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { OrderSyncService } from '../orders/order-sync.service';

import { addressBlockMatchesBuyer } from './address-match';
import { isOnAmazonAuthChallenge, probeAmazonAuth } from './amazon-auth-state';
import { AmazonRateLimiter } from './amazon-rate-limiter.service';
import { AmazonScrapingService } from './amazon-scraping.service';
import { AmazonTrackingQueueService } from './amazon-tracking-queue.service';
import { AutoFulfillBlockedReason, shouldSkipFulfillStart } from './auto-fulfill-helpers';
import { BrowserStateManager } from './browser-state-manager.service';

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
  /**
   * Amazon's 404 screen ("Sorry, we couldn't find that page" + the dog photo).
   * Kept separate from `unavailableText`: a missing ASIN is a data problem for
   * the seller to fix, not stock that will return.
   */
  pageNotFoundText: [
    'img[alt*="Dogs of Amazon"]',
    'a:has-text("Meet the dogs of Amazon")',
    'h1:has-text("we couldn\'t find that page")',
    'div:has-text("we couldn\'t find that page")',
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

  // --- Cart page (/gp/cart/view.html) ---
  // Active cart line items carry a `data-asin` attribute across Amazon's
  // legacy and React cart layouts. Saved-for-later items live outside
  // #sc-active-cart and must NOT be counted.
  cartUrl: (marketplace: AmazonMarketplace = AmazonMarketplace.AMAZON_US): string =>
    `${buildAmazonSiteUrl(marketplace)}/gp/cart/view.html`,
  cartItemRow: [
    '#sc-active-cart [data-asin]',
    'div[data-itemtype="active"] [data-asin]',
    '.sc-list-item[data-asin]',
  ],
  cartDeleteButton: [
    '#sc-active-cart input[value="Delete"]',
    '#sc-active-cart [data-action="delete"] input',
    '#sc-active-cart input[data-action="delete"]',
    'input[name^="submit.delete"]',
  ],
  // Per-row quantity: legacy dropdown OR modern stepper value.
  cartQuantityValue: [
    'select[name^="quantity"]',
    '[data-a-selector="value"]',
    '.sc-quantity-stepper input',
  ],

  // --- Checkout flow entrance ---
  proceedToCheckoutButton: [
    'input[name="proceedToRetailCheckout"]',
    'a:has-text("Proceed to checkout")',
    '[data-testid="proceed-to-checkout-button"]',
    '#sc-proceed-to-checkout-squeeze-box-content > div > div > a',
  ],

  /**
   * Upsell interstitial ("Need anything else?" — grocery/add-on suggestions)
   * that Amazon can inject between the cart and the real checkout pipeline.
   * It is NOT the review page: it has its own "Continue to checkout" control and
   * carries `Add` buttons for other products, so it must be passed through
   * deliberately rather than scraped for a total. Observed live 2026-07-30.
   */
  continueToCheckoutButton: [
    'a:has-text("Continue to checkout")',
    'button:has-text("Continue to checkout")',
    'input[value="Continue to checkout"]',
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
  /**
   * Submit control of the "Add an address" dialog. Amazon's current copy is
   * "Use this address" and the button sits BELOW the fold inside the dialog, so
   * the caller must scroll it into view before clicking (observed live
   * 2026-07-30 — the form filled correctly but the click target was never found).
   */
  addressFormContinueButton: [
    '#address-ui-widgets-form-submit-button',
    'input[name="shipToThisAddress"]',
    'input[aria-labelledby*="AddressSubmit"]',
    '#enterAddressSubmit',
    'input[name="ship-address"]',
    'button:has-text("Use this address")',
    'input[value="Use this address"]',
    'button:has-text("Ship to this address")',
    'button:has-text("Add address")',
  ],
  /**
   * State is a <select> in the current add-address form, so it needs
   * `selectOption`, not `fill` — filling leaves it on "Select" and Amazon
   * rejects the address.
   */
  addressStateField:
    '#address-ui-widgets-enterAddressStateOrRegion, select[name="address-ui-widgets-enterAddressStateOrRegion"], #address-ui-widgets-enterAddressStateOrRegion-dropdown-nativeId',
  /**
   * ZIP is prefilled from the session's delivery location. The write is verified
   * after the fact: a silent failure would leave another city's postcode and
   * ship the order to the wrong place.
   */
  addressZipField:
    '#address-ui-widgets-enterAddressPostalCode, input[name="address-ui-widgets-enterAddressPostalCode"]',
  /**
   * The chosen ship-to as checkout echoes it back after the address step. Used
   * for the final recipient assertion — the last chance to catch an order that
   * would be delivered to the buyer-account holder instead of the customer.
   */
  selectedShipToSummary:
    '#addressListSelectedAddress, .displayAddressDiv, [data-testid="shipping-address-summary"], #shipToInsertionNode',
  // Amazon's current wording is "Deliver to this address" (observed live
  // 2026-07-30); the older "Use this address" copy is kept for other layouts.
  useSelectedAddressButton: [
    'input[name="shipToThisAddress"]',
    'input[value="Deliver to this address"]',
    'button:has-text("Deliver to this address")',
    'a:has-text("Deliver to this address")',
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
  // Amazon's checkout sidebar labels the figure "Order total" (observed live
  // 2026-07-30); "Grand Total" is the legacy pipeline's wording. Order matters:
  // the most specific containers come first so a broad text match cannot pick up
  // a subtotal or an "Items:" row instead of the real total.
  reviewGrandTotal: [
    '#subtotals-marketplace-table td.grand-total',
    '#rev-summary td:has-text("Grand Total") + td',
    '#order-summary td[data-testid="grand-total"]',
    'div[data-testid="grand-total-amount"]',
    '.order-summary-total, [data-testid="order-total"]',
    'tr:has-text("Order total") td:last-child',
    'div:has-text("Order total:") > span:last-child',
    'span:has-text("Grand Total:")',
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
  private readonly evidenceDir =
    process.env.FULFILLMENT_EVIDENCE_DIR || path.join(process.cwd(), 'fulfillment-evidence');
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
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly platformSettings: PlatformSettingsService,
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
    // A platform-level proxy gate used to sit here (pool empty/exhausted).
    // Proxying is now the user's own optional per-account choice (migration
    // 080) — see the R2 check in `checkout()`, which only fails closed when
    // THIS account opted in and the browser context failed to honor it.
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
    // One in-context auth resolution per run. Amazon legitimately challenges
    // once when entering checkout; a second challenge after we already supplied
    // credentials means something is genuinely wrong (locked account, captcha,
    // rejected credentials) and must fail closed rather than loop on the money
    // path.
    const authResolution = { attempted: false };
    const { userId, asin, quantity, ship, capTotal, dryRun, proxyEnabled, marketplace } = await this.loadInputs(
      ebayOrderId,
      amazonAccountId,
    );
    if (!asin) {throw new AutoFulfillBlockedError('no_asin');}

    // Step 1: session/login (reuse scraping's login incl. 2FA-TOTP). The page
    // returned is authenticated and lives in the proxy-aware persistent
    // context for the account — all subsequent steps reuse it.
    const page = await this.ensureLoggedIn(amazonAccountId, userId, ebayOrderId, marketplace);
    // R2 — per-account proxy-launch truth. Proxying is the user's own opt-in
    // choice on the account (migration 080): when they did NOT enable one,
    // bare-IP is the expected, unremarkable launch and this check is skipped.
    // When they DID enable one, `resolveProxy` returning null (DB error,
    // missing account) would otherwise silently launch DIRECT against the
    // user's explicit preference — fail closed instead, before any product
    // navigation.
    if (proxyEnabled && !this.browserState.isProxyActive(amazonAccountId)) {
      throw new AutoFulfillBlockedError(
        'proxy_required',
        'this account has its own proxy enabled, but it did not apply to the browser context (resolution failed) — refusing to proceed over bare IP',
      );
    }
    try {
      await this.humanDelay();

      // Step 1b: cart hygiene — empty the cart BEFORE adding our item. A
      // previous blocked attempt (address/payment/captcha) leaves its item in
      // the cart, and the buyer account may hold personal items; Amazon checks
      // out the ENTIRE cart, so any leftover would be co-purchased. Best-effort
      // (verification below is the fail-closed gate).
      await this.clearCart(page, ebayOrderId, marketplace);

      // Step 2: product page + add to cart
      const productResponse = await page.goto(buildAmazonProductUrl(asin, marketplace), {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await this.humanDelay();

      // A missing product page is NOT "out of stock". Amazon returns 404 / its
      // "we couldn't find that page" screen when the ASIN is gone (delisted,
      // wrong region, bad data), and reporting that as out-of-stock sent the
      // seller looking for stock that will never come back. The two need
      // different actions: wait vs. fix or remove the listing.
      if (await this.isProductPageMissing(page, productResponse?.status())) {
        await this.snap(page, ebayOrderId, 'product-page-missing');
        throw new AutoFulfillBlockedError(
          'no_asin',
          `Amazon has no product page for ASIN ${asin} (HTTP ${productResponse?.status() ?? 'unknown'}) — the listing points at a delisted or invalid ASIN`,
        );
      }

      if (await this.isUnavailable(page)) {
        await this.snap(page, ebayOrderId, 'unavailable');
        throw new AutoFulfillBlockedError('out_of_stock');
      }
      await this.setQuantityAndAddToCart(page, quantity);

      // Step 3: cart verification (HARD, fail-closed) + proceed to checkout.
      // Navigate to the cart page deterministically (interstitial layouts
      // vary), then require the cart to contain EXACTLY our item before any
      // payment surface is touched. Throws 'cart' on any mismatch.
      await this.humanDelay();
      await page.goto(CHECKOUT_SELECTORS.cartUrl(marketplace), {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await this.verifyCartContents(page, asin, quantity, ebayOrderId);
      await this.humanDelay();
      // Mandatory step: without it the flow never leaves the cart, and the
      // review-total read later fails as a misleading `cap` block.
      const proceeded = await this.clickFirstAvailable(
        page,
        CHECKOUT_SELECTORS.proceedToCheckoutButton,
        'proceed-to-checkout',
      );
      if (!proceeded) {
        await this.snap(page, ebayOrderId, 'proceed-to-checkout-missing');
        throw new AutoFulfillBlockedError(
          'cart',
          'no visible "Proceed to checkout" control on the cart page',
        );
      }
      // Resolves an OTP prompt automatically; throws 'captcha' | 'otp' only when
      // it cannot be handled without a human.
      await this.detectCaptchaOrOtp(page, userId, amazonAccountId, ebayOrderId);
      // Amazon can inject an upsell interstitial ("Need anything else?") between
      // the cart and the checkout pipeline. Pass it through; leaving it in place
      // meant the review-total read happened on a page of grocery suggestions.
      await this.passUpsellInterstitial(page, asin, quantity, ebayOrderId);
      // Amazon commonly re-challenges identity when ENTERING checkout, even
      // from a valid browsing session. Detect that here instead of letting the
      // signed-out page no-op the address/payment steps and surface much later
      // as an unreadable review total.
      await this.assertStillAuthenticated(
        page,
        ebayOrderId,
        'post-proceed',
        authResolution,
        userId,
        amazonAccountId,
      );
      await this.selectShipToAddress(page, ship, ebayOrderId); // throws 'address' on friction

      // Step 4: payment
      await this.humanDelay();
      await this.selectDefaultPayment(page); // throws 'payment' on decline signals

      // Step 5: review-step HARD CAP — read total, abort if over cap (no click).
      await this.humanDelay();
      // Last auth checkpoint before the cap read. A session lost between
      // payment and review would otherwise be reported as `review_unreadable`,
      // sending the operator to tune selectors against a sign-in page.
      await this.assertStillAuthenticated(
        page,
        ebayOrderId,
        'pre-review',
        authResolution,
        userId,
        amazonAccountId,
      );
      const grandTotal = await this.readReviewGrandTotal(page);
      if (!Number.isFinite(grandTotal) || grandTotal <= 0) {
        await this.snap(page, ebayOrderId, 'review-total-missing');
        // Include the page title: an unreadable total is usually "we are not on
        // the review page at all" (an interstitial, an upsell, a challenge)
        // rather than a broken price selector, and the title says which.
        const title = await page.title().catch(() => 'unknown');
        throw new AutoFulfillBlockedError(
          'review_unreadable',
          `unparseable review grandTotal (${grandTotal}) at ${new URL(page.url()).pathname} [${title}]; refusing to proceed without cap check`,
        );
      }
      // Read at checkout time so an operator can flip the hard cap off (or
      // back on) from the admin panel without restarting the API mid-incident.
      const hardStop = await this.platformSettings.getBoolean(
        PlatformSettingKey.AUTO_FULFILL_REVIEW_CAP_HARD_STOP,
      );
      if (hardStop && capTotal !== Number.POSITIVE_INFINITY && grandTotal > capTotal) {
        await this.snap(page, ebayOrderId, 'cap');
        throw new AutoFulfillBlockedError(
          'cap',
          `grandTotal ${grandTotal.toFixed(2)} > cap ${capTotal.toFixed(2)}`,
        );
      }

      // The Place Order control must be ON SCREEN before we accept the total as
      // the review-step figure. Without this the flow could pass the cap check
      // from an earlier step's sidebar (address selection also shows an order
      // total) and dry-run would report success without ever proving the final
      // pre-purchase page — exactly the verification dry-run exists to provide.
      const placeOrderVisible = await page
        .locator(CHECKOUT_SELECTORS.placeYourOrderButton.join(', '))
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (!placeOrderVisible) {
        await this.snap(page, ebayOrderId, 'place-order-not-reached');
        const title = await page.title().catch(() => 'unknown');
        throw new AutoFulfillBlockedError(
          'review_unreadable',
          `not on the final review step: no Place Order control at ${new URL(page.url()).pathname} [${title}]`,
        );
      }

      // Step 6: place order OR dry-run.
      // Dry-run MUST stop before any place-order click — no money leaves.
      if (dryRun) {
        await this.snap(page, ebayOrderId, 'dry_run_review');
        // Simulate the post-purchase bookkeeping so an operator can verify what a
        // real placement does to the order — costs, cost-capture status, net
        // profit, tracking — WITHOUT money leaving. The Amazon order id carries
        // the `SIM-` prefix, which is what keeps a simulated order from ever
        // being mistaken for a real purchase (see `deriveFulfillmentState`), and
        // `auto_fulfill_status` stays DRY_RUN rather than becoming PLACED.
        await this.simulatePlacement(ebayOrderId, amazonAccountId, userId, {
          grandTotal,
          asin,
        });
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
      // onPlaced sets `auto_fulfill_status='placed'` atomically in its Layer 1
      // UPDATE (or the Layer 2 minimal fallback). Do NOT setStatus(PLACED) again
      // here: in the catastrophic case where BOTH layers throw, onPlaced swallows
      // and leaves the row at RUNNING on purpose (the operator "needs attention"
      // signal + manual reconciliation). A redundant setStatus(PLACED) here would
      // mark the order PLACED with NO amazon_order_id persisted, orphaning it and
      // hiding the stuck-at-RUNNING signal. See onPlaced's I-3 JSDoc contract.
      await this.onPlaced(ebayOrderId, amazonAccountId, userId, placed);
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
  private async ensureLoggedIn(
    accountId: string,
    userId: string,
    ebayOrderId: string,
    marketplace: AmazonMarketplace = AmazonMarketplace.AMAZON_US,
  ): Promise<Page> {
    try {
      const page = await this.scraping.ensureAuthenticatedPage(userId, accountId);
      // Even after a successful session reuse, a soft captcha / OTP can appear
      // on the first navigation. Probe once before handing the page off.
      await page
        .goto(buildAmazonSiteUrl(marketplace), {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        })
        .catch(() => undefined);
      await this.detectCaptchaOrOtp(page, userId, accountId, ebayOrderId);
      // Positively PROVE the session before any cart/payment surface is touched.
      // Without this, a signed-out page silently no-ops every step (each helper
      // treats a missing control as "layout variant, skip") and the run only
      // fails at the review-total read — reported as `cap`, hiding the real
      // cause. Money safety: never proceed toward Place Order unauthenticated.
      const authProbe = await probeAmazonAuth(page);
      if (!authProbe.authenticated) {
        // Evidence here is essential: a login block with no screenshot leaves
        // the operator guessing whether the session, the credentials or the DOM
        // is at fault.
        await this.snap(page, ebayOrderId, 'login-not-proven');
        throw new AutoFulfillBlockedError(
          'login',
          `session not proven authenticated (route=${authProbe.route}; authRoute=${authProbe.authRoute}; authControl=${authProbe.authControlVisible}; signedOutNav=${authProbe.signedOutNav}; signedInNav=${authProbe.signedInNav}; accountMarker=${authProbe.accountPageMarker})`,
        );
      }
      return page;
    } catch (err) {
      if (err instanceof AutoFulfillBlockedError) {throw err;}
      const msg = err instanceof Error ? err.message : String(err);
      if (/2FA|otp|mfa/i.test(msg)) {throw new AutoFulfillBlockedError('otp', msg);}
      if (/captcha/i.test(msg)) {throw new AutoFulfillBlockedError('captcha', msg);}
      // Keep the create-account refusal legible instead of flattening it into a
      // generic login failure: the fix is "use a registered Amazon email", not
      // "re-enter the password".
      if (/create-account form/i.test(msg)) {
        throw new AutoFulfillBlockedError('login', msg);
      }
      if (/login failed|Invalid credentials/i.test(msg)) {
        throw new AutoFulfillBlockedError('login', msg);
      }
      throw new AutoFulfillBlockedError('login', msg);
    }
  }

  /**
   * Pass Amazon's post-cart upsell interstitial ("Need anything else?").
   *
   * It sits between the cart and the real checkout pipeline and is full of `Add`
   * buttons for other products, so only its own "Continue to checkout" control
   * is ever clicked — never anything that could add an item. Because that page
   * exists specifically to grow the basket, the cart is RE-VERIFIED afterwards:
   * Amazon checks out the whole cart, so a stray addition would be co-purchased
   * with real money.
   *
   * Bounded loop: Amazon may chain more than one interstitial, but a page that
   * keeps re-presenting itself must not spin forever on the money path.
   */
  private async passUpsellInterstitial(
    page: Page,
    asin: string,
    quantity: number,
    ebayOrderId: string,
  ): Promise<void> {
    for (let hop = 0; hop < 3; hop++) {
      const onInterstitial = await page
        .locator(CHECKOUT_SELECTORS.continueToCheckoutButton.join(', '))
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (!onInterstitial) {
        return;
      }
      this.logger.debug(`${ebayOrderId}: passing checkout upsell interstitial (hop ${hop + 1})`);
      await this.clickFirstAvailable(
        page,
        CHECKOUT_SELECTORS.continueToCheckoutButton,
        'continue-to-checkout',
      );
      await this.humanDelay();

      // Fail closed if the interstitial changed the basket.
      if (page.url().includes('/gp/cart/view')) {
        await this.verifyCartContents(page, asin, quantity, ebayOrderId);
      }
    }
  }

  /**
   * Re-assert the session mid-flow. Every step helper treats a missing control
   * as "layout variant, skip", so a session lost part-way through checkout
   * silently no-ops the remaining steps and only surfaces at the review-total
   * read — pointing the operator at the wrong problem. Fail closed with
   * `login` and an evidence snap naming the stage instead.
   */
  private async assertStillAuthenticated(
    page: Page,
    ebayOrderId: string,
    stage: string,
    authResolution: { attempted: boolean },
    userId: string,
    amazonAccountId: string,
  ): Promise<void> {
    const probe = await isOnAmazonAuthChallenge(page);
    if (probe.authenticated) {
      return;
    }
    await this.snap(page, ebayOrderId, `challenge-${stage}`);

    // Amazon interrupts the cart→checkout transition with its own in-context
    // sign-in step (observed live: `signin/checkout-perf-initiate-and-store`,
    // `InContextAuthBaseAssets`, plus a WebAuthn DOMException because headless
    // Chromium has no passkey support, so Amazon falls back to the password
    // form). Resolve it IN PLACE: navigating away to a fresh login loses the
    // checkout context and the challenge just reappears. Fully automatic —
    // credentials + TOTP come from the encrypted account record.
    if (!authResolution.attempted) {
      authResolution.attempted = true;
      this.logger.warn(`${ebayOrderId}: resolving Amazon in-context auth challenge at ${stage}`);
      const resolved = await this.scraping
        .resolveInContextChallenge(page, userId, amazonAccountId)
        .catch((err: unknown) => {
          this.logger.warn(
            `${ebayOrderId}: in-context challenge resolution failed: ${(err as Error).message}`,
          );
          return false;
        });
      if (resolved) {
        await this.humanDelay();
        return;
      }
    }

    throw new AutoFulfillBlockedError(
      'login',
      `Amazon identity challenge unresolved at ${stage} (route=${probe.route}; authRoute=${probe.authRoute}; authControl=${probe.authControlVisible})`,
    );
  }

  /**
   * Step 2a-pre: is there no product page at all?
   *
   * Distinguished from out-of-stock because the remedy differs: a delisted or
   * invalid ASIN needs the listing fixed or ended, while genuine out-of-stock
   * resolves itself. Requires a strong signal (404/410 status, or Amazon's
   * dog-page copy) so a slow-rendering real product is never misread as missing.
   */
  private async isProductPageMissing(page: Page, status?: number): Promise<boolean> {
    if (status === 404 || status === 410) {
      return true;
    }
    for (const sel of CHECKOUT_SELECTORS.pageNotFoundText) {
      if (await page.locator(sel).first().isVisible({ timeout: 500 }).catch(() => false)) {
        return true;
      }
    }
    return false;
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
          // Fewer options than requested — pick the highest available (last
          // option; selectOption index is 0-based, so `opts` itself would be
          // out of range and silently leave quantity at 1).
          await qtySelect.selectOption({ index: opts - 1 }).catch(() => undefined);
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
   * Cart hygiene, part 1: best-effort empty of the active cart before adding
   * our item. Bounded delete-click loop; never throws — a miss here is caught
   * by the fail-closed `verifyCartContents` gate, which is the real guard.
   */
  private async clearCart(
    page: Page,
    ebayOrderId: string,
    marketplace: AmazonMarketplace = AmazonMarketplace.AMAZON_US,
  ): Promise<void> {
    try {
      await page.goto(CHECKOUT_SELECTORS.cartUrl(marketplace), {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      for (let i = 0; i < 10; i++) {
        const del = page.locator(CHECKOUT_SELECTORS.cartDeleteButton.join(', ')).first();
        if (!(await del.isVisible({ timeout: 1500 }).catch(() => false))) {
          break;
        }
        await del.click().catch(() => undefined);
        await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined);
        await this.humanDelay();
      }
    } catch (err) {
      this.logger.warn(
        `clearCart best-effort failed for ${ebayOrderId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Cart hygiene, part 2 (HARD, fail-closed): the active cart must contain
   * EXACTLY one line item, it must be our ASIN, and — when the per-row
   * quantity is readable — the quantity must match the order. Anything else
   * throws `'cart'`: Amazon checks out the whole cart, so a stale leftover
   * from a blocked attempt or the buyer's personal items would be
   * co-purchased with real money. An unreadable row count also blocks
   * (selector drift is surfaced during dry-run tuning, before money moves).
   */
  private async verifyCartContents(
    page: Page,
    asin: string,
    qty: number,
    ebayOrderId: string,
  ): Promise<void> {
    const rows = page.locator(CHECKOUT_SELECTORS.cartItemRow.join(', '));
    const rowCount = await rows.count().catch(() => -1);
    if (rowCount !== 1) {
      await this.snap(page, ebayOrderId, 'cart-mismatch');
      throw new AutoFulfillBlockedError(
        'cart',
        `active cart has ${rowCount < 0 ? 'unreadable' : rowCount} line items (expected exactly 1)`,
      );
    }

    const row = rows.first();
    const rowAsin = (await row.getAttribute('data-asin').catch(() => null)) ?? '';
    const asinMatches =
      rowAsin.toUpperCase() === asin.toUpperCase() ||
      (rowAsin === '' &&
        (await row
          .locator(`a[href*="${asin}"]`)
          .first()
          .isVisible({ timeout: 1000 })
          .catch(() => false)));
    if (!asinMatches) {
      await this.snap(page, ebayOrderId, 'cart-mismatch');
      throw new AutoFulfillBlockedError(
        'cart',
        `cart line item ASIN mismatch (found "${rowAsin || 'unknown'}", expected ${asin})`,
      );
    }

    // Quantity: block on a READABLE mismatch; warn-and-continue when
    // unreadable (row count + ASIN already verified, review-step cap bounds
    // the worst case; blocking on every unreadable stepper would dead-stop
    // all orders on a cosmetic layout change).
    const qtyLoc = row.locator(CHECKOUT_SELECTORS.cartQuantityValue.join(', ')).first();
    let cartQty: number | null = null;
    if (await qtyLoc.isVisible({ timeout: 1000 }).catch(() => false)) {
      const rawValue = await qtyLoc.inputValue().catch(() => null);
      const rawText = rawValue ?? (await qtyLoc.textContent().catch(() => null));
      const parsed = Number.parseInt((rawText ?? '').trim(), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        cartQty = parsed;
      }
    }
    if (cartQty !== null && cartQty !== qty) {
      await this.snap(page, ebayOrderId, 'cart-mismatch');
      throw new AutoFulfillBlockedError(
        'cart',
        `cart quantity ${cartQty} != order quantity ${qty}`,
      );
    }
    if (cartQty === null) {
      this.logger.warn(
        `verifyCartContents: quantity unreadable for ${ebayOrderId} — proceeding on row/ASIN match only`,
      );
    }
  }

  /**
   * Step 3a: handle MFA / captcha on the checkout auth surface.
   *
   * An OTP prompt is RESOLVED, not reported: the account's encrypted TOTP secret
   * makes this fully automatic, and stopping here would mean asking a customer
   * to type a code for their own automated order. Only an unresolvable prompt
   * blocks. Captcha still fails closed — it cannot be solved automatically, and
   * attempting to defeat it would risk the buyer account.
   */
  private async detectCaptchaOrOtp(
    page: Page,
    userId: string,
    amazonAccountId: string,
    ebayOrderId: string,
  ): Promise<void> {
    const otp = page.locator(CHECKOUT_SELECTORS.mfaOtpInput).first();
    if (await otp.isVisible({ timeout: 1000 }).catch(() => false)) {
      this.logger.warn(`${ebayOrderId}: resolving Amazon OTP prompt mid-checkout`);
      const resolved = await this.scraping
        .resolveInContextChallenge(page, userId, amazonAccountId)
        .catch((err: unknown) => {
          this.logger.warn(
            `${ebayOrderId}: OTP resolution failed: ${(err as Error).message}`,
          );
          return false;
        });
      if (!resolved) {
        await this.snap(page, ebayOrderId, 'otp-unresolved');
        throw new AutoFulfillBlockedError(
          'otp',
          'Amazon prompted for an MFA OTP code mid-checkout and it could not be resolved automatically',
        );
      }
      await this.humanDelay();
    }
    const captcha = page.locator(CHECKOUT_SELECTORS.captchaInput).first();
    if (await captcha.isVisible({ timeout: 1000 }).catch(() => false)) {
      await this.snap(page, ebayOrderId, 'captcha');
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
  private async selectShipToAddress(
    page: Page,
    ship: Address,
    ebayOrderId: string,
  ): Promise<void> {
    const anyRadio = page.locator(CHECKOUT_SELECTORS.addressRadio.join(', '));
    const radioCount = await anyRadio.count().catch(() => 0);

    if (radioCount > 0) {
      let matched = false;
      const blocks = page.locator(CHECKOUT_SELECTORS.addressBlock);
      const blockCount = await blocks.count().catch(() => 0);
      for (let i = 0; i < blockCount; i++) {
        const blk = blocks.nth(i);
        const text = ((await blk.textContent().catch(() => '')) ?? '');
        // Street + zip (+ unit) must all line up — see `address-match.ts` for why
        // a zip-only match is unsafe.
        if (!addressBlockMatchesBuyer(text, ship)) {
          continue;
        }
        const radio = blk.locator('input[type="radio"]').first();
        if (await radio.isVisible({ timeout: 500 }).catch(() => false)) {
          await radio.check();
          matched = true;
          break;
        }
      }
      if (!matched) {
        // NEVER fall back to Amazon's pre-selected address. That default is the
        // buyer-account holder's own address, so accepting it ships the item to
        // the wrong person while the eBay sale stays unfulfilled. If the buyer's
        // address is not already in the address book, the add-address path below
        // is the only correct route — and if neither works, fail closed.
        const added = await this.addBuyerAddress(page, ship, ebayOrderId);
        if (!added) {
          await this.snap(page, ebayOrderId, 'address-not-matched');
          throw new AutoFulfillBlockedError(
            'address',
            `none of the saved Amazon addresses match the eBay buyer (${ship.zipCode ?? 'no zip'}) and the address could not be added`,
          );
        }
      }
    } else {
      // No saved addresses at all — the buyer's address must be entered.
      const added = await this.addBuyerAddress(page, ship, ebayOrderId);
      if (!added) {
        await this.snap(page, ebayOrderId, 'address-add-unavailable');
        throw new AutoFulfillBlockedError(
          'address',
          'no saved Amazon addresses and no add-address control was available',
        );
      }
    }

    // Confirm the address. This is MANDATORY when the address step is on screen:
    // treating a missing button as "different layout, skip" let the flow believe
    // it had reached the review step while still sitting on address selection —
    // the cap was then checked against the sidebar total of the WRONG step, and
    // dry-run reported success without ever proving the pre-Place-Order page.
    const useBtn = page
      .locator(CHECKOUT_SELECTORS.useSelectedAddressButton.join(', '))
      .first();
    const useBtnVisible = await useBtn.isVisible({ timeout: 2500 }).catch(() => false);
    if (!useBtnVisible) {
      const addressStepPresent = await page
        .locator('h1:has-text("Select a delivery address"), h2:has-text("Select a delivery address")')
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      if (addressStepPresent) {
        await this.snap(page, ebayOrderId, 'address-confirm-missing');
        throw new AutoFulfillBlockedError(
          'address',
          'address step is on screen but no delivery-address confirm control was found',
        );
      }
    }
    if (useBtnVisible) {
      await useBtn.click();
      await page
        .waitForLoadState('domcontentloaded', { timeout: 15_000 })
        .catch(() => undefined);
      // Post-submit we may bounce back to the same step on a validation issue.
      // Detect that from the DOM, not the URL: Amazon's single-page checkout
      // keeps the same URL across steps, so a URL check silently passed a
      // still-on-address page through to the review read.
      await this.humanDelay();
      const stillOnAddressStep = await page
        .locator(CHECKOUT_SELECTORS.useSelectedAddressButton.join(', '))
        .first()
        .isVisible({ timeout: 1500 })
        .catch(() => false);
      if (stillOnAddressStep) {
        throw new AutoFulfillBlockedError(
          'address',
          'address selection did not advance (Amazon re-presented the address step)',
        );
      }
    }

    // FINAL RECIPIENT CHECK. Everything above can succeed and still leave the
    // WRONG address active (a stale selection, an autofilled ZIP, an ignored
    // form). Once checkout shows the chosen ship-to, confirm it is the eBay
    // buyer's before any payment surface is touched. Only asserts when a
    // ship-to summary is actually rendered, so a layout without one cannot
    // dead-stop legitimate orders — the earlier gates still apply there.
    const shipToSummary = page.locator(CHECKOUT_SELECTORS.selectedShipToSummary).first();
    if (await shipToSummary.isVisible({ timeout: 2500 }).catch(() => false)) {
      const summaryText = ((await shipToSummary.textContent().catch(() => '')) ?? '');
      if (summaryText.trim() && !addressBlockMatchesBuyer(summaryText, ship)) {
        await this.snap(page, ebayOrderId, 'wrong-ship-to-selected');
        throw new AutoFulfillBlockedError(
          'address',
          `checkout ship-to does not match the eBay buyer (expected ${ship.street} ${ship.zipCode})`,
        );
      }
    }
  }

  /**
   * Enter the eBay buyer's address into Amazon's add-address form.
   *
   * This is the correct route whenever the buyer's address is not already saved
   * on the account — the alternative (accepting Amazon's pre-selected default)
   * would ship the item to the buyer-account holder instead of the customer.
   *
   * Returns false when the add-address entry point is not available, so the
   * caller can fail closed. Throws `address` on form/validation friction:
   * guessing at a rejected address leads to a mis-shipped, paid-for order.
   */
  private async addBuyerAddress(
    page: Page,
    ship: Address,
    ebayOrderId: string,
  ): Promise<boolean> {
    const addLink = page.locator(CHECKOUT_SELECTORS.addNewAddressLink.join(', ')).first();
    if (!(await addLink.isVisible({ timeout: 2000 }).catch(() => false))) {
      return false;
    }
    await addLink.click();
    // The form opens as an in-page dialog, not a navigation, so wait for the
    // field itself rather than a load event.
    await page
      .locator('#address-ui-widgets-enterAddressFullName')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => undefined);

    try {
      await page
        .locator('#address-ui-widgets-enterAddressFullName')
        .first()
        .fill(ship.fullName ?? '');
      await page.locator('#address-ui-widgets-enterAddressLine1').first().fill(ship.street ?? '');
      if (ship.street2) {
        await page.locator('#address-ui-widgets-enterAddressLine2').first().fill(ship.street2);
      }
      await page.locator('#address-ui-widgets-enterAddressCity').first().fill(ship.city ?? '');

      // State is a <select> in the current form (observed live 2026-07-30):
      // `fill()` silently leaves it on "Select", and Amazon then rejects the
      // address. Choose the option instead, by code then by visible label.
      const stateField = page.locator(CHECKOUT_SELECTORS.addressStateField).first();
      const stateValue = (ship.state ?? '').trim();
      if (stateValue) {
        const isSelect =
          (await stateField.evaluate((el) => el.tagName.toLowerCase()).catch(() => '')) === 'select';
        if (isSelect) {
          const chosen = await stateField
            .selectOption(stateValue)
            .then(() => true)
            .catch(() => false);
          if (!chosen) {
            await stateField.selectOption({ label: stateValue }).catch(() => undefined);
          }
        } else {
          await stateField.fill(stateValue);
        }
      }

      // ZIP: Amazon prefills this from the session's delivery location, so a
      // failed write leaves someone else's postcode in place (observed: 10020
      // instead of 20500) — which would ship to the wrong city. Clear, write,
      // then verify the field actually holds the buyer's ZIP.
      const zipField = page.locator(CHECKOUT_SELECTORS.addressZipField).first();
      const zipValue = (ship.zipCode ?? '').trim();
      await zipField.fill('');
      await zipField.fill(zipValue);
      const zipWritten = (await zipField.inputValue().catch(() => '')).trim();
      if (zipValue && zipWritten !== zipValue) {
        await this.snap(page, ebayOrderId, 'address-zip-mismatch');
        throw new AutoFulfillBlockedError(
          'address',
          `ZIP field holds "${zipWritten}" after writing "${zipValue}" — refusing to ship to an unverified postcode`,
        );
      }

      if (ship.phone) {
        await page.locator('#address-ui-widgets-enterAddressPhoneNumber').first().fill(ship.phone);
      }
      // The dialog's submit button is below the fold; scroll it into view first
      // or the click never lands and a correctly-filled form looks like a
      // failure. Report the miss explicitly instead of relying on a click
      // timeout, so the operator sees "no submit control" rather than a stack.
      // Resolve by ACCESSIBLE NAME first. Amazon's button markup is
      // `<input type="submit" aria-labelledby="…-announce">` with the visible
      // text in a sibling span, so the input itself has no value/aria-label/text
      // — attribute-based searches (and the earlier DOM probe) could not see it.
      // getByRole computes the accessible name, which follows aria-labelledby.
      // The name is anchored to the form's own wording and deliberately excludes
      // "Deliver to this address", which belongs to the address LIST behind the
      // dialog: clicking that would ship to the account's pre-selected address.
      let submitBtn = page
        .getByRole('button', { name: /use this address|ship to this address|add address|save address/i })
        .first();
      let submitVisible = await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false);

      if (!submitVisible) {
        submitBtn = page.locator(CHECKOUT_SELECTORS.addressFormContinueButton.join(', ')).first();
        await submitBtn.scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => undefined);
        submitVisible = await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      }

      if (!submitVisible) {
        // Last resort: submit the form directly. A full document inventory (with
        // aria-labelledby resolved) proved the dialog's own submit control is not
        // in the main frame at all — the only visible submit belongs to the
        // address LIST behind it ("Deliver to this address"), which must never be
        // clicked here because it would ship to the pre-selected account address.
        // requestSubmit() fires the form's real submit handler and validation,
        // exactly as the missing button would, without borrowing another
        // button's click.
        const submitted = await page
          .evaluate(() => {
            const anchor = document.querySelector('#address-ui-widgets-enterAddressFullName');
            const form = anchor?.closest('form');
            if (!form) {
              return false;
            }
            if (typeof form.requestSubmit === 'function') {
              form.requestSubmit();
            } else {
              form.submit();
            }
            return true;
          })
          .catch(() => false);
        if (submitted) {
          this.logger.debug(`${ebayOrderId}: address dialog submitted via form.requestSubmit()`);
          await page
            .locator('#address-ui-widgets-enterAddressFullName')
            .first()
            .waitFor({ state: 'hidden', timeout: 20_000 })
            .catch(() => undefined);
          await this.humanDelay();
          return true;
        }
      }

      if (!submitVisible) {
        // The dialog is taller than the viewport and scrolls internally, so the
        // submit control can sit outside the rendered area where Playwright
        // cannot see it. Find it by accessible text inside the dialog and scroll
        // it in. Anchored to the dialog and to submit-like text so this can only
        // ever reach the address form's own button.
        submitVisible = await page
          .evaluate(() => {
            const wanted = /use this address|ship to this address|add address|save address/i;
            // Search the whole document, not the field's <form>: the probe showed
            // the form contains only Autofill/error controls, so Amazon renders
            // the submit button OUTSIDE it (a dialog footer). Filter by label so a
            // document-wide search still cannot hit an unrelated control.
            const candidates = Array.from(
              document.querySelectorAll<HTMLElement>(
                'input[type="submit"], input[type="button"], button, [role="button"], a[role="button"], span.a-button-inner',
              ),
            );
            const target = candidates.find((el) => {
              const label = [
                el.getAttribute('value'),
                el.getAttribute('aria-label'),
                el.textContent,
              ]
                .filter(Boolean)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
              // Reject the storefront's own "Deliver to this address" button, which
              // belongs to the address LIST behind the dialog, not the form.
              return wanted.test(label) && !/deliver to this address/i.test(label);
            });
            if (target) {
              target.scrollIntoView({ block: 'center' });
              return true;
            }
            return false;
          })
          .catch(() => false);
        if (submitVisible) {
          await this.humanDelay();
          submitVisible = await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false);
        }
      }

      if (!submitVisible) {
        await this.snap(page, ebayOrderId, 'address-submit-missing');
        // Report the dialog's actual controls. A bare "no submit control" told
        // the operator nothing about WHICH control to add, so the selector list
        // could only be fixed by guessing. Metadata only — no field values.
        const controls = await page
          .evaluate(() => {
            // Report every clickable control in the DOCUMENT. Scoping to the
            // field's <form> returned only Autofill/error buttons, proving the
            // submit control lives elsewhere; a document-wide inventory is what
            // actually identifies it. Metadata only — never field values.
            const seen = Array.from(
              document.querySelectorAll<HTMLElement>(
                'input[type="submit"], input[type="button"], button, [role="button"]',
              ),
            )
              .map((el) => {
                // Follow aria-labelledby: Amazon's submit inputs carry no value
                // or text of their own, so without this the control that matters
                // showed up as an unlabelled row and got filtered out.
                const labelledBy = el.getAttribute('aria-labelledby');
                const referenced = labelledBy
                  ? (document.getElementById(labelledBy)?.textContent ?? '')
                  : '';
                const label = [el.getAttribute('aria-label'), referenced, el.textContent]
                  .filter(Boolean)
                  .join(' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                return {
                  tag: el.tagName.toLowerCase(),
                  id: el.id || null,
                  name: el.getAttribute('name'),
                  value: el.getAttribute('value'),
                  labelledBy,
                  label: label.slice(0, 40),
                  visible: el.offsetParent !== null,
                };
              })
              .slice(0, 25);
            return {
              iframes: Array.from(document.querySelectorAll('iframe')).map((f) => ({
                id: f.id || null,
                name: f.getAttribute('name'),
                src: (f.getAttribute('src') ?? '').slice(0, 60),
              })),
              controls: seen,
            };
          })
          .catch(() => null);
        throw new AutoFulfillBlockedError(
          'address',
          `add-address dialog exposed no known submit control; probe=${JSON.stringify(controls)}`,
        );
      }
      await submitBtn.click();
      // The dialog closes in-page rather than navigating, so wait for the form
      // to disappear instead of a load event.
      await page
        .locator('#address-ui-widgets-enterAddressFullName')
        .first()
        .waitFor({ state: 'hidden', timeout: 20_000 })
        .catch(() => undefined);
      await this.humanDelay();
    } catch (err) {
      if (err instanceof AutoFulfillBlockedError) {throw err;}
      await this.snap(page, ebayOrderId, 'address-form-failed');
      const msg = err instanceof Error ? err.message : String(err);
      throw new AutoFulfillBlockedError('address', `add-address form failed: ${msg}`);
    }

    const validationErr = page
      .locator(
        'div.a-alert-content:has-text("could not be verified"), div.a-alert-content:has-text("not valid")',
      )
      .first();
    if (await validationErr.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.snap(page, ebayOrderId, 'address-validation-failed');
      const txt = ((await validationErr.textContent()) ?? '').trim().slice(0, 200);
      throw new AutoFulfillBlockedError('address', `validation: ${txt}`);
    }
    return true;
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

    // Structure-independent fallback: find the "Order total" / "Grand total"
    // label in the rendered text and take the currency amount that follows it.
    // Amazon reshuffles the summary markup often, and a selector-only read makes
    // every reshuffle look like a cap failure. Anchored to the label (not just
    // "the first price on the page") so a subtotal or an item price can never be
    // mistaken for the figure the spend cap is checked against.
    const labelled = await page
      .locator('body')
      .innerText()
      .then((text) =>
        text.match(/(?:order\s+total|grand\s+total)\s*:?\s*\$\s*([\d,]+\.\d{2})/i),
      )
      .catch(() => null);
    if (labelled?.[1]) {
      const n = parseFloat(labelled[1].replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) {
        this.logger.debug('review total resolved via labelled-text fallback');
        return n;
      }
    }

    return Number.NaN;
  }

  /**
   * DRY-RUN ONLY. Apply the post-purchase bookkeeping a real placement would,
   * using a clearly-marked placeholder Amazon order id.
   *
   * Why this exists: the value of a dry run was limited to "the selectors reach
   * the review page". It could not answer the operator's actual question — what
   * happens to the order once Amazon accepts it: which costs land, does the
   * order become cost-captured, what net profit is computed, does tracking start.
   *
   * Safety properties, all load-bearing:
   *  - `auto_fulfill_status` stays DRY_RUN. It never becomes PLACED, so the real
   *    idempotency guard (`shouldSkipFulfillStart`) and the "purchased" state are
   *    untouched by simulation.
   *  - The Amazon order id is `SIM-`-prefixed, so `deriveFulfillmentState` reports
   *    SIMULATED and no reader can confuse it with a real purchase.
   *  - Tracking is NOT scheduled: the id is fake, so a tracker would scrape a
   *    non-existent Amazon order and mark the row failed. The simulation records
   *    that tracking *would* start instead.
   *  - Costs come from the REAL review-page total, split the way Amazon's
   *    confirmation would report it, so the profit figure is meaningful.
   *
   * Fail-soft throughout: a diagnostic aid must never break the run it inspects.
   */
  private async simulatePlacement(
    ebayOrderId: string,
    amazonAccountId: string,
    userId: string,
    observed: { grandTotal: number; asin: string },
  ): Promise<void> {
    // Amazon's own id shape, behind the SIM- marker, so downstream formatting and
    // any length assumptions behave exactly as they will in production.
    const digits = (len: number): string =>
      Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('');
    const simulatedOrderId = `${SIMULATED_AMAZON_ORDER_PREFIX}${digits(3)}-${digits(7)}-${digits(7)}`;

    // Split the observed review total into the fields a confirmation carries.
    // Items = total − tax − shipping keeps `purchase_price + tax + shipping`
    // reconciling to what the review page actually showed.
    const tax = Number((observed.grandTotal * 0.06).toFixed(2));
    const shipping = 0;
    const purchasePrice = Number((observed.grandTotal - tax - shipping).toFixed(2));

    try {
      await this.db.query(
        `UPDATE orders SET
           amazon_account_id         = $1,
           amazon_order_id           = $2,
           purchase_price            = $3,
           amazon_tax                = $4,
           amazon_shipping           = $5,
           amazon_linked_at          = CURRENT_TIMESTAMP,
           cost_capture_status       = $6,
           auto_fulfill_status       = $7,
           auto_fulfill_attempted_at = CURRENT_TIMESTAMP,
           updated_at                = CURRENT_TIMESTAMP
         WHERE ebay_order_id = $8`,
        [
          amazonAccountId,
          simulatedOrderId,
          purchasePrice,
          tax,
          shipping,
          OrderCostCaptureStatus.LINKED,
          AutoFulfillStatus.DRY_RUN,
          ebayOrderId,
        ],
      );
    } catch (err) {
      this.logger.error(
        `dry-run simulation write failed for ${ebayOrderId}: ${(err as Error).message}`,
      );
      // Still record the stop so the order does not look untouched.
      await this.setStatus(ebayOrderId, AutoFulfillStatus.DRY_RUN).catch(() => undefined);
      return;
    }

    // Real profit recompute against the simulated costs — the single writer for
    // net_profit, so the number is produced exactly as production would.
    try {
      await this.orderSync.recomputeProfit(ebayOrderId);
    } catch (err) {
      this.logger.warn(
        `dry-run recomputeProfit failed for ${ebayOrderId}: ${(err as Error).message}`,
      );
    }

    // Record it in the same audit file operators already read for blocks. The tag
    // is a plain string, NOT a blocked reason — a dry run is not a block, and
    // widening the enum for a diagnostic label would pollute the FE's reason map.
    await this.appendEvidenceNote(
      ebayOrderId,
      'DRY_RUN',
      `simulated placement: amazonOrderId=${simulatedOrderId} asin=${observed.asin} ` +
        `items=${purchasePrice.toFixed(2)} tax=${tax.toFixed(2)} shipping=${shipping.toFixed(2)} ` +
        `total=${observed.grandTotal.toFixed(2)} costCapture=linked account=${amazonAccountId} user=${userId} ` +
        `tracking=NOT scheduled (placeholder id would fail a real scrape)`,
    ).catch(() => undefined);

    this.logger.log(
      `dry-run simulated placement ${ebayOrderId}: ${simulatedOrderId} total=${observed.grandTotal.toFixed(2)}`,
    );
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
  ): Promise<boolean> {
    for (const sel of selectors) {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loc.click();
        await page
          .waitForLoadState('domcontentloaded', { timeout: 15_000 })
          .catch(() => undefined);
        return true;
      }
    }
    this.logger.debug(`clickFirstAvailable: no visible selector for ${label}`);
    return false;
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
    const evidenceTtlDays = await this.platformSettings.getNumber(
      PlatformSettingKey.FULFILLMENT_EVIDENCE_TTL_DAYS,
    );
    const ttlMs = evidenceTtlDays * 24 * 60 * 60 * 1000;
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
          this.logger.log(`swept evidence dir ${entry} (older than ${evidenceTtlDays}d)`);
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
    proxyEnabled: boolean;
    marketplace: AmazonMarketplace;
  }> {
    const [row] = await this.db.query<{
      user_id: string;
      asin: string | null;
      quantity: number;
      shipping_address: unknown;
      auto_fulfill_cap_total: string | number | null;
      auto_fulfill_dry_run: boolean;
      proxy_enabled: boolean;
      marketplace: string;
    }>(
      `SELECT o.user_id, p.asin, o.quantity, o.shipping_address,
              a.auto_fulfill_cap_total, a.auto_fulfill_dry_run, a.proxy_enabled, a.marketplace
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

    // WRONG-RECIPIENT GUARD. In dropshipping the item must ship to the eBay
    // BUYER. With an empty address the flow fell through to "use whatever
    // Amazon pre-selected", i.e. the buyer-account holder's own default address:
    // the order would be paid for and delivered to the wrong person, and the
    // eBay sale would still be unfulfilled. Require the parts needed to identify
    // and match a delivery address before anything is added to a cart.
    const ship = (row.shipping_address as Address | null) ?? null;
    const missing = (['street', 'city', 'zipCode'] as const).filter(
      (field) => !ship?.[field]?.trim(),
    );
    if (!ship || missing.length > 0) {
      throw new AutoFulfillBlockedError(
        'address',
        `eBay order has no usable buyer shipping address (missing: ${
          ship ? missing.join(', ') : 'entire address'
        }); refusing to ship to the buyer account's default address`,
      );
    }

    return {
      userId: row.user_id,
      asin: row.asin,
      quantity: row.quantity ?? 1,
      ship,
      capTotal,
      dryRun: !!row.auto_fulfill_dry_run,
      proxyEnabled: !!row.proxy_enabled,
      marketplace: (row.marketplace as AmazonMarketplace) || AmazonMarketplace.AMAZON_US,
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
    userId: string,
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

    // Layer 5 (best-effort): AO monthly quota consume. The order was placed, so
    // the reserved slot stays counted for the current billing period (the
    // foundation's ledger model: 'reserved' counts; consume = no-op
    // confirmation). Idempotent + fail-soft.
    try {
      this.quotaEnforcement.consumeAmazonOrder(userId, ebayOrderId);
    } catch (err) {
      this.logger.warn(
        `onPlaced quota consume failed for ${ebayOrderId}: ${(err as Error).message}`,
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

  /**
   * Append a tagged line to the order's evidence directory, alongside the
   * screenshots. The DB column stores only the enum (the FE maps it to an i18n
   * label) and the logger goes to the console, so this file is where the
   * diagnostic detail actually survives a run.
   *
   * Best-effort: diagnostics must never affect the outcome of a run.
   */
  private async appendEvidenceNote(
    ebayOrderId: string,
    tag: string,
    msg: string,
  ): Promise<void> {
    try {
      const dir = path.join(this.evidenceDir, ebayOrderId);
      await fs.mkdir(dir, { recursive: true });
      await fs.appendFile(
        path.join(dir, 'blocked.log'),
        `${new Date().toISOString()} ${tag} ${msg}\n`,
        'utf8',
      );
    } catch (err) {
      this.logger.warn(
        `could not write evidence note for ${ebayOrderId}: ${(err as Error).message}`,
      );
    }
  }

  /** Mark an order blocked. Deliberate stop — caller returns, no rethrow. */
  private async block(
    ebayOrderId: string,
    reason: AutoFulfillBlockedReason,
    msg?: string,
  ): Promise<void> {
    this.logger.warn(`fulfill blocked ${ebayOrderId}: ${reason} (${msg ?? ''})`);
    // Persist the detail next to the screenshots. The DB column stores only the
    // enum (the FE maps it to an i18n label), and the logger goes to the console,
    // so without this the diagnostic detail was effectively unreadable after the
    // run — which is what forced selector fixes to be guesswork.
    if (msg) {
      await this.appendEvidenceNote(ebayOrderId, reason, msg);
    }
    await this.setStatus(ebayOrderId, AutoFulfillStatus.BLOCKED, reason);
    // AO monthly quota: release the reserved slot on a deliberate block so the
    // period's quota is not consumed by an order that never placed. Best-effort
    // + idempotent. userId resolved here (block call sites don't carry it).
    try {
      const rows = await this.db.query<{ user_id: string }>(
        `SELECT user_id FROM orders WHERE ebay_order_id = $1`,
        [ebayOrderId],
      );
      if (rows[0]?.user_id) {
        await this.quotaEnforcement.releaseAmazonOrder(rows[0].user_id, ebayOrderId);
      }
    } catch (err) {
      this.logger.warn(
        `block quota release failed for ${ebayOrderId}: ${(err as Error).message}`,
      );
    }
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
