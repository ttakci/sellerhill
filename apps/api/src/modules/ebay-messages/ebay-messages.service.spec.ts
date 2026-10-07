import {
  EBAY_MESSAGING_SCOPES,
  EbayAccountStatus,
  EbayCallPriority,
  EbayConversationDto,
  EbayConversationStatus,
  EbayConversationType,
  EbayMessageDto,
} from '@repo/shared';

import type { DatabaseService } from '../../common/database/database.service';
import type { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import type { EbayService } from '../ebay/ebay.service';
import type { EbayNotificationService } from '../ebay/notifications/ebay-notification.service';

import { EbayMessageApiError, type EbayMessageClient } from './ebay-message.client';
import { EbayMessagesService } from './ebay-messages.service';

const USER = 'user-1';
const ACCOUNT = '11111111-1111-4111-8111-111111111111';

interface AccountRow {
  granted_scopes: string[];
  ebay_username: string | null;
  seller_id: string;
  unread_message_count: number;
  unread_message_synced_at: Date | null;
}

const accountRow = (over: Partial<AccountRow> = {}): AccountRow => ({
  granted_scopes: [...EBAY_MESSAGING_SCOPES],
  ebay_username: 'my_store',
  seller_id: 'immutable-id',
  unread_message_count: 3,
  unread_message_synced_at: new Date(),
  ...over,
});

const message = (over: Partial<EbayMessageDto> = {}): EbayMessageDto => ({
  messageId: 'm1',
  subject: null,
  body: 'hi',
  senderUsername: 'buyer_a',
  recipientUsername: 'my_store',
  read: false,
  createdAt: '2026-09-29T00:00:00.000Z',
  media: [],
  ...over,
});

const conversation = (over: Partial<EbayConversationDto> = {}): EbayConversationDto => ({
  conversationId: 'c1',
  type: EbayConversationType.FROM_MEMBERS,
  status: EbayConversationStatus.ACTIVE,
  title: 'Question',
  unreadCount: 1,
  referenceType: 'LISTING',
  referenceId: '123',
  createdAt: '2026-09-29T00:00:00.000Z',
  latestMessage: message(),
  otherPartyUsername: null,
  imageUrl: null,
  ...over,
});

function build() {
  const client = {
    getConversations: jest.fn(),
    getConversation: jest.fn(),
    sendMessage: jest.fn(),
    updateRead: jest.fn(),
    bulkUpdateStatus: jest.fn(),
  };
  const ebayService = {
    assertAccountOwnership: jest.fn().mockResolvedValue(undefined),
    getAccountAccessToken: jest.fn().mockResolvedValue('tok'),
  };
  const db = { query: jest.fn() };
  const notifications = { isEnabled: jest.fn().mockReturnValue(true), subscribeAccount: jest.fn().mockResolvedValue('created') };
  const service = new EbayMessagesService(
    client as unknown as EbayMessageClient,
    ebayService as unknown as EbayService,
    db as unknown as DatabaseService,
    notifications as unknown as EbayNotificationService,
    { getNumber: jest.fn().mockResolvedValue(10) } as unknown as PlatformSettingsService
  );
  return { service, client, ebayService, db, notifications };
}

/** Answers the account SELECT with `row`, every other statement with []. */
function answerAccount(db: { query: jest.Mock }, row: AccountRow | null): void {
  db.query.mockImplementation((sql: string) =>
    Promise.resolve(/FROM ebay_accounts\s+WHERE id = \$1 AND user_id = \$2/.test(sql) && row ? [row] : [])
  );
}

describe('EbayMessagesService', () => {
  describe('account gate', () => {
    it('loads the owned ACTIVE row and refuses when the messaging scopes are missing', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow({ granted_scopes: ['https://api.ebay.com/oauth/api_scope/sell.inventory'] }));

      await expect(
        service.listConversations(USER, { ebayAccountId: ACCOUNT, type: EbayConversationType.FROM_MEMBERS, page: 1, limit: 25 })
      ).rejects.toThrow('ebay.errors.messagingScopeMissing');

      const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain(
        'SELECT granted_scopes, ebay_username, seller_id, unread_message_count, unread_message_synced_at FROM ebay_accounts WHERE id = $1 AND user_id = $2 AND status = $3'
      );
      expect(params).toEqual([ACCOUNT, USER, EbayAccountStatus.ACTIVE]);
      expect(client.getConversations).not.toHaveBeenCalled();
    });

    it('refuses an account the user does not own', async () => {
      const { service, db, client } = build();
      answerAccount(db, null);

      await expect(
        service.listConversations(USER, { ebayAccountId: ACCOUNT, type: EbayConversationType.FROM_MEMBERS, page: 1, limit: 25 })
      ).rejects.toThrow('ebay.errors.accountNotFound');
      expect(client.getConversations).not.toHaveBeenCalled();
    });
  });

  describe('listConversations', () => {
    it('pages by offset and resolves the other party against the store identity', async () => {
      const { service, db, client, ebayService } = build();
      answerAccount(db, accountRow());
      client.getConversations.mockResolvedValue({
        items: [
          conversation({ conversationId: 'a', latestMessage: message({ senderUsername: 'buyer_a', recipientUsername: 'my_store' }) }),
          conversation({ conversationId: 'b', latestMessage: message({ senderUsername: 'MY_STORE', recipientUsername: 'buyer_b' }) }),
          conversation({ conversationId: 'c', latestMessage: message({ senderUsername: 'immutable-id', recipientUsername: 'buyer_c' }) }),
          conversation({ conversationId: 'd', latestMessage: null }),
        ],
        total: 57,
      });

      const result = await service.listConversations(USER, {
        ebayAccountId: ACCOUNT,
        type: EbayConversationType.FROM_MEMBERS,
        status: EbayConversationStatus.ACTIVE,
        page: 3,
        limit: 10,
      });

      expect(ebayService.getAccountAccessToken).toHaveBeenCalledWith(ACCOUNT);
      expect(client.getConversations).toHaveBeenCalledWith(
        'tok',
        { type: EbayConversationType.FROM_MEMBERS, status: EbayConversationStatus.ACTIVE, limit: 10, offset: 20 },
        EbayCallPriority.INTERACTIVE
      );
      expect(result.total).toBe(57);
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.items.map((i) => i.otherPartyUsername)).toEqual(['buyer_a', 'buyer_b', 'buyer_c', null]);
    });

    it('merges both types newest first when no type is given (Archive / Deleted)', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      const at = (id: string, createdAt: string) =>
        conversation({ conversationId: id, latestMessage: message({ createdAt }) });
      client.getConversations.mockImplementation((_token: string, q: { type: EbayConversationType }) =>
        Promise.resolve(
          q.type === EbayConversationType.FROM_MEMBERS
            ? { items: [at('m1', '2026-10-05T00:00:00Z'), at('m2', '2026-10-01T00:00:00Z')], total: 2 }
            : { items: [at('e1', '2026-10-03T00:00:00Z')], total: 1 }
        )
      );

      const result = await service.listConversations(USER, {
        ebayAccountId: ACCOUNT,
        status: EbayConversationStatus.ARCHIVE,
        page: 1,
        limit: 2,
      });

      expect(client.getConversations).toHaveBeenCalledTimes(2);
      expect(result.items.map((i) => i.conversationId)).toEqual(['m1', 'e1']);
      expect(result.total).toBe(3);
    });

    it('attaches the first listing photo to a conversation about one of the store listings', async () => {
      const { service, db, client } = build();
      db.query.mockImplementation((sql: string) => {
        if (/FROM ebay_accounts\s+WHERE id = \$1 AND user_id = \$2/.test(sql)) {
          return Promise.resolve([accountRow()]);
        }
        if (/FROM listings l/.test(sql)) {
          return Promise.resolve([{ ebay_item_id: '111', image_urls: ['https://img/1.jpg', 'https://img/2.jpg'] }]);
        }
        return Promise.resolve([]);
      });
      client.getConversations.mockResolvedValue({
        items: [
          conversation({ conversationId: 'a', referenceId: '111' }),
          conversation({ conversationId: 'b', referenceId: '222' }),
          conversation({ conversationId: 'c', referenceId: null }),
        ],
        total: 3,
      });

      const result = await service.listConversations(USER, {
        ebayAccountId: ACCOUNT,
        type: EbayConversationType.FROM_MEMBERS,
        page: 1,
        limit: 25,
      });

      expect(result.items.map((i) => i.imageUrl)).toEqual(['https://img/1.jpg', null, null]);
      const [, params] = db.query.mock.calls.find(([sql]) => /FROM listings l/.test(sql as string)) as [string, unknown[]];
      expect(params).toEqual([ACCOUNT, ['111', '222']]);
    });

    it('still lists the conversations when the photo lookup fails', async () => {
      const { service, db, client } = build();
      db.query.mockImplementation((sql: string) => {
        if (/FROM ebay_accounts\s+WHERE id = \$1 AND user_id = \$2/.test(sql)) {
          return Promise.resolve([accountRow()]);
        }
        return Promise.reject(new Error('db down'));
      });
      client.getConversations.mockResolvedValue({
        items: [conversation({ conversationId: 'a', referenceId: '111' })],
        total: 1,
      });

      const result = await service.listConversations(USER, {
        ebayAccountId: ACCOUNT,
        type: EbayConversationType.FROM_MEMBERS,
        page: 1,
        limit: 25,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].imageUrl).toBeNull();
    });
  });

  describe('unreadBreakdown', () => {
    it('counts each conversation type from eBay and stores the sum for the sidebar badge', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.getConversations
        .mockResolvedValueOnce({ items: [], total: 7 })
        .mockResolvedValueOnce({ items: [], total: 3 });

      const result = await service.unreadBreakdown(USER, ACCOUNT);

      expect(result).toEqual({ total: 10, members: 7, ebay: 3 });
      const types = (client.getConversations.mock.calls as unknown[][]).map((call) => (call[1] as { type: string }).type);
      expect(types).toEqual([EbayConversationType.FROM_MEMBERS, EbayConversationType.FROM_EBAY]);
      const update = db.query.mock.calls.find(([sql]) => /UPDATE ebay_accounts/.test(sql as string)) as [string, unknown[]];
      expect(update[1]).toEqual([10, ACCOUNT]);
    });

    it('reuses a recount for a minute and drops it after the store marks a conversation read', async () => {
      const { service, db, client } = build();
      db.query.mockImplementation((sql: string) =>
        Promise.resolve(/WHERE id = \$1 AND user_id = \$2/.test(sql) ? [accountRow()] : [])
      );
      client.getConversations.mockResolvedValue({ items: [], total: 1 });
      client.updateRead.mockResolvedValue(undefined);

      await service.unreadBreakdown(USER, ACCOUNT);
      await service.unreadBreakdown(USER, ACCOUNT);
      expect(client.getConversations).toHaveBeenCalledTimes(2);

      await service.setRead(USER, 'c1', { ebayAccountId: ACCOUNT, type: EbayConversationType.FROM_MEMBERS, read: true });
      await service.unreadBreakdown(USER, ACCOUNT);
      expect(client.getConversations).toHaveBeenCalledTimes(4);
    });
  });

  describe('getThread', () => {
    it('reads the thread with the requested type and paging', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.getConversation.mockResolvedValue({
        conversation: { conversationId: 'c1', type: EbayConversationType.FROM_EBAY, status: EbayConversationStatus.ACTIVE, title: 't' },
        messages: [message()],
        total: 1,
      });

      const thread = await service.getThread(USER, 'c1', {
        ebayAccountId: ACCOUNT,
        type: EbayConversationType.FROM_EBAY,
        page: 2,
        limit: 5,
      });

      expect(client.getConversation).toHaveBeenCalledWith(
        'tok',
        'c1',
        EbayConversationType.FROM_EBAY,
        { limit: 5, offset: 5 },
        EbayCallPriority.INTERACTIVE
      );
      expect(thread).toMatchObject({ conversationId: 'c1', title: 't', total: 1, page: 2, limit: 5 });
      expect(thread.messages).toHaveLength(1);
    });
  });

  describe('reply', () => {
    it('refuses a FROM_EBAY conversation without calling eBay', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());

      await expect(
        service.reply(USER, 'c1', { ebayAccountId: ACCOUNT, type: EbayConversationType.FROM_EBAY, text: 'hello' })
      ).rejects.toThrow('ebay.errors.messagingReplyNotAllowed');
      expect(client.sendMessage).not.toHaveBeenCalled();
    });

    it('refuses 2001 characters without calling eBay', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());

      await expect(
        service.reply(USER, 'c1', { ebayAccountId: ACCOUNT, type: EbayConversationType.FROM_MEMBERS, text: 'x'.repeat(2001) })
      ).rejects.toThrow('ebay.errors.messageTooLong');
      expect(client.sendMessage).not.toHaveBeenCalled();
    });

    it('sends exactly 2000 characters (trimmed) into the conversation', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.sendMessage.mockResolvedValue({ messageId: 'new-1' });
      const text = 'y'.repeat(2000);

      const result = await service.reply(USER, 'c1', {
        ebayAccountId: ACCOUNT,
        type: EbayConversationType.FROM_MEMBERS,
        text: `  ${text}  `,
      });

      expect(result).toEqual({ messageId: 'new-1' });
      expect(client.sendMessage).toHaveBeenCalledWith('tok', { conversationId: 'c1', text }, EbayCallPriority.INTERACTIVE);
    });
  });

  describe('setRead', () => {
    it('marks read with the body type and decrements the counter, floored at zero', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.updateRead.mockResolvedValue(undefined);

      await service.setRead(USER, 'c1', { ebayAccountId: ACCOUNT, type: EbayConversationType.FROM_EBAY, read: true });

      expect(client.updateRead).toHaveBeenCalledWith('tok', 'c1', EbayConversationType.FROM_EBAY, true, EbayCallPriority.INTERACTIVE);
      const update = db.query.mock.calls.find(([sql]) => /UPDATE ebay_accounts/.test(sql as string)) as [string, unknown[]];
      expect(update[0]).toContain('unread_message_count = GREATEST(0, unread_message_count - 1)');
      expect(update[1]).toEqual([ACCOUNT]);
    });

    it('on read, retires the conversation\'s counted webhook events so its next buyer reply counts again', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.updateRead.mockResolvedValue(undefined);

      await service.setRead(USER, 'c1', { ebayAccountId: ACCOUNT, type: EbayConversationType.FROM_MEMBERS, read: true });

      const retire = db.query.mock.calls.find(([sql]) => /UPDATE ebay_notification_events/.test(sql as string)) as [string, unknown[]];
      expect(retire[0]).toContain(
        "UPDATE ebay_notification_events SET outcome = 'counted_read' WHERE ebay_account_id = $1 AND conversation_id = $2 AND outcome = 'counted'"
      );
      expect(retire[1]).toEqual([ACCOUNT, 'c1']);
    });

    it('does not retire counted events when marking unread, or when eBay refuses the read', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.updateRead.mockResolvedValue(undefined);

      await service.setRead(USER, 'c1', { ebayAccountId: ACCOUNT, type: EbayConversationType.FROM_MEMBERS, read: false });
      client.updateRead.mockRejectedValue(new EbayMessageApiError(503, [], 'down'));
      await expect(
        service.setRead(USER, 'c1', { ebayAccountId: ACCOUNT, type: EbayConversationType.FROM_MEMBERS, read: true })
      ).rejects.toThrow('ebay.errors.messagingUnavailable');

      expect(db.query.mock.calls.some(([sql]) => /ebay_notification_events/.test(sql as string))).toBe(false);
    });

    it('marks unread and increments the counter', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.updateRead.mockResolvedValue(undefined);

      await service.setRead(USER, 'c1', { ebayAccountId: ACCOUNT, type: EbayConversationType.FROM_MEMBERS, read: false });

      const update = db.query.mock.calls.find(([sql]) => /UPDATE ebay_accounts/.test(sql as string)) as [string, unknown[]];
      expect(update[0]).toContain('unread_message_count = unread_message_count + 1');
    });

    it('leaves the counter alone when eBay refuses', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.updateRead.mockRejectedValue(new EbayMessageApiError(503, [], 'down'));

      await expect(
        service.setRead(USER, 'c1', { ebayAccountId: ACCOUNT, type: EbayConversationType.FROM_MEMBERS, read: true })
      ).rejects.toThrow('ebay.errors.messagingUnavailable');
      expect(db.query.mock.calls.some(([sql]) => /UPDATE ebay_accounts/.test(sql as string))).toBe(false);
    });
  });

  describe('bulkStatus', () => {
    it('sends up to ten ids in one call with the body type and does not touch the counter', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      const ids = Array.from({ length: 10 }, (_, i) => `c${i}`);
      client.bulkUpdateStatus.mockResolvedValue({ succeeded: ids.slice(0, 9), failed: ['c9'] });

      const result = await service.bulkStatus(USER, {
        ebayAccountId: ACCOUNT,
        type: EbayConversationType.FROM_MEMBERS,
        conversationIds: ids,
        status: EbayConversationStatus.ARCHIVE,
      });

      expect(client.bulkUpdateStatus).toHaveBeenCalledTimes(1);
      expect(client.bulkUpdateStatus).toHaveBeenCalledWith(
        'tok',
        EbayConversationType.FROM_MEMBERS,
        ids,
        EbayConversationStatus.ARCHIVE,
        EbayCallPriority.INTERACTIVE
      );
      expect(result).toEqual({ succeeded: ids.slice(0, 9), failed: ['c9'] });
      expect(db.query.mock.calls.some(([sql]) => /UPDATE ebay_accounts/.test(sql as string))).toBe(false);
    });

    const readInput = (conversationIds: string[]) => ({
      ebayAccountId: ACCOUNT,
      type: EbayConversationType.FROM_MEMBERS,
      conversationIds,
      status: EbayConversationStatus.READ as const,
    });

    it('marks read in ONE bulk call and retires the counted webhook events of what it read', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.bulkUpdateStatus.mockResolvedValue({ succeeded: ['c1', 'c2'], failed: [] });

      const result = await service.bulkStatus(USER, readInput(['c1', 'c2']));

      expect(client.bulkUpdateStatus).toHaveBeenCalledWith(
        'tok',
        EbayConversationType.FROM_MEMBERS,
        ['c1', 'c2'],
        EbayConversationStatus.READ,
        EbayCallPriority.INTERACTIVE
      );
      expect(client.updateRead).not.toHaveBeenCalled();
      expect(result).toEqual({ succeeded: ['c1', 'c2'], failed: [] });
      const retire = db.query.mock.calls.find(([sql]) => /UPDATE ebay_notification_events/.test(sql as string)) as [string, unknown[]];
      expect(retire[0]).toContain('conversation_id = ANY($2::text[])');
      expect(retire[1]).toEqual([ACCOUNT, ['c1', 'c2']]);
    });

    it('marks read one by one only the ids eBay did not confirm in bulk', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.bulkUpdateStatus.mockResolvedValue({ succeeded: ['c1'], failed: ['c2'] });
      client.updateRead.mockResolvedValue(undefined);

      const result = await service.bulkStatus(USER, readInput(['c1', 'c2']));

      expect(client.updateRead).toHaveBeenCalledTimes(1);
      expect(client.updateRead).toHaveBeenCalledWith('tok', 'c2', EbayConversationType.FROM_MEMBERS, true, EbayCallPriority.INTERACTIVE);
      expect(result).toEqual({ succeeded: ['c1', 'c2'], failed: [] });
    });

    it('falls back to one-by-one when eBay rejects a bulk READ outright', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.bulkUpdateStatus.mockRejectedValue(new EbayMessageApiError(400, [355001], 'Invalid conversationStatus value.'));
      client.updateRead.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new EbayMessageApiError(503, [], 'down'));

      const result = await service.bulkStatus(USER, readInput(['c1', 'c2']));

      expect(client.updateRead).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ succeeded: ['c1'], failed: ['c2'] });
    });
  });

  describe('unreadCount', () => {
    const ACCOUNT_B = '22222222-2222-4222-8222-222222222222';

    it('sums the stored counters with no eBay call while they are under the recount interval', async () => {
      const { service, db, client, notifications } = build();
      notifications.isEnabled.mockReturnValue(true);
      const recent = new Date(Date.now() - 60 * 1000);
      db.query.mockResolvedValue([
        { id: ACCOUNT, granted_scopes: [...EBAY_MESSAGING_SCOPES], unread_message_count: 2, unread_message_synced_at: recent, message_subscription_id: 'sub-a' },
        { id: ACCOUNT_B, granted_scopes: [...EBAY_MESSAGING_SCOPES], unread_message_count: 5, unread_message_synced_at: recent, message_subscription_id: 'sub-b' },
      ]);

      const result = await service.unreadCount(USER);

      expect(result).toEqual({
        total: 7,
        byAccount: [
          { ebayAccountId: ACCOUNT, unread: 2 },
          { ebayAccountId: ACCOUNT_B, unread: 5 },
        ],
      });
      expect(client.getConversations).not.toHaveBeenCalled();
      const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('message_subscription_id');
      expect(sql).toContain('WHERE user_id = $1 AND status = $2');
      expect(params).toEqual([USER, EbayAccountStatus.ACTIVE]);
    });

    it('recounts every store older than the recount interval (10 min here), subscribed or not (eBay sends nothing when a message is read on its site), at BACKGROUND priority', async () => {
      const { service, db, client, notifications } = build();
      notifications.isEnabled.mockReturnValue(true);
      const old = new Date(Date.now() - 11 * 60 * 1000);
      db.query.mockImplementation((sql: string) => {
        if (/WHERE user_id = \$1 AND status = \$2/.test(sql)) {
          return Promise.resolve([
            { id: ACCOUNT, granted_scopes: [...EBAY_MESSAGING_SCOPES], unread_message_count: 9, unread_message_synced_at: old, message_subscription_id: 'sub-a' },
            { id: ACCOUNT_B, granted_scopes: [...EBAY_MESSAGING_SCOPES], unread_message_count: 4, unread_message_synced_at: old, message_subscription_id: 'sub-b' },
          ]);
        }
        if (/WHERE id = \$1 AND user_id = \$2/.test(sql)) {
          return Promise.resolve([accountRow()]);
        }
        return Promise.resolve([]);
      });
      client.getConversations
        .mockResolvedValueOnce({ items: [], total: 2 })
        .mockResolvedValueOnce({ items: [], total: 0 })
        .mockResolvedValueOnce({ items: [], total: 1 })
        .mockResolvedValueOnce({ items: [], total: 1 });

      const result = await service.unreadCount(USER);

      expect(client.getConversations).toHaveBeenCalledTimes(4);
      for (const call of client.getConversations.mock.calls as unknown[][]) {
        expect(call[2]).toBe(EbayCallPriority.BACKGROUND);
      }
      expect(result).toEqual({
        total: 4,
        byAccount: [
          { ebayAccountId: ACCOUNT, unread: 2 },
          { ebayAccountId: ACCOUNT_B, unread: 2 },
        ],
      });
    });

    it('retries the NEW_MESSAGE subscription of a store that has none, at most once an hour', async () => {
      const { service, db, notifications, ebayService } = build();
      notifications.isEnabled.mockReturnValue(true);
      db.query.mockResolvedValue([
        { id: ACCOUNT, granted_scopes: [...EBAY_MESSAGING_SCOPES], unread_message_count: 1, unread_message_synced_at: new Date(), message_subscription_id: null },
        { id: ACCOUNT_B, granted_scopes: [...EBAY_MESSAGING_SCOPES], unread_message_count: 1, unread_message_synced_at: new Date(), message_subscription_id: 'sub-b' },
      ]);

      await service.unreadCount(USER);
      await service.unreadCount(USER);
      await new Promise((resolve) => setImmediate(resolve));

      expect(ebayService.getAccountAccessToken).toHaveBeenCalledTimes(1);
      expect(notifications.subscribeAccount).toHaveBeenCalledTimes(1);
      expect(notifications.subscribeAccount).toHaveBeenCalledWith(ACCOUNT, 'tok');
    });

    it('recounts a never-synced store from eBay first when notifications are off', async () => {
      const { service, db, client, notifications } = build();
      notifications.isEnabled.mockReturnValue(false);
      const fresh = new Date();
      db.query.mockImplementation((sql: string) => {
        if (/WHERE user_id = \$1 AND status = \$2/.test(sql)) {
          return Promise.resolve([
            { id: ACCOUNT, granted_scopes: [...EBAY_MESSAGING_SCOPES], unread_message_count: 0, unread_message_synced_at: null },
            { id: ACCOUNT_B, granted_scopes: [...EBAY_MESSAGING_SCOPES], unread_message_count: 4, unread_message_synced_at: fresh },
          ]);
        }
        if (/WHERE id = \$1 AND user_id = \$2/.test(sql)) {
          return Promise.resolve([accountRow()]);
        }
        return Promise.resolve([]);
      });
      client.getConversations
        .mockResolvedValueOnce({ items: [], total: 3 })
        .mockResolvedValueOnce({ items: [], total: 1 });

      const result = await service.unreadCount(USER);

      expect(client.getConversations).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        total: 8,
        byAccount: [
          { ebayAccountId: ACCOUNT, unread: 4 },
          { ebayAccountId: ACCOUNT_B, unread: 4 },
        ],
      });
    });

    it('falls back to the stored counter when the recount fails', async () => {
      const { service, db, client, notifications } = build();
      notifications.isEnabled.mockReturnValue(false);
      const old = new Date(Date.now() - 60 * 60 * 1000);
      db.query.mockImplementation((sql: string) => {
        if (/WHERE user_id = \$1 AND status = \$2/.test(sql)) {
          return Promise.resolve([
            { id: ACCOUNT, granted_scopes: [...EBAY_MESSAGING_SCOPES], unread_message_count: 6, unread_message_synced_at: old },
          ]);
        }
        return Promise.resolve([accountRow()]);
      });
      client.getConversations.mockRejectedValue(new Error('network down'));

      const result = await service.unreadCount(USER);

      expect(result).toEqual({ total: 6, byAccount: [{ ebayAccountId: ACCOUNT, unread: 6 }] });
    });
  });

  describe('refreshUnread', () => {
    it('counts UNREAD in both conversation types and stores the sum', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.getConversations
        .mockResolvedValueOnce({ items: [], total: 4 })
        .mockResolvedValueOnce({ items: [], total: 2 });

      const unread = await service.refreshUnread(USER, ACCOUNT);

      expect(unread).toBe(6);
      expect(client.getConversations).toHaveBeenNthCalledWith(
        1,
        'tok',
        { type: EbayConversationType.FROM_MEMBERS, status: EbayConversationStatus.UNREAD, limit: 1, offset: 0 },
        EbayCallPriority.INTERACTIVE
      );
      expect(client.getConversations).toHaveBeenNthCalledWith(
        2,
        'tok',
        { type: EbayConversationType.FROM_EBAY, status: EbayConversationStatus.UNREAD, limit: 1, offset: 0 },
        EbayCallPriority.INTERACTIVE
      );
      const update = db.query.mock.calls.find(([sql]) => /UPDATE ebay_accounts/.test(sql as string)) as [string, unknown[]];
      expect(update[0]).toContain('SET unread_message_count = $1, unread_message_synced_at = NOW() WHERE id = $2');
      expect(update[1]).toEqual([6, ACCOUNT]);
    });
  });

  describe('error mapping', () => {
    const listQuery = { ebayAccountId: ACCOUNT, type: EbayConversationType.FROM_MEMBERS, page: 1, limit: 25 };

    it('maps an eBay 5xx to messagingUnavailable', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.getConversations.mockRejectedValue(new EbayMessageApiError(502, [], 'bad gateway'));

      await expect(service.listConversations(USER, listQuery)).rejects.toThrow('ebay.errors.messagingUnavailable');
    });

    it('maps a transport failure to messagingUnavailable', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.getConversations.mockRejectedValue(new Error('ECONNRESET'));

      await expect(service.listConversations(USER, listQuery)).rejects.toThrow('ebay.errors.messagingUnavailable');
    });

    it.each(['insufficient scope', 'Insufficient permissions to fulfill the request', 'Not authorized'])(
      'maps an eBay 403 about scopes/permissions (%s) to messagingScopeMissing',
      async (text) => {
        const { service, db, client } = build();
        answerAccount(db, accountRow());
        client.getConversations.mockRejectedValue(new EbayMessageApiError(403, [1100], text));

        await expect(service.listConversations(USER, listQuery)).rejects.toThrow('ebay.errors.messagingScopeMissing');
      }
    );

    it('maps any other 403 to messagingRejected', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.getConversations.mockRejectedValue(new EbayMessageApiError(403, [355010], 'The conversation is closed'));

      await expect(service.listConversations(USER, listQuery)).rejects.toThrow('ebay.errors.messagingRejected');
    });

    it('maps an eBay 429 (rate limit, after the client retries) to messagingUnavailable, not a rejection', async () => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.getConversations.mockRejectedValue(new EbayMessageApiError(429, [], 'Too many requests'));

      await expect(service.listConversations(USER, listQuery)).rejects.toThrow('ebay.errors.messagingUnavailable');
    });

    it.each([400, 404, 409])('maps an eBay %i to messagingRejected', async (status) => {
      const { service, db, client } = build();
      answerAccount(db, accountRow());
      client.getConversations.mockRejectedValue(new EbayMessageApiError(status, [355001], 'bad input'));

      await expect(service.listConversations(USER, listQuery)).rejects.toThrow('ebay.errors.messagingRejected');
    });
  });
});
