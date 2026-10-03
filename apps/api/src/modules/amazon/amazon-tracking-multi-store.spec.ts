// apps/api/src/modules/amazon/amazon-tracking-multi-store.spec.ts
//
// A shipped order whose eBay store is not ACTIVE (disconnected, revoked) used
// to be settled as "permanently unpushable": the local status became SHIPPED,
// the scheduler moved to the shipped cadence, and because SHIPPED -> SHIPPED is
// never a status change, the push was never tried again — not even after the
// seller reconnected the store. The same stranding hit an order whose held
// conversion outlived the fast-retry window. Two rules now hold:
//
//   1. a push that cannot be made YET (store not active, order not visible to
//      the store, conversion held) is a HOLD — no status write, scheduler
//      re-armed, retried — and the store is checked before any paid
//      conversion;
//   2. every tick on a SHIPPED order eBay never received tracking for runs the
//      push again. Safe: eBay is read before it is written, and a conversion
//      is persisted, so a re-run never posts twice or buys a second number.

import { OrderStatus } from '@repo/shared';
import type { Job } from 'bullmq';

import type { DatabaseService } from '../../common/database/database.service';
import type { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import type { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import type { BuyerMessageQueueService } from '../buyer-messaging/buyer-message-queue.service';
import type { EbayService } from '../ebay/ebay.service';
import { EbayOrderNotVisibleError, type EbayFulfillmentService } from '../orders/ebay-fulfillment.service';

import type { AmazonScrapingService } from './amazon-scraping.service';
import { AmazonTrackingProcessorService } from './amazon-tracking-processor.service';
import type { AmazonTrackingQueueService } from './amazon-tracking-queue.service';
import type { TrackingConversionService } from './tracking-conversion.service';
import { DEFERRAL_RETRY_INTERVAL_HOURS } from './tracking-deferral';

function buildHarness(options: {
  currentStatus: OrderStatus;
  amazonStatus: string;
  /** `null` = the ebay_accounts row does not exist. */
  accountStatus: string | null;
  pushedAt?: Date | null;
  shippedDetectedAt?: Date | null;
  fulfillmentRead?: 'none' | 'not_visible';
  conversionOutcome?: string;
}) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const databaseService = {
    query: jest.fn((sql: string, params: unknown[] = []): unknown[] => {
      queries.push({ sql, params });
      if (sql.includes('FROM orders o')) {
        return [
          {
            id: 'order-1',
            user_id: 'user-1',
            ebay_account_id: 'ebay-2',
            ebay_order_id: '03-15243-67997',
            status: options.currentStatus,
            amazon_order_id: '113-0158186-6357035',
            amazon_account_id: 'amz-1',
            amazon_tracking_number: 'TBA335065888809',
            amazon_tracking_carrier: 'Amazon Logistics',
            listing_id: 'listing-1',
            quantity: 1,
            listing_ebay_item_id: '206589552637',
            ebay_line_item_id: '10-12345-67890',
            shipped_detected_at: options.shippedDetectedAt ?? null,
            ebay_tracking_pushed_at: options.pushedAt ?? null,
            listing_over_plan_limit: false,
          },
        ];
      }
      if (sql.includes('FROM ebay_accounts')) {
        return options.accountStatus === null
          ? []
          : [{ id: 'ebay-2', status: options.accountStatus, marketplace_id: 'EBAY_US' }];
      }
      if (sql.includes('RETURNING shipped_detected_at')) {
        return [{ shipped_detected_at: options.shippedDetectedAt ?? new Date() }];
      }
      return [];
    }),
  } as unknown as DatabaseService;

  const scrapingService = {
    scrapeOrderStatusWithTrackingHtml: jest.fn().mockResolvedValue({
      status: options.amazonStatus,
      trackingNumber: 'TBA335065888809',
      trackingCarrier: 'Amazon Logistics',
      trackingUrl: 'https://www.amazon.com/progress-tracker/package/?orderId=1&packageIndex=0',
      trackingHtml: '<html>ship-track</html>',
    }),
  } as unknown as AmazonScrapingService;

  const createShippingFulfillment = jest.fn().mockResolvedValue('fulfillment-1');
  const fetchShippingFulfillments =
    options.fulfillmentRead === 'not_visible'
      ? jest.fn().mockRejectedValue(new EbayOrderNotVisibleError('03-15243-67997'))
      : jest.fn().mockResolvedValue([]);
  const ebayFulfillmentService = {
    createShippingFulfillment,
    fetchShippingFulfillments,
    fetchOrderById: jest.fn().mockResolvedValue(null),
  } as unknown as EbayFulfillmentService;
  const getAccountAccessToken = jest.fn().mockResolvedValue('token');
  const ebayService = { getAccountAccessToken } as unknown as EbayService;
  const scheduleOrderTracking = jest.fn().mockResolvedValue(undefined);
  const removeOrderTracking = jest.fn().mockResolvedValue(undefined);
  const trackingQueueService = {
    scheduleOrderTracking,
    removeOrderTracking,
  } as unknown as AmazonTrackingQueueService;
  const enqueue = jest.fn().mockResolvedValue(undefined);
  const buyerMessages = { enqueue } as unknown as BuyerMessageQueueService;
  const platformSettings = { getNumber: jest.fn().mockResolvedValue(3) } as unknown as PlatformSettingsService;
  const resolveForOrder = jest.fn().mockResolvedValue({
    trackingNumber: 'AQUAA0359110926YQ',
    shippingCarrierCode: 'AQUILINE',
    shipmentId: null,
    outcome: options.conversionOutcome ?? 'converted',
  });
  const refreshTrackingHtml = jest.fn().mockResolvedValue(true);
  const trackingConversion = { resolveForOrder, refreshTrackingHtml } as unknown as TrackingConversionService;
  const quotaEnforcement = { isSuspended: jest.fn().mockResolvedValue(false) } as unknown as QuotaEnforcementService;

  const processor = new AmazonTrackingProcessorService(
    scrapingService,
    databaseService,
    ebayService,
    ebayFulfillmentService,
    trackingQueueService,
    buyerMessages,
    platformSettings,
    trackingConversion,
    quotaEnforcement
  );

  return {
    process: () =>
      processor.process({
        name: 'track-amazon-order',
        data: { orderId: 'order-1', amazonAccountId: 'amz-1' },
      } as unknown as Job),
    statusWrites: () => queries.filter((q) => q.sql.includes('SET status = $1')),
    createShippingFulfillment,
    fetchShippingFulfillments,
    getAccountAccessToken,
    resolveForOrder,
    scheduleOrderTracking,
    removeOrderTracking,
    enqueue,
  };
}

describe('AmazonTrackingProcessorService — a store that is not active is a HOLD, not a settlement', () => {
  it('converts nothing, posts nothing and keeps the order pre-ship so a later tick retries', async () => {
    const h = buildHarness({
      currentStatus: OrderStatus.WAITING_SHIPMENT,
      amazonStatus: 'shipped',
      accountStatus: 'disconnected',
    });

    await h.process();

    // No paid conversion while the store cannot receive the push.
    expect(h.resolveForOrder).not.toHaveBeenCalled();
    expect(h.getAccountAccessToken).not.toHaveBeenCalled();
    expect(h.createShippingFulfillment).not.toHaveBeenCalled();
    // Not settled as shipped: the next tick is still a shipped transition.
    expect(h.statusWrites()).toHaveLength(0);
    // Re-armed at the normal shipped cadence (a reconnect can take days; an
    // hourly Playwright scrape for it would be waste).
    expect(h.scheduleOrderTracking).toHaveBeenCalledWith('order-1', 'amz-1', OrderStatus.SHIPPED);
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it('does not complete a delivered order whose store is not active — it still owes eBay tracking', async () => {
    const h = buildHarness({
      currentStatus: OrderStatus.WAITING_SHIPMENT,
      amazonStatus: 'delivered',
      accountStatus: 'revoked',
    });

    await h.process();

    expect(h.createShippingFulfillment).not.toHaveBeenCalled();
    expect(h.statusWrites()).toHaveLength(0);
    expect(h.removeOrderTracking).not.toHaveBeenCalled();
  });

  it('settles an order whose store row no longer exists (permanent — retrying changes nothing)', async () => {
    const h = buildHarness({
      currentStatus: OrderStatus.WAITING_SHIPMENT,
      amazonStatus: 'shipped',
      accountStatus: null,
    });

    await h.process();

    expect(h.resolveForOrder).not.toHaveBeenCalled();
    expect(h.createShippingFulfillment).not.toHaveBeenCalled();
    expect(h.statusWrites().map((q) => q.params[0])).toEqual([OrderStatus.SHIPPED]);
  });
});

describe('AmazonTrackingProcessorService — a SHIPPED order eBay never got tracking for is pushed again', () => {
  it('pushes on a routine SHIPPED tick once the store is active again (reconnect)', async () => {
    const h = buildHarness({
      currentStatus: OrderStatus.SHIPPED,
      amazonStatus: 'shipped',
      accountStatus: 'active',
      pushedAt: null,
      shippedDetectedAt: new Date(Date.now() - 3 * 86_400_000),
    });

    await h.process();

    expect(h.fetchShippingFulfillments).toHaveBeenCalledWith('token', '03-15243-67997', 'EBAY_US');
    expect(h.createShippingFulfillment).toHaveBeenCalledTimes(1);
    // SHIPPED -> SHIPPED is still not a status write.
    expect(h.statusWrites()).toHaveLength(0);
    // The buyer was never told it shipped; now eBay has the tracking, so they are.
    expect(h.enqueue).toHaveBeenCalledWith(expect.objectContaining({ event: 'shipped' }), undefined);
  });

  it('does nothing on a SHIPPED tick once eBay has received the tracking', async () => {
    const h = buildHarness({
      currentStatus: OrderStatus.SHIPPED,
      amazonStatus: 'shipped',
      accountStatus: 'active',
      pushedAt: new Date(),
    });

    await h.process();

    expect(h.fetchShippingFulfillments).not.toHaveBeenCalled();
    expect(h.resolveForOrder).not.toHaveBeenCalled();
    expect(h.createShippingFulfillment).not.toHaveBeenCalled();
  });

  it('retries a held conversion on a SHIPPED order instead of stranding it', async () => {
    const h = buildHarness({
      currentStatus: OrderStatus.SHIPPED,
      amazonStatus: 'shipped',
      accountStatus: 'active',
      pushedAt: null,
      shippedDetectedAt: new Date(Date.now() - 2 * 3_600_000),
      conversionOutcome: 'passthrough_retryable',
    });

    await h.process();

    expect(h.resolveForOrder).toHaveBeenCalledTimes(1);
    expect(h.createShippingFulfillment).not.toHaveBeenCalled();
    // Inside the window: the fast retry cadence.
    expect(h.scheduleOrderTracking).toHaveBeenCalledWith(
      'order-1',
      'amz-1',
      OrderStatus.SHIPPED,
      DEFERRAL_RETRY_INTERVAL_HOURS
    );
  });

  it('pushes before completing a delivered order eBay never got tracking for', async () => {
    const h = buildHarness({
      currentStatus: OrderStatus.SHIPPED,
      amazonStatus: 'delivered',
      accountStatus: 'active',
      pushedAt: null,
    });

    await h.process();

    expect(h.createShippingFulfillment).toHaveBeenCalledTimes(1);
    expect(h.statusWrites().map((q) => q.params[0])).toEqual([OrderStatus.COMPLETED]);
  });
});

describe('AmazonTrackingProcessorService — a conversion held past the fast window is still retried', () => {
  it('keeps the order pre-ship and re-arms at the shipped cadence', async () => {
    const h = buildHarness({
      currentStatus: OrderStatus.WAITING_SHIPMENT,
      amazonStatus: 'shipped',
      accountStatus: 'active',
      shippedDetectedAt: new Date(Date.now() - 2 * 86_400_000),
      conversionOutcome: 'passthrough_failed',
    });

    await h.process();

    expect(h.createShippingFulfillment).not.toHaveBeenCalled();
    expect(h.statusWrites()).toHaveLength(0);
    expect(h.scheduleOrderTracking).toHaveBeenCalledWith('order-1', 'amz-1', OrderStatus.SHIPPED);
  });
});

describe('AmazonTrackingProcessorService — an order the store cannot see is held before any conversion', () => {
  it('buys no conversion and posts nothing when eBay does not know the order under this store', async () => {
    const h = buildHarness({
      currentStatus: OrderStatus.WAITING_SHIPMENT,
      amazonStatus: 'shipped',
      accountStatus: 'active',
      fulfillmentRead: 'not_visible',
    });

    await h.process();

    expect(h.resolveForOrder).not.toHaveBeenCalled();
    expect(h.createShippingFulfillment).not.toHaveBeenCalled();
    expect(h.statusWrites()).toHaveLength(0);
    expect(h.scheduleOrderTracking).toHaveBeenCalledWith('order-1', 'amz-1', OrderStatus.SHIPPED);
  });
});
