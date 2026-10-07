// apps/api/src/modules/ebay-returns/ebay-cancellations.controller.spec.ts

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CANCELLATION_ACTION_ERROR_KEY, CancellationTab } from '@repo/shared';

import { CancellationActionError, EbayCancellationsActionsService } from './ebay-cancellations-actions.service';
import { EbayCancellationsController } from './ebay-cancellations.controller';

const USER = '00000000-0000-4000-8000-00000000000a';
const ACCOUNT = '11111111-1111-4111-8111-11111111111a';
const ORDER = '44444444-4444-4444-8444-444444444444';
const ID = '33333333-3333-4333-8333-333333333333';
const req = { user: { sub: USER } };

function build() {
  const actions = {
    list: jest.fn(() => Promise.resolve({ items: [], total: 0, page: 1, limit: 20 })),
    counts: jest.fn(() => Promise.resolve({})),
    detail: jest.fn(() => Promise.resolve({})),
    act: jest.fn(() => Promise.resolve({})),
  };
  const controller = new EbayCancellationsController(actions as unknown as EbayCancellationsActionsService);
  return { controller, actions };
}

describe('EbayCancellationsController query parsing', () => {
  it.each(Object.values(CancellationTab))('forwards the known tab %s', async (tab) => {
    const { controller, actions } = build();
    await controller.list(req, undefined, undefined, tab);
    expect(actions.list).toHaveBeenCalledWith(USER, expect.objectContaining({ tab }));
  });

  it.each(['ACTION', 'overdue', ''])('ignores the unknown tab %j (no filter)', async (tab) => {
    const { controller, actions } = build();
    await controller.list(req, undefined, undefined, tab);
    expect(actions.list).toHaveBeenCalledWith(USER, expect.objectContaining({ tab: undefined }));
  });

  it('forwards page, limit, store, trimmed search and order for the caller only', async () => {
    const { controller, actions } = build();
    await controller.list(req, '2', '50', 'action', ` ${ACCOUNT} `, '  lamp ', ORDER);
    expect(actions.list).toHaveBeenCalledWith(USER, {
      page: 2,
      limit: 50,
      tab: CancellationTab.ACTION,
      ebayAccountId: ACCOUNT,
      search: 'lamp',
      orderId: ORDER,
    });
  });

  it('drops a blank search and refuses a store or order id that is not a UUID', async () => {
    const { controller, actions } = build();
    await controller.list(req, undefined, undefined, undefined, '', '   ');
    expect(actions.list).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ ebayAccountId: undefined, search: undefined })
    );
    expect(() => controller.list(req, undefined, undefined, undefined, 'store-1')).toThrow(BadRequestException);
    expect(() => controller.list(req, undefined, undefined, undefined, undefined, undefined, '1')).toThrow(
      BadRequestException
    );
    expect(() => controller.counts(req, 'nope')).toThrow(BadRequestException);
  });

  it('scopes the counts to the store filter', async () => {
    const { controller, actions } = build();
    await controller.counts(req, ACCOUNT);
    await controller.counts(req);
    expect(actions.counts).toHaveBeenNthCalledWith(1, USER, { ebayAccountId: ACCOUNT });
    expect(actions.counts).toHaveBeenNthCalledWith(2, USER, { ebayAccountId: undefined });
  });

  it('refuses a non-UUID id on the detail and maps the service’s key to its status', async () => {
    const { controller, actions } = build();
    await expect(controller.detail(req, 'x')).rejects.toBeInstanceOf(BadRequestException);
    expect(actions.detail).not.toHaveBeenCalled();
    actions.detail.mockRejectedValueOnce(new CancellationActionError(CANCELLATION_ACTION_ERROR_KEY.NOT_FOUND, 404));
    await expect(controller.detail(req, ID)).rejects.toEqual(new NotFoundException('cancellations.errors.notFound'));
  });
});
