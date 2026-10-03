import { readFileSync } from 'fs';
import { join } from 'path';

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
  buyer_name: 'Alex Buyer',
  item_title: 'Widget',
  order_id: '12-34',
  tracking_number: null,
  carrier: null,
  store_name: 'My Store',
  legacy_item_id: '1234567890',
  listing_id: 'listing-1',
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
  return { processor, db, provider, messageService };
}

/** The params of the buyer_message_log INSERT (status is $7, error $8). */
function loggedRow(db: { query: jest.Mock }): unknown[] {
  const call = (db.query.mock.calls as unknown[][]).find(([sql]) => /INSERT INTO buyer_message_log/.test(sql as string));
  return (call?.[1] as unknown[]) ?? [];
}

describe('BuyerMessageProcessor — what the buyer reads', () => {
  const SOURCE = readFileSync(join(__dirname, 'buyer-message.processor.ts'), 'utf8');
  const SHIPPED_BODY = 'Hi {{buyer_name}},\nTracking number: {{tracking_number}}\nCarrier: {{carrier}}';

  function buildWithBody(orderRow: Record<string, unknown>) {
    const built = build(orderRow, [...EBAY_MESSAGING_SCOPES]);
    return built;
  }

  it('greets by first name and prints the number eBay received under its carrier', async () => {
    const { processor, provider, messageService } = buildWithBody({
      ...ORDER_ROW,
      buyer_name: 'joseph smith',
      tracking_number: 'AQUAA0359110926YQ',
      carrier: 'AQUILINE',
    });
    messageService.resolveTemplate.mockResolvedValue({ kind: 'custom', ref: 't', versionHash: 'h', body: SHIPPED_BODY });

    await processor.process(job);

    expect(provider.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        buyerUsername: 'buyer_a',
        body: 'Hi Joseph,\nTracking number: AQUAA0359110926YQ\nCarrier: Aquiline',
      }),
    );
  });

  it('prints no tracking line at all when eBay has received no number', async () => {
    const { processor, provider, messageService } = buildWithBody({ ...ORDER_ROW, buyer_name: null });
    messageService.resolveTemplate.mockResolvedValue({ kind: 'custom', ref: 't', versionHash: 'h', body: SHIPPED_BODY });

    await processor.process(job);

    expect(provider.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ body: 'Hi there,' }));
  });

  it('{{tracking_number}} is the number pushed to eBay — the Amazon number is never selected as it', () => {
    expect(SOURCE).toMatch(/o\.ebay_tracking_pushed_number AS tracking_number/);
    expect(SOURCE).not.toMatch(/amazon_tracking_number\s+AS\s+tracking_number/);
    expect(SOURCE).not.toMatch(/COALESCE\([^)]*amazon_tracking_number/);
  });

  it('the log INSERT casts its twice-used status parameter (a bare $7 does not parse)', () => {
    expect(SOURCE).not.toMatch(/\$7\s*=\s*'sent'/);
    expect(SOURCE.match(/\$7::buyer_message_status/g)).toHaveLength(2);
  });
});

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

describe('BuyerMessageProcessor — whose settings, which orders', () => {
  it("resolves the messaging config with the order's own store when the job carries no storeId", async () => {
    const { processor, messageService } = build(ORDER_ROW, [...EBAY_MESSAGING_SCOPES]);

    await processor.process(job);

    expect(messageService.isMessagingEnabled).toHaveBeenCalledWith('user-1', 'acc-1');
    expect(messageService.resolveTemplate).toHaveBeenCalledWith('user-1', 'acc-1', 'order_received');
  });

  it('never messages the buyer of an order that is not linked to a SellerHill listing', async () => {
    const { processor, db, provider } = build({ ...ORDER_ROW, listing_id: null }, [...EBAY_MESSAGING_SCOPES]);

    await expect(processor.process(job)).resolves.toBeUndefined();

    expect(provider.sendMessage).not.toHaveBeenCalled();
    const row = loggedRow(db);
    expect(row[6]).toBe('skipped');
    expect(row[7]).toBe('order_untracked');
  });
});
