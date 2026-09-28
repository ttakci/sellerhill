import { EbayMarketplaceId, type ListingCreationData } from '@repo/shared';

import type { AspectResolution } from './aspect-builder';
import type { EbayBulkResponseEntry } from './ebay-bulk.helpers';
import { EbayBulkService, type BulkListingDraft } from './ebay-bulk.service';

/**
 * The bulk create's per-entry recovery, run against faked eBay answers.
 *
 * Only `postBulk` (the network) and the two single-offer helpers are stubbed;
 * the staging, correlation and retry decisions are the real code.
 */

const SYSTEM_ERROR = { errorId: 25001, message: 'A system error has occurred. Core Inventory Service internal error' };

function draft(key: string, sku: string): BulkListingDraft {
  return {
    key,
    asin: sku,
    sku,
    data: {
      title: 'Widget',
      description: '<p>d</p>',
      brand: 'Acme',
      price: 20,
      quantity: 2,
      imageUrls: ['https://i.ebayimg.com/00/s/MTAwMFgxMDAw/z/a/$_1.JPG'],
    } as unknown as ListingCreationData,
    policies: { paymentId: 'P', shippingId: 'S', returnId: 'R' },
    categoryId: '123',
    categoryName: 'Widgets',
    categoryAspects: [],
    resolution: { aspects: {} } as unknown as AspectResolution,
  };
}

type Answer = (requests: Array<Record<string, unknown>>, call: number) => EbayBulkResponseEntry[];

function service(answers: { item?: Answer; offer?: Answer; publish?: Answer }) {
  const svc = new EbayBulkService(
    { get: () => 'https://api.test' } as never,
    {
      getAccountApiContext: () =>
        Promise.resolve({ accessToken: 't', marketplaceId: EbayMarketplaceId.EBAY_US, contentLanguage: 'en-US' }),
    } as never,
    { acquire: () => Promise.resolve() } as never,
    { recordPublishSuccess: () => undefined, recordAspectRejection: () => undefined } as never
  );
  const calls: Record<string, number> = {};
  const ok = {
    item: ((reqs) => reqs.map((r) => ({ statusCode: 200, sku: String(r.sku) }))) as Answer,
    offer: ((reqs) => reqs.map((r) => ({ statusCode: 201, sku: String(r.sku), offerId: `O-${String(r.sku)}` }))) as Answer,
    publish: ((reqs) =>
      reqs.map((r) => ({ statusCode: 200, offerId: String(r.offerId), listingId: `L-${String(r.offerId)}` }))) as Answer,
  };
  const route: Record<string, keyof typeof ok> = {
    bulk_create_or_replace_inventory_item: 'item',
    bulk_create_offer: 'offer',
    bulk_publish_offer: 'publish',
  };
  const target = svc as unknown as Record<string, unknown>;
  target.postBulk = (_ctx: unknown, path: string, body: { requests: Array<Record<string, unknown>> }) => {
    const stage = route[path];
    calls[stage] = (calls[stage] ?? 0) + 1;
    return Promise.resolve((answers[stage] ?? ok[stage])(body.requests, calls[stage]));
  };
  target.deleteOffer = () => Promise.resolve();
  target.refreshOffer = () => Promise.resolve();
  return { svc, calls };
}

describe('EbayBulkService.createListings — eBay system errors', () => {
  it('replays an item eBay failed with a transient system error at the inventory stage', async () => {
    const { svc, calls } = service({
      item: (reqs, call) =>
        reqs.map((r) =>
          call === 1 ? { statusCode: 500, sku: String(r.sku), errors: [SYSTEM_ERROR] } : { statusCode: 200, sku: String(r.sku) }
        ),
    });
    const [outcome] = await svc.createListings('acct', 'loc', [draft('k1', 'SKU1')]);
    expect(outcome).toMatchObject({ key: 'k1', ok: true, listingId: 'L-O-SKU1' });
    expect(calls.item).toBe(2);
  });

  it('replays a system error at the offer stage', async () => {
    const { svc } = service({
      offer: (reqs, call) =>
        reqs.map((r) =>
          call === 1
            ? { statusCode: 500, sku: String(r.sku), errors: [SYSTEM_ERROR] }
            : { statusCode: 201, sku: String(r.sku), offerId: `O-${String(r.sku)}` }
        ),
    });
    const [outcome] = await svc.createListings('acct', 'loc', [draft('k1', 'SKU1')]);
    expect(outcome).toMatchObject({ ok: true, listingId: 'L-O-SKU1' });
  });

  it('replays a system error at the publish stage', async () => {
    const { svc } = service({
      publish: (reqs, call) =>
        reqs.map((r) =>
          call === 1
            ? { statusCode: 500, offerId: String(r.offerId), errors: [SYSTEM_ERROR] }
            : { statusCode: 200, offerId: String(r.offerId), listingId: `L-${String(r.offerId)}` }
        ),
    });
    const [outcome] = await svc.createListings('acct', 'loc', [draft('k1', 'SKU1')]);
    expect(outcome).toMatchObject({ ok: true, listingId: 'L-O-SKU1' });
  });

  it('a system error that persists ends with eBay’s own error, not "publish exhausted"', async () => {
    // Exhaustion is reported as ListingPublishExhaustedError, which the
    // classifier reads as an aspect problem. A persistent eBay outage must stay
    // an eBay outage so the seller is told to try again later.
    const { svc, calls } = service({
      publish: (reqs) => reqs.map((r) => ({ statusCode: 500, offerId: String(r.offerId), errors: [SYSTEM_ERROR] })),
    });
    const [outcome] = await svc.createListings('acct', 'loc', [draft('k1', 'SKU1')]);
    expect(outcome.ok).toBe(false);
    expect(outcome.errorName).toBeUndefined();
    expect(outcome.ebayErrors?.[0]?.errorId).toBe(25001);
    expect(calls.publish).toBe(3);
  });

  it('never replays a rejection of the input itself', async () => {
    const { svc, calls } = service({
      item: (reqs) =>
        reqs.map((r) => ({ statusCode: 400, sku: String(r.sku), errors: [{ errorId: 25002, message: 'Invalid condition.' }] })),
    });
    const [outcome] = await svc.createListings('acct', 'loc', [draft('k1', 'SKU1')]);
    expect(outcome.ok).toBe(false);
    expect(calls.item).toBe(1);
  });
});
