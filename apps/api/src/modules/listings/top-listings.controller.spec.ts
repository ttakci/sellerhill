import { BadRequestException } from '@nestjs/common';
import { DashboardRangeError, DashboardRangePreset as P, TopListingSortKey as S } from '@repo/shared';

import { TopListingsController } from './top-listings.controller';

const REQ = { user: { sub: 'u1' } };
const ID1 = '11111111-1111-4111-8111-111111111111';

const row = (listingId: string) => ({
  listingId,
  metrics: { sales: 1, units: 1, orders: 1, netProfit: 1, profitProvisional: 0, ordersPendingCapture: 0 },
  changes: { sales: null, units: null, orders: null, netProfit: null },
  series: [0],
});

function make(rows: ReturnType<typeof row>[] = [], listingIds: string[] = [], serviceError?: Error) {
  const getTopListings = jest.fn(() =>
    serviceError
      ? Promise.reject(serviceError)
      : Promise.resolve({ range: {}, sortBy: S.SALES, granularity: 'day', seriesKeys: ['k'], rows, total: 41, page: 1, limit: 20 })
  );
  const getListingsByIds = jest.fn(() => Promise.resolve(listingIds.map((id) => ({ id }))));
  const controller = new TopListingsController({ getTopListings } as never, { getListingsByIds } as never);
  return { controller, getTopListings, getListingsByIds };
}

describe('TopListingsController', () => {
  it('defaults to today, sales, page 1, limit 20', async () => {
    const { controller, getTopListings } = make();
    await controller.getTopListings(REQ);
    expect(getTopListings).toHaveBeenCalledWith('u1', { preset: P.TODAY }, S.SALES, 1, 20, undefined);
  });

  it('clamps limit to 100', async () => {
    const { controller, getTopListings } = make();
    await controller.getTopListings(REQ, undefined, undefined, undefined, undefined, undefined, '2', '500');
    expect(getTopListings).toHaveBeenCalledWith('u1', { preset: P.TODAY }, S.SALES, 2, 100, undefined);
  });

  it('rejects an unknown sort with invalidSort', async () => {
    const { controller } = make();
    await expect(
      controller.getTopListings(REQ, undefined, undefined, undefined, undefined, 'price')
    ).rejects.toMatchObject({ message: 'dashboard.errors.invalidSort' });
  });

  it('rejects a repeated sortBy (array)', async () => {
    const { controller } = make();
    await expect(
      controller.getTopListings(REQ, undefined, undefined, undefined, undefined, ['sales', 'units'])
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps a range error to 400 invalidRange', async () => {
    const { controller } = make([], [], new DashboardRangeError('bad'));
    await expect(controller.getTopListings(REQ)).rejects.toMatchObject({
      message: 'dashboard.errors.invalidRange',
    });
  });

  it('hydrates in aggregate order, drops a missing listing, keeps total', async () => {
    const ID2 = '22222222-2222-4222-8222-222222222222';
    const ID3 = '33333333-3333-4333-8333-333333333333';
    const { controller, getListingsByIds } = make([row(ID2), row(ID1), row(ID3)], [ID1, ID2]);
    const page = await controller.getTopListings(REQ);
    expect(getListingsByIds).toHaveBeenCalledWith('u1', [ID2, ID1, ID3]);
    expect(page.items.map((i) => i.listing.id)).toEqual([ID2, ID1]);
    expect(page.total).toBe(41);
    expect('rows' in page).toBe(false);
  });
});
