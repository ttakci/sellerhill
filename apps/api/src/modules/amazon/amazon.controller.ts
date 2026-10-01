import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AmazonAccountStatus,
  type AmazonAccountPublicDto,
  CreateAmazonAccountDto,
  LinkAmazonOrderDto,
  type StartAutoFulfillResultDto,
  UpdateAmazonAccountDto,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { OrderSyncService } from '../orders/order-sync.service';

import { AmazonAccountsService } from './amazon-accounts.service';
import { AmazonScrapingService } from './amazon-scraping.service';
import { AmazonTrackingQueueService } from './amazon-tracking-queue.service';
import { AmazonVerifyQueueService } from './amazon-verify-queue.service';
import { TrackingConversionService } from './tracking-conversion.service';

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
    private readonly verifyQueueService: AmazonVerifyQueueService,
    private readonly databaseService: DatabaseService,
    private readonly orderSyncService: OrderSyncService,
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly trackingConversion: TrackingConversionService
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
    const account = await this.accountsService.create(req.user.sub, {
      label: dto.label,
      email: dto.email,
      password: dto.password,
      twoFactorSecret: dto.twoFactorSecret,
      marketplace: dto.marketplace,
      autoFulfillEnabled: dto.autoFulfillEnabled,
      autoFulfillCapTotal: dto.autoFulfillCapTotal,
      autoFulfillDryRun: dto.autoFulfillDryRun,
    });
    await this.verifyQueueService.enqueue(req.user.sub, account.id);
    return account;
  }

  @Put('accounts/:id')
  async updateAccount(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAmazonAccountDto
  ): Promise<AmazonAccountPublicDto> {
    const { account, credentialsChanged } = await this.accountsService.update(req.user.sub, id, {
      label: dto.label,
      email: dto.email,
      password: dto.password,
      twoFactorSecret: dto.twoFactorSecret,
      autoFulfillEnabled: dto.autoFulfillEnabled,
      autoFulfillCapTotal: dto.autoFulfillCapTotal,
      autoFulfillDryRun: dto.autoFulfillDryRun,
    });
    if (credentialsChanged) {
      await this.verifyQueueService.enqueue(req.user.sub, id);
    }
    return account;
  }

  @Delete('accounts/:id')
  async deleteAccount(@Req() req: AuthenticatedRequest, @Param('id') id: string): Promise<{ success: boolean }> {
    await this.accountsService.delete(req.user.sub, id);
    return { success: true };
  }

  @Post('accounts/:id/verify')
  async verifyAccount(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string
  ): Promise<{ success: boolean; message: string }> {
    // Mark verifying + enqueue a background login. The account resolves to
    // active/invalid asynchronously (see AmazonVerifyProcessorService).
    await this.accountsService.updateStatus(req.user.sub, id, AmazonAccountStatus.VERIFYING);
    await this.verifyQueueService.enqueue(req.user.sub, id);
    return { success: true, message: 'Verification started' };
  }

  /**
   * Convert this order's tracking number on demand.
   *
   * Lives on the amazon controller rather than orders because the conversion
   * service is an amazon-module concern and the order already carries the
   * Amazon tracking number this acts on.
   */
  @Post('orders/:orderId/convert-tracking')
  async convertTracking(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string
  ): Promise<{ converted: boolean; trackingNumber: string | null; reasonKey: string | null }> {
    const userId = req.user.sub;

    // Ownership first — the conversion service takes an order id and does not
    // itself check who is asking.
    const owned = await this.databaseService.query<{ id: string }>(
      `SELECT id FROM orders WHERE id = $1 AND user_id = $2`,
      [orderId, userId]
    );
    if (owned.length === 0) {
      throw new NotFoundException('orders.errors.notFound');
    }

    return this.trackingConversion.convertOnDemand(orderId);
  }

  /**
   * Start the automatic Amazon purchase for one order by hand — the retry for
   * a purchase that stopped before anything was bought (card declined at the
   * payment step, address, stock, captcha…). The rules live in
   * `canStartAutoFulfillManually` (the same one `OrderDto.canStartAutoFulfill`
   * reports) and `OrderSyncService.startAutoFulfillManually`; ownership is
   * checked there. Every refusal is a 409 carrying an i18n key.
   */
  @Post('orders/:orderId/start-auto-fulfill')
  async startAutoFulfill(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string
  ): Promise<StartAutoFulfillResultDto> {
    const result = await this.orderSyncService.startAutoFulfillManually(req.user.sub, orderId);
    if (!result.ok) {
      if (result.notFound) {
        throw new NotFoundException(result.errorKey);
      }
      throw new ConflictException(result.errorKey);
    }
    return { queued: true, dryRun: result.dryRun };
  }

  @Post('orders/:orderId/link-amazon')
  async linkAmazonOrder(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: LinkAmazonOrderDto
  ): Promise<{
    success: boolean;
    message: string;
    linked?: boolean;
    reason?: 'cost_capture_failed' | 'order_not_found';
  }> {
    const userId = req.user.sub;

    // Verify order ownership
    const orders = await this.databaseService.query<{ id: string; ebay_order_id: string }>(
      `SELECT id, ebay_order_id FROM orders WHERE id = $1 AND user_id = $2`,
      [orderId, userId]
    );

    if (orders.length === 0) {
      return { success: false, message: 'Order not found' };
    }

    // A manual link consumes NO automatic-order quota, by operator decision
    // (2026-09-18). It used to reserve an AO slot, justified by the browser
    // time a linked order goes on to spend (the scrape here, then the per-order
    // tracking scheduler). That justification does not hold: the Playwright
    // pool is our own server capacity, already paid for, not a per-unit charge
    // from anyone. The only third-party cost in this flow is the Aquiline
    // tracking conversion, and that has its own meter. Placing an order by hand
    // is also self-limiting in a way automation is not — it costs the seller
    // real work per order — so it is not the ceiling-evasion route the old
    // comment described. Capacity is handled where capacity belongs:
    // AMAZON_GLOBAL_CONCURRENCY and monitoring.
    //
    // Removing the reservation also closed a real leak. It was idempotent on
    // the eBay order id, so a manual link attempted on an order auto-fulfill
    // had already paid for reserved nothing — but the release on the failure
    // paths below deleted THAT order's slot, handing back quota the seller had
    // legitimately spent.
    //
    // Suspension is still refused. The AO gate reported limit 0 for a suspended
    // account, so it was incidentally the only server-side check on this route;
    // the seller app's redirect keeps a suspended account off the orders page
    // entirely, but a frontend redirect is not a security boundary.
    //
    // `subscriptionSuspendedOrders`, not the listing-specific
    // `subscriptionSuspended`: the same state has to be explained in the words
    // of whatever the seller was trying to do. "New listings are paused" is
    // wrong copy on an order screen.
    if (await this.quotaEnforcement.isSuspended(userId)) {
      throw new ConflictException('billing.errors.subscriptionSuspendedOrders');
    }

    try {
      // Scrape the Amazon order
      const scrapedData = await this.scrapingService.scrapeOrder(
        userId,
        dto.amazonAccountId,
        dto.amazonOrderId.trim()
      );

      // The cost summary could not be read (DOM missing, or every value 0/NaN).
      // The seller NAMED the order, so the link itself must not depend on that
      // (operator decision, 2026-10-01): the manual link is the recovery after
      // a failed automatic purchase, and refusing it left the order unlinked
      // and untracked — and, marked FAILED, outside the automatic cost capture
      // too. So: attach the order and start tracking, write NO cost (never a
      // zero), and leave the order provisional so the 3-hourly cost capture
      // fills the real figures in.
      if (scrapedData.costCaptureFailed) {
        // …but only an order this account really holds. Without the id on the
        // page (mistyped id, wrong account, not the order page) nothing is
        // written and the order keeps its state.
        if (!scrapedData.orderIdOnPage) {
          return { success: false, linked: false, reason: 'order_not_found', message: '' };
        }

        await this.databaseService.query(
          `UPDATE orders SET
            amazon_account_id = $1,
            -- Costs captured for a DIFFERENT Amazon order are not this order's;
            -- a re-link of the same id keeps what it already had.
            amazon_linked_at = CASE WHEN amazon_order_id = $2 THEN amazon_linked_at ELSE NULL END,
            amazon_order_id = $2,
            amazon_tracking_number = COALESCE($3, amazon_tracking_number),
            amazon_tracking_carrier = COALESCE($4, amazon_tracking_carrier),
            amazon_tracking_url = COALESCE($5, amazon_tracking_url),
            amazon_cancelled_at = NULL,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = $6`,
          [
            dto.amazonAccountId,
            scrapedData.amazonOrderId,
            scrapedData.trackingNumber || null,
            scrapedData.trackingCarrier || null,
            scrapedData.trackingUrl || null,
            orderId,
          ]
        );
        await this.orderSyncService.recomputeProfit(orders[0].ebay_order_id);
        await this.trackingQueueService.scheduleOrderTracking(orderId, dto.amazonAccountId);
        if (scrapedData.status === 'shipped') {
          await this.trackingQueueService.triggerImmediateTracking(orderId, dto.amazonAccountId);
        }
        this.logger.warn(
          `Amazon order ${scrapedData.amazonOrderId} linked WITHOUT costs (summary unreadable) — left to cost capture`
        );
        return { success: true, linked: true, reason: 'cost_capture_failed', message: '' };
      }

      // Use first item's price as purchase price (or grand total for single item)
      const purchasePrice = scrapedData.items.length === 1 ? scrapedData.items[0].price : scrapedData.subtotal;

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
          -- Linking a new Amazon order by hand is the recovery the "Amazon
          -- cancelled" stage asks for; the cancelled flag belonged to the OLD
          -- Amazon order and must not keep this one red. Tracking of the new
          -- order re-sets it if Amazon cancels again.
          amazon_cancelled_at = NULL,
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

      // Recompute net_profit + fees + cost_capture_status. The costs UPDATE above
      // set amazon_linked_at, so the recomputer now derives LINKED directly
      // (amazonCostsCaptured = amazonLinked) — even for a legitimate-$0 capture
      // (free shipping + no tax). No force-LINKED UPDATE needed.
      await this.orderSyncService.recomputeProfit(orders[0].ebay_order_id);

      // Start tracking this order
      await this.trackingQueueService.scheduleOrderTracking(orderId, dto.amazonAccountId);

      // If already shipped, trigger immediate tracking check
      if (scrapedData.status === 'shipped') {
        await this.trackingQueueService.triggerImmediateTracking(orderId, dto.amazonAccountId);
      }

      return { success: true, linked: true, message: 'Amazon order linked successfully' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to link Amazon order: ${message}`);
      return { success: false, message };
    }
  }
}
