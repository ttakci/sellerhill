// apps/api/src/modules/amazon/amazon-tracking-html-feed.spec.ts
//
// The recurring ship-track HTML feed (design spec 5.3).
//
// Aquiline derives a shipment's carrier and delivery context from the Amazon
// ship-track page, and wants a fresh copy roughly 1-2x per day while an order
// is in flight. Only the shipped TRANSITION ever uploaded, and
// `shouldApplyStatus` guarantees that runs exactly once — so everything the
// provider knew about a shipment was frozen at the moment it was converted.
//
// The two properties under test are the ones that make this safe to run on
// every tick: it must upload, and it must touch NOTHING else. eBay's
// Fulfillment API has no update endpoint, so a second push would be
// unrecoverable, and rewriting the status would re-open the shipped transition.

import { OrderStatus } from '@repo/shared';
import type { Job } from 'bullmq';

import type { DatabaseService } from '../../common/database/database.service';
import type { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import type { BuyerMessageQueueService } from '../buyer-messaging/buyer-message-queue.service';
import type { EbayService } from '../ebay/ebay.service';
import type { EbayFulfillmentService } from '../orders/ebay-fulfillment.service';

import type { AmazonScrapingService } from './amazon-scraping.service';
import { AmazonTrackingProcessorService } from './amazon-tracking-processor.service';
import type { AmazonTrackingQueueService } from './amazon-tracking-queue.service';
import type { TrackingConversionService } from './tracking-conversion.service';

interface Harness {
  process: (data: { orderId: string; amazonAccountId: string }) => Promise<void>;
  queries: string[];
  refreshTrackingHtml: jest.Mock;
  createShippingFulfillment: jest.Mock;
  resolveForOrder: jest.Mock;
  scheduleOrderTracking: jest.Mock;
  removeOrderTracking: jest.Mock;
}

function buildHarness(options: {
  /** Local order status BEFORE this tick. */
  currentStatus: OrderStatus;
  /** What Amazon reports on this tick. */
  amazonStatus: string;
  trackingUrl?: string;
  trackingHtml?: string;
}): Harness {
  const queries: string[] = [];
  const databaseService = {
    query: jest.fn((sql: string): unknown[] => {
      queries.push(sql);
      if (sql.includes('FROM orders o')) {
        return [
          {
            id: 'order-1',
            user_id: 'user-1',
            ebay_account_id: 'ebay-1',
            ebay_order_id: '12-345-678',
            status: options.currentStatus,
            amazon_order_id: '111-2222222-3333333',
            amazon_account_id: 'amz-1',
            amazon_tracking_number: 'TBA123456789',
            amazon_tracking_carrier: 'Amazon Logistics',
            listing_id: 'listing-1',
            quantity: 1,
            listing_ebay_item_id: '99887766',
            shipped_detected_at: new Date('2026-08-20T00:00:00Z'),
          },
        ];
      }
      if (sql.includes('FROM ebay_accounts')) {
        return [{ id: 'ebay-1', status: 'active' }];
      }
      return [];
    }),
  } as unknown as DatabaseService;

  const scrapingService = {
    scrapeOrderStatusWithTrackingHtml: jest.fn().mockResolvedValue({
      status: options.amazonStatus,
      trackingNumber: 'TBA123456789',
      trackingCarrier: 'Amazon Logistics',
      trackingUrl: options.trackingUrl,
      trackingHtml: options.trackingHtml,
    }),
  } as unknown as AmazonScrapingService;

  const createShippingFulfillment = jest.fn().mockResolvedValue(undefined);
  const ebayFulfillmentService = { createShippingFulfillment } as unknown as EbayFulfillmentService;
  const ebayService = {
    getAccountAccessToken: jest.fn().mockResolvedValue('token'),
  } as unknown as EbayService;

  const scheduleOrderTracking = jest.fn().mockResolvedValue(undefined);
  const removeOrderTracking = jest.fn().mockResolvedValue(undefined);
  const trackingQueueService = {
    scheduleOrderTracking,
    removeOrderTracking,
  } as unknown as AmazonTrackingQueueService;

  const buyerMessages = {
    enqueue: jest.fn().mockResolvedValue(undefined),
  } as unknown as BuyerMessageQueueService;

  const platformSettings = {
    getNumber: jest.fn().mockResolvedValue(3),
  } as unknown as PlatformSettingsService;

  const refreshTrackingHtml = jest.fn().mockResolvedValue(true);
  const resolveForOrder = jest.fn();
  const trackingConversion = {
    refreshTrackingHtml,
    resolveForOrder,
  } as unknown as TrackingConversionService;

  const processor = new AmazonTrackingProcessorService(
    scrapingService,
    databaseService,
    ebayService,
    ebayFulfillmentService,
    trackingQueueService,
    buyerMessages,
    platformSettings,
    trackingConversion,
  );

  return {
    process: (data) => processor.process({ name: 'track-amazon-order', data } as unknown as Job),
    queries,
    refreshTrackingHtml,
    createShippingFulfillment,
    resolveForOrder,
    scheduleOrderTracking,
    removeOrderTracking,
  };
}

describe('AmazonTrackingProcessorService — recurring ship-track HTML feed', () => {
  it('uploads fresh HTML for an ALREADY-SHIPPED order without touching eBay or the status', async () => {
    const h = buildHarness({
      currentStatus: OrderStatus.SHIPPED,
      amazonStatus: 'shipped',
      trackingUrl: 'https://www.amazon.com/progress-tracker/package/?orderId=1&packageIndex=0',
      trackingHtml: '<html>ship-track</html>',
    });

    await h.process({ orderId: 'order-1', amazonAccountId: 'amz-1' });

    // 1. The provider's copy is refreshed.
    expect(h.refreshTrackingHtml).toHaveBeenCalledTimes(1);
    expect(h.refreshTrackingHtml).toHaveBeenCalledWith({
      orderId: 'order-1',
      trackingUrl: 'https://www.amazon.com/progress-tracker/package/?orderId=1&packageIndex=0',
      trackingHtml: '<html>ship-track</html>',
    });

    // 2. eBay is NOT touched. Its Fulfillment API has no update endpoint, so a
    //    second push on a routine tick would be unrecoverable for the buyer.
    expect(h.createShippingFulfillment).not.toHaveBeenCalled();

    // 3. No conversion is re-run — a conversion is billed, and this order
    //    already has a number the buyer was given.
    expect(h.resolveForOrder).not.toHaveBeenCalled();

    // 4. The order's status is not rewritten. `shouldApplyStatus` blocks the
    //    no-op SHIPPED -> SHIPPED write, and re-writing it would re-open the
    //    shipped transition on a later tick.
    expect(h.queries.some((sql) => sql.includes('SET status = $1'))).toBe(false);
  });

  it('uploads a final copy on the delivered transition, still without pushing to eBay', async () => {
    const h = buildHarness({
      currentStatus: OrderStatus.SHIPPED,
      amazonStatus: 'delivered',
      trackingUrl: 'https://www.amazon.com/progress-tracker/package/?orderId=1&packageIndex=0',
      trackingHtml: '<html>delivered</html>',
    });

    await h.process({ orderId: 'order-1', amazonAccountId: 'amz-1' });

    expect(h.refreshTrackingHtml).toHaveBeenCalledTimes(1);
    expect(h.createShippingFulfillment).not.toHaveBeenCalled();
    // The delivered transition DOES advance the status and stop polling.
    expect(h.queries.some((sql) => sql.includes('SET status = $1'))).toBe(true);
    expect(h.removeOrderTracking).toHaveBeenCalledWith('order-1');
  });

  it('does not upload when the scrape captured no HTML', async () => {
    const h = buildHarness({
      currentStatus: OrderStatus.SHIPPED,
      amazonStatus: 'shipped',
      trackingUrl: 'https://www.amazon.com/progress-tracker/package/?orderId=1&packageIndex=0',
    });

    await h.process({ orderId: 'order-1', amazonAccountId: 'amz-1' });

    expect(h.refreshTrackingHtml).not.toHaveBeenCalled();
  });

  it('does not upload on the shipped transition — handleShipped already did', async () => {
    // previousStatus is pre-ship, so the conversion path runs and uploads the
    // HTML itself as step 4 of the sequence. A second upload here would be a
    // duplicate on the one tick that is already doing the work.
    const h = buildHarness({
      currentStatus: OrderStatus.WAITING_SHIPMENT,
      amazonStatus: 'shipped',
      trackingUrl: 'https://www.amazon.com/progress-tracker/package/?orderId=1&packageIndex=0',
      trackingHtml: '<html>ship-track</html>',
    });
    h.resolveForOrder.mockResolvedValue({
      trackingNumber: 'AQUAA1234567890YQ',
      shippingCarrierCode: 'AQUILINE',
      shipmentId: null,
      outcome: 'converted',
    });

    await h.process({ orderId: 'order-1', amazonAccountId: 'amz-1' });

    expect(h.resolveForOrder).toHaveBeenCalledTimes(1);
    expect(h.refreshTrackingHtml).not.toHaveBeenCalled();
    expect(h.createShippingFulfillment).toHaveBeenCalledTimes(1);
  });
});

describe('AmazonTrackingProcessorService — ship-track URL persistence', () => {
  it('stores the scraped ship-track URL so convertOnDemand can recover later', async () => {
    // `orders.amazon_tracking_url` was only ever written by the MANUAL link
    // path, so for an auto-fulfilled order it stayed NULL — and
    // `convertOnDemand`, whose only source for the URL `assign` requires is
    // that column, refused with `conversionUnavailable` on exactly the orders
    // a failed conversion needs to be recovered on.
    const h = buildHarness({
      currentStatus: OrderStatus.SHIPPED,
      amazonStatus: 'shipped',
      trackingUrl: 'https://www.amazon.com/progress-tracker/package/?orderId=1&packageIndex=0',
      trackingHtml: '<html>ship-track</html>',
    });

    await h.process({ orderId: 'order-1', amazonAccountId: 'amz-1' });

    expect(h.queries.some((sql) => sql.includes('amazon_tracking_url = $1'))).toBe(true);
  });

  it('writes nothing when the scrape produced no trusted tracking URL', async () => {
    const h = buildHarness({ currentStatus: OrderStatus.SHIPPED, amazonStatus: 'shipped' });

    await h.process({ orderId: 'order-1', amazonAccountId: 'amz-1' });

    expect(h.queries.some((sql) => sql.includes('amazon_tracking_url = $1'))).toBe(false);
  });
});
