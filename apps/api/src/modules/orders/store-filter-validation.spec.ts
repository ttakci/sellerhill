import { BadRequestException } from '@nestjs/common';

import { DashboardController } from '../dashboard/dashboard.controller';

import { OrdersController } from './orders.controller';

/**
 * `?ebayAccountId=` is compared against a UUID column. A malformed value must
 * be a 400 at the boundary, never a Postgres cast error (500).
 */
describe('store filter validation (orders + dashboard)', () => {
  const STORE = '11111111-1111-4111-8111-11111111111a';
  const req = { user: { sub: 'user-1' } };

  function orders() {
    const service = {
      findAll: jest.fn().mockResolvedValue({ orders: [], total: 0 }),
      getStageCounts: jest.fn().mockResolvedValue({}),
    };
    return { controller: new OrdersController(service as never), service };
  }

  it('orders list: refuses a malformed store id, forwards a valid one, ignores a blank one', async () => {
    const { controller, service } = orders();
    expect(() => controller.findAll(req, undefined, undefined, undefined, undefined, 'not-a-uuid')).toThrow(
      BadRequestException
    );
    expect(service.findAll).not.toHaveBeenCalled();

    await controller.findAll(req, undefined, undefined, undefined, undefined, STORE);
    expect((service.findAll.mock.calls[0] as unknown[])[1]).toEqual(expect.objectContaining({ ebayAccountId: STORE }));

    await controller.findAll(req, undefined, undefined, undefined, undefined, '');
    expect((service.findAll.mock.calls[1] as unknown[])[1]).toEqual(
      expect.objectContaining({ ebayAccountId: undefined })
    );
  });

  it('stage counts: refuses a malformed store id', async () => {
    const { controller, service } = orders();
    expect(() => controller.getStageCounts(req, "x' OR 1=1")).toThrow(BadRequestException);
    await controller.getStageCounts(req, STORE);
    expect(service.getStageCounts).toHaveBeenCalledWith('user-1', { ebayAccountId: STORE, isTracked: undefined });
  });

  it('dashboard: refuses a malformed store id, forwards a valid one', async () => {
    const service = { getDashboard: jest.fn().mockResolvedValue({}) };
    const controller = new DashboardController(service as never);
    await expect(controller.getDashboard(req, undefined, undefined, undefined, 'nope')).rejects.toThrow(BadRequestException);
    expect(service.getDashboard).not.toHaveBeenCalled();
    await controller.getDashboard(req, undefined, undefined, undefined, STORE);
    expect(service.getDashboard).toHaveBeenCalledWith('user-1', expect.anything(), STORE);
  });
});
