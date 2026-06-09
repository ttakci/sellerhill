import { Body, Controller, Delete, Get, Logger, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import {
  AmazonAccountStatus,
  type AmazonAccountPublicDto,
  type CreateAmazonAccountDto,
  type LinkAmazonOrderDto,
  type UpdateAmazonAccountDto,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderSyncService } from '../orders/order-sync.service';

import { AmazonAccountsService } from './amazon-accounts.service';
import { AmazonScrapingService } from './amazon-scraping.service';
import { AmazonTrackingQueueService } from './amazon-tracking-queue.service';

interface AuthenticatedRequest extends Request {
  user: { sub: string };
}

@Controller('amazon')
@UseGuards(JwtAuthGuard)
export class AmazonController {
  private readonly logger = new Logger(AmazonController.name);

  constructor(
    private readonly accountsService: AmazonAccountsService,
    private readonly scrapingService: AmazonScrapingService,
    private readonly trackingQueueService: AmazonTrackingQueueService,
    private readonly databaseService: DatabaseService,
    private readonly orderSyncService: OrderSyncService
  ) {}

  @Get('accounts')
  async listAccounts(@Req() req: AuthenticatedRequest): Promise<AmazonAccountPublicDto[]> {
    return this.accountsService.findAll(req.user.sub);
  }

  @Post('accounts')
  async createAccount(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAmazonAccountDto
  ): Promise<AmazonAccountPublicDto> {
    return this.accountsService.create(req.user.sub, {
      label: dto.label,
      email: dto.email,
      password: dto.password,
      twoFactorSecret: dto.twoFactorSecret,
    });
  }

  @Put('accounts/:id')
  async updateAccount(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAmazonAccountDto
  ): Promise<AmazonAccountPublicDto> {
    return this.accountsService.update(req.user.sub, id, {
      label: dto.label,
      password: dto.password,
      twoFactorSecret: dto.twoFactorSecret,
    });
  }

  @Delete('accounts/:id')
  async deleteAccount(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string
  ): Promise<{ success: boolean }> {
    await this.accountsService.delete(req.user.sub, id);
    return { success: true };
  }

  @Post('accounts/:id/verify')
  async verifyAccount(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const account = await this.accountsService.getDecrypted(req.user.sub, id);

      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

      try {
        const page = await browser.newPage();
        await page.goto('https://www.amazon.com/ap/signin', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.locator('#ap_email').fill(account.email);
        await page.locator('#continue').click();
        await page.waitForTimeout(2000);
        await page.locator('#ap_password').fill(account.decryptedPassword);
        await page.locator('#signInSubmit').click();
        await page.waitForTimeout(3000);

        const loginError = page.locator('#auth-error-message-box .a-alert-content');
        if (await loginError.isVisible({ timeout: 3000 }).catch(() => false)) {
          await this.accountsService.updateStatus(req.user.sub, id, AmazonAccountStatus.INVALID);
          return { success: false, message: 'Invalid credentials' };
        }

        await this.accountsService.markVerified(req.user.sub, id);
        return { success: true, message: 'Account verified successfully' };
      } finally {
        await browser.close();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Account verification failed: ${message}`);
      return { success: false, message: 'Verification failed' };
    }
  }

  @Post('orders/:orderId/link-amazon')
  async linkAmazonOrder(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: LinkAmazonOrderDto
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user.sub;

    // Verify order ownership
    const orders = await this.databaseService.query<{ id: string; ebay_order_id: string }>(
      `SELECT id, ebay_order_id FROM orders WHERE id = $1 AND user_id = $2`,
      [orderId, userId]
    );

    if (orders.length === 0) {
      return { success: false, message: 'Order not found' };
    }

    try {
      // Scrape the Amazon order
      const scrapedData = await this.scrapingService.scrapeOrder(
        userId,
        dto.amazonAccountId,
        dto.amazonOrderId
      );

      // Use first item's price as purchase price (or grand total for single item)
      const purchasePrice = scrapedData.items.length === 1
        ? scrapedData.items[0].price
        : scrapedData.subtotal;

      // Update the order with scraped data
      await this.databaseService.query(
        `UPDATE orders SET
          amazon_account_id = $1,
          amazon_order_id = $2,
          purchase_price = $3,
          amazon_tax = $4,
          amazon_shipping = $5,
          amazon_tracking_number = $6,
          amazon_tracking_carrier = $7,
          amazon_tracking_url = $8,
          amazon_linked_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $9`,
        [
          dto.amazonAccountId,
          scrapedData.amazonOrderId,
          purchasePrice,
          scrapedData.tax,
          scrapedData.shipping,
          scrapedData.trackingNumber || null,
          scrapedData.trackingCarrier || null,
          scrapedData.trackingUrl || null,
          orderId,
        ]
      );

      // Recalculate profit
      await this.orderSyncService.recalculateProfit(orders[0].ebay_order_id);

      // Start tracking this order
      await this.trackingQueueService.scheduleOrderTracking(orderId, dto.amazonAccountId);

      // If already shipped, trigger immediate tracking check
      if (scrapedData.status === 'shipped') {
        await this.trackingQueueService.triggerImmediateTracking(orderId, dto.amazonAccountId);
      }

      return { success: true, message: 'Amazon order linked successfully' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to link Amazon order: ${message}`);
      return { success: false, message };
    }
  }
}
