import { EBAY_MESSAGING_SCOPES } from '@repo/shared';

import { BuyerMessageProcessor } from './buyer-message.processor';

/**
 * The two permanent "cannot send" skips: an order with no buyer username (the
 * template's "there" fallback must never become a recipient) and a store whose
 * consent predates the messaging scopes. Both record a skipped log row, make
 * no provider call and return normally — no BullMQ retry.
 */

const ORDER_ROW = {
  buyer_username: 'buyer_a',
  item_title: 'Widget',
  order_id: '12-34',
  tracking_number: null,
  carrier: null,
  store_name: 'My Store',
  legacy_item_id: '1234567890',
};

const job = {
  data: {
    ebayOrderId: '12-34',
    userId: 'user-1',
    ebayAccountId: 'acc-1',
    storeId: null,
    event: 'order_received',
  },
  timestamp: Date.now(),
  opts: {},
} as never;

function build(orderRow: Record<string, unknown> | null, grantedScopes: string[] | null) {
  const db = {
    query: jest.fn((sql: string) => {
      if (/FROM buyer_message_log WHERE/.test(sql)) {
        return Promise.resolve([]);
      }
      if (/FROM orders o/.test(sql)) {
        return Promise.resolve(orderRow ? [orderRow] : []);
      }
      if (/SELECT granted_scopes FROM ebay_accounts WHERE id = \$1/.test(sql)) {
        return Promise.resolve(grantedScopes === null ? [] : [{ granted_scopes: grantedScopes }]);
      }
      return Promise.resolve([]);
    }),
  };
  const messageService = {
    isMessagingEnabled: jest.fn().mockResolvedValue(true),
    resolveTemplate: jest
      .fn()
      .mockResolvedValue({ kind: 'custom', ref: 'tpl-1', versionHash: 'h', body: 'Hi {{buyer_username}}' }),
  };
  const provider = { sendMessage: jest.fn().mockResolvedValue({ providerMessageId: 'pm-1' }) };
  const quota = { isSuspended: jest.fn().mockResolvedValue(false) };
  const processor = new BuyerMessageProcessor(db as never, messageService as never, provider, quota as never);
  return { processor, db, provider };
}

/** The params of the buyer_message_log INSERT (status is $7, error $8). */
function loggedRow(db: { query: jest.Mock }): unknown[] {
  const call = (db.query.mock.calls as unknown[][]).find(([sql]) => /INSERT INTO buyer_message_log/.test(sql as string));
  return (call?.[1] as unknown[]) ?? [];
}

describe('BuyerMessageProcessor', () => {
  it('sends to the real buyer username when the store can message', async () => {
    const { processor, db, provider } = build(ORDER_ROW, [...EBAY_MESSAGING_SCOPES]);

    await expect(processor.process(job)).resolves.toBeUndefined();

    expect(provider.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ buyerUsername: 'buyer_a', body: 'Hi buyer_a' }),
    );
    expect(loggedRow(db)[6]).toBe('sent');
  });

  it.each([null, ''])('skips with no_buyer_username when the order has none (%p) — no provider call', async (name) => {
    const { processor, db, provider } = build({ ...ORDER_ROW, buyer_username: name }, [...EBAY_MESSAGING_SCOPES]);

    await expect(processor.process(job)).resolves.toBeUndefined();

    expect(provider.sendMessage).not.toHaveBeenCalled();
    const row = loggedRow(db);
    expect(row[6]).toBe('skipped');
    expect(row[7]).toBe('no_buyer_username');
  });

  it.each([[[]], [['https://api.ebay.com/oauth/api_scope/sell.inventory']], [null]])(
    'skips with messaging_scope_missing when the store lacks the scopes (%p) — no provider call',
    async (scopes) => {
      const { processor, db, provider } = build(ORDER_ROW, scopes);

      await expect(processor.process(job)).resolves.toBeUndefined();

      expect(provider.sendMessage).not.toHaveBeenCalled();
      const row = loggedRow(db);
      expect(row[6]).toBe('skipped');
      expect(row[7]).toBe('messaging_scope_missing');
    },
  );
});
