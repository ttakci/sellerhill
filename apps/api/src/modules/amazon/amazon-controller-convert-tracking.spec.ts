import type { DatabaseService } from '../../common/database/database.service';
import type { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import type { OrderSyncService } from '../orders/order-sync.service';

import type { AmazonAccountsService } from './amazon-accounts.service';
import type { AmazonScrapingService } from './amazon-scraping.service';
import type { AmazonTrackingQueueService } from './amazon-tracking-queue.service';
import type { AmazonVerifyQueueService } from './amazon-verify-queue.service';
import { AmazonController } from './amazon.controller';
import type { TrackingConversionService } from './tracking-conversion.service';

/**
 * "Takibi dönüştür" must not leave the seller waiting up to a full tracking
 * interval for eBay: a successful on-demand conversion queues an immediate
 * tracking tick, which is the ONLY path that pushes to eBay (and the path
 * where `mayPushToEbay` refuses a raw number). Nothing here pushes directly.
 */
describe('AmazonController.convertTracking — immediate tick after a conversion', () => {
  const req = { user: { sub: 'user-1' } } as never;

  function build(opts: {
    ownedRow?: { id: string; amazon_account_id: string | null };
    convert: { converted: boolean; trackingNumber: string | null; reasonKey: string | null };
    triggerRejects?: boolean;
  }) {
    const query = jest.fn().mockResolvedValue(opts.ownedRow ? [opts.ownedRow] : []);
    const triggerImmediateTracking = jest.fn(() =>
      opts.triggerRejects ? Promise.reject(new Error('redis down')) : Promise.resolve()
    );
    const convertOnDemand = jest.fn().mockResolvedValue(opts.convert);
    const controller = new AmazonController(
      {} as AmazonAccountsService,
      {} as AmazonScrapingService,
      { triggerImmediateTracking } as unknown as AmazonTrackingQueueService,
      {} as AmazonVerifyQueueService,
      { query } as unknown as DatabaseService,
      {} as OrderSyncService,
      {} as QuotaEnforcementService,
      { convertOnDemand } as unknown as TrackingConversionService
    );
    return { controller, triggerImmediateTracking, convertOnDemand };
  }

  it('queues an immediate tracking tick for the order once the conversion is stored', async () => {
    const { controller, triggerImmediateTracking } = build({
      ownedRow: { id: 'order-1', amazon_account_id: 'acc-1' },
      convert: { converted: true, trackingNumber: 'AQUA123456789YQ', reasonKey: null },
    });
    const result = await controller.convertTracking(req, 'order-1');
    expect(result.converted).toBe(true);
    expect(triggerImmediateTracking).toHaveBeenCalledWith('order-1', 'acc-1');
  });

  it('queues nothing when the conversion did not happen — there is no converted number to push', async () => {
    const { controller, triggerImmediateTracking } = build({
      ownedRow: { id: 'order-1', amazon_account_id: 'acc-1' },
      convert: { converted: false, trackingNumber: null, reasonKey: 'orders.errors.noTrackingYet' },
    });
    await controller.convertTracking(req, 'order-1');
    expect(triggerImmediateTracking).not.toHaveBeenCalled();
  });

  it('queues nothing for an order with no Amazon account — the tick could not scrape anything', async () => {
    const { controller, triggerImmediateTracking } = build({
      ownedRow: { id: 'order-1', amazon_account_id: null },
      convert: { converted: true, trackingNumber: 'AQUA123456789YQ', reasonKey: null },
    });
    await controller.convertTracking(req, 'order-1');
    expect(triggerImmediateTracking).not.toHaveBeenCalled();
  });

  it('still reports the conversion when the queue is unavailable — the number is stored, the next tick pushes it', async () => {
    const { controller } = build({
      ownedRow: { id: 'order-1', amazon_account_id: 'acc-1' },
      convert: { converted: true, trackingNumber: 'AQUA123456789YQ', reasonKey: null },
      triggerRejects: true,
    });
    await expect(controller.convertTracking(req, 'order-1')).resolves.toEqual({
      converted: true,
      trackingNumber: 'AQUA123456789YQ',
      reasonKey: null,
    });
  });
});
