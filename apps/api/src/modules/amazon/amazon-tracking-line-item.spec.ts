// apps/api/src/modules/amazon/amazon-tracking-line-item.spec.ts
//
// The eBay shipping fulfillment names the order LINE ITEM (`lineItems[].
// lineItemId` of getOrders — "the unique identifier of an eBay order line
// item"), not the listing. The first live conversion (03-15243-67997,
// 2026-09-30) sent the listing's legacy item id (`206589552637`) and eBay
// answered 400 "Invalid line item id", so the paid AQUA number never
// reached the buyer. Migration 131 stores the id at order sync; an order
// ingested before it is completed with one `getOrder` read at push time.

import { OrderStatus } from '@repo/shared';
import type { Job } from 'bullmq';

import type { DatabaseService } from '../../common/database/database.service';
import type { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import type { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import type { BuyerMessageQueueService } from '../buyer-messaging/buyer-message-queue.service';
import type { EbayService } from '../ebay/ebay.service';
import type { EbayFulfillmentService } from '../orders/ebay-fulfillment.service';

import type { AmazonScrapingService } from './amazon-scraping.service';
import { AmazonTrackingProcessorService } from './amazon-tracking-processor.service';
import type { AmazonTrackingQueueService } from './amazon-tracking-queue.service';
import type { TrackingConversionService } from './tracking-conversion.service';

const LISTING_ITEM_ID = '206589552637';

type PushCall = [accessToken: string, ebayOrderId: string, lineItemId: string, quantity: number, options?: unknown];

function pushCalls(h: { createShippingFulfillment: jest.Mock }): PushCall[] {
  return h.createShippingFulfillment.mock.calls as unknown as PushCall[];
}

function buildHarness(options: {
  storedLineItemId: string | null;
  fetchedOrder?: { lineItems?: Array<{ lineItemId?: string; legacyItemId?: string }> } | null;
  /** What eBay's getShippingFulfillments answers (default: none exist). */
  existingFulfillments?: Array<{
    fulfillmentId?: string;
    lineItems?: Array<{ lineItemId?: string }>;
    shipmentTrackingNumber?: string;
  }>;
  /** Make the fulfillment read fail (transport). */
  fulfillmentReadFails?: boolean;
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
            ebay_account_id: 'ebay-1',
            ebay_order_id: '03-15243-67997',
            status: OrderStatus.WAITING_SHIPMENT,
            amazon_order_id: '113-0158186-6357035',
            amazon_account_id: 'amz-1',
            amazon_tracking_number: 'TBA335065888809',
            amazon_tracking_carrier: 'Amazon Logistics',
            listing_id: 'listing-1',
            quantity: 1,
            listing_ebay_item_id: LISTING_ITEM_ID,
            ebay_line_item_id: options.storedLineItemId,
            shipped_detected_at: null,
          },
        ];
      }
      if (sql.includes('FROM ebay_accounts')) {
        return [{ id: 'ebay-1', status: 'active', marketplace_id: 'EBAY_US' }];
      }
      if (sql.includes('RETURNING shipped_detected_at')) {
        return [{ shipped_detected_at: new Date('2026-09-30T21:40:53Z') }];
      }
      return [];
    }),
  } as unknown as DatabaseService;

  const scrapingService = {
    scrapeOrderStatusWithTrackingHtml: jest.fn().mockResolvedValue({
      status: 'shipped',
      trackingNumber: 'TBA335065888809',
      trackingCarrier: 'Amazon Logistics',
      trackingUrl: 'https://www.amazon.com/progress-tracker/package/?orderId=1&packageIndex=0',
      trackingHtml: '<html>ship-track</html>',
    }),
  } as unknown as AmazonScrapingService;

  const createShippingFulfillment = jest.fn().mockResolvedValue('fulfillment-1');
  const fetchOrderById = jest.fn().mockResolvedValue(options.fetchedOrder ?? null);
  const fetchShippingFulfillments = options.fulfillmentReadFails
    ? jest.fn().mockRejectedValue(new Error('ETIMEDOUT'))
    : jest.fn().mockResolvedValue(options.existingFulfillments ?? []);
  const ebayFulfillmentService = {
    createShippingFulfillment,
    fetchOrderById,
    fetchShippingFulfillments,
  } as unknown as EbayFulfillmentService;
  const ebayService = {
    getAccountAccessToken: jest.fn().mockResolvedValue('token'),
  } as unknown as EbayService;
  const trackingQueueService = {
    scheduleOrderTracking: jest.fn().mockResolvedValue(undefined),
    removeOrderTracking: jest.fn().mockResolvedValue(undefined),
    updateSchedulerInterval: jest.fn().mockResolvedValue(undefined),
  } as unknown as AmazonTrackingQueueService;
  const buyerMessages = { enqueue: jest.fn().mockResolvedValue(undefined) } as unknown as BuyerMessageQueueService;
  const platformSettings = { getNumber: jest.fn().mockResolvedValue(3) } as unknown as PlatformSettingsService;
  const resolveForOrder = jest.fn().mockResolvedValue({
    trackingNumber: 'AQUAA0359110926YQ',
    shippingCarrierCode: 'AQUILINE',
    shipmentId: null,
    outcome: 'converted',
  });
  const trackingConversion = {
    refreshTrackingHtml: jest.fn().mockResolvedValue(true),
    resolveForOrder,
  } as unknown as TrackingConversionService;
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
    queries,
    createShippingFulfillment,
    fetchOrderById,
    fetchShippingFulfillments,
    resolveForOrder,
  };
}

describe('AmazonTrackingProcessorService — the eBay push names the order LINE ITEM', () => {
  it('sends the stored order line item id, never the listing item id', async () => {
    const h = buildHarness({ storedLineItemId: '10-12345-67890' });

    await h.process();

    expect(h.createShippingFulfillment).toHaveBeenCalledTimes(1);
    const [, ebayOrderId, lineItemId] = pushCalls(h)[0];
    expect(ebayOrderId).toBe('03-15243-67997');
    expect(lineItemId).toBe('10-12345-67890');
    expect(lineItemId).not.toBe(LISTING_ITEM_ID);
    expect(h.fetchOrderById).not.toHaveBeenCalled();
  });

  it('completes an order ingested before migration 131 with one getOrder read, and remembers it', async () => {
    const h = buildHarness({
      storedLineItemId: null,
      fetchedOrder: { lineItems: [{ lineItemId: '10-99999-11111', legacyItemId: LISTING_ITEM_ID }] },
    });

    await h.process();

    expect(h.fetchOrderById).toHaveBeenCalledWith('token', 'EBAY_US', '03-15243-67997');
    expect(h.createShippingFulfillment).toHaveBeenCalledTimes(1);
    expect(pushCalls(h)[0][2]).toBe('10-99999-11111');
    const remembered = h.queries.find((q) => q.sql.includes('ebay_line_item_id = $1'));
    expect(remembered?.params).toEqual(['10-99999-11111', 'order-1']);
  });

  it('pushes nothing when eBay reports no line item — the listing id is never used as a substitute', async () => {
    const h = buildHarness({ storedLineItemId: null, fetchedOrder: { lineItems: [] } });

    await h.process().catch(() => undefined);

    expect(h.createShippingFulfillment).not.toHaveBeenCalled();
  });
});

// A fulfillment is a POST with no idempotency key and no update endpoint, and
// the push is retried on every tick until it is recorded. eBay is asked what
// it already holds first, so a request that timed out after eBay accepted it,
// a local write that failed after a successful POST, or a seller who marked
// the order shipped by hand never produces a second fulfillment.
describe('AmazonTrackingProcessorService — the eBay fulfillment is read before it is written', () => {
  it('posts when eBay holds no fulfillment for the line item', async () => {
    const h = buildHarness({ storedLineItemId: '10-12345-67890' });

    await h.process();

    expect(h.fetchShippingFulfillments).toHaveBeenCalledWith('token', '03-15243-67997');
    expect(h.createShippingFulfillment).toHaveBeenCalledTimes(1);
  });

  it('records an existing fulfillment and neither converts nor posts again', async () => {
    const h = buildHarness({
      storedLineItemId: '10-12345-67890',
      existingFulfillments: [
        {
          fulfillmentId: 'f-1',
          lineItems: [{ lineItemId: '10-12345-67890' }],
          shipmentTrackingNumber: 'AQUAA0359110926YQ',
        },
      ],
    });

    await h.process();

    expect(h.createShippingFulfillment).not.toHaveBeenCalled();
    // No paid conversion for a shipment eBay already has.
    expect(h.resolveForOrder).not.toHaveBeenCalled();
    const recorded = h.queries.find((q) => q.sql.includes('ebay_tracking_pushed_number = COALESCE'));
    expect(recorded?.params).toEqual(['AQUAA0359110926YQ', 'order-1']);
  });

  it('posts when the only fulfillment belongs to another line item', async () => {
    const h = buildHarness({
      storedLineItemId: '10-12345-67890',
      existingFulfillments: [{ fulfillmentId: 'f-1', lineItems: [{ lineItemId: 'another-line' }] }],
    });

    await h.process();

    expect(h.createShippingFulfillment).toHaveBeenCalledTimes(1);
  });

  it('posts nothing when the read fails — "could not read" is not "none"', async () => {
    const h = buildHarness({ storedLineItemId: '10-12345-67890', fulfillmentReadFails: true });

    await h.process().catch(() => undefined);

    expect(h.createShippingFulfillment).not.toHaveBeenCalled();
    expect(h.resolveForOrder).not.toHaveBeenCalled();
  });
});
