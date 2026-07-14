import { Injectable, Logger } from '@nestjs/common';
import { AmazonAccountStatus, type AmazonScrapedOrderData } from '@repo/shared';

import { AmazonAccountsService } from './amazon-accounts.service';
import { AmazonOrderParserService } from './amazon-order-parser.service';
import { AmazonRateLimiter } from './amazon-rate-limiter.service';
import { BrowserStateManager } from './browser-state-manager.service';

export interface ScrapingProgress {
  stage: 'logging_in' | 'navigating' | 'scraping' | 'saving' | 'done' | 'error';
  message: string;
}

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
