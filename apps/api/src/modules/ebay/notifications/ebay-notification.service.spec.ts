import { EbayNotificationApiError } from './ebay-notification.client';
import { EbayNotificationService } from './ebay-notification.service';

describe('EbayNotificationService', () => {
  const env = { EBAY_NOTIFICATION_VERIFICATION_TOKEN: 'v'.repeat(40), EBAY_NOTIFICATION_ALERT_EMAIL: 'ops@x.com', FRONTEND_URL: 'https://app.x.com/' };
  const config = { get: (k: string) => (env as Record<string, string>)[k] } as never;
  const appToken = { get: jest.fn().mockResolvedValue('app'), restBase: () => 'https://api.ebay.com', environment: () => 'production' } as never;
  let client: Record<string, jest.Mock>; let db: { query: jest.Mock }; let svc: EbayNotificationService;
  beforeEach(() => {
    client = { putConfig: jest.fn(), createDestination: jest.fn(), listDestinations: jest.fn(), getTopic: jest.fn().mockResolvedValue({ format: 'JSON', schemaVersion: '1.0', deliveryProtocol: 'HTTPS' }), createSubscription: jest.fn(), listSubscriptions: jest.fn(), deleteSubscription: jest.fn(), getPublicKey: jest.fn() };
    db = { query: jest.fn().mockResolvedValue([]) };
    svc = new EbayNotificationService(client as never, db as never, config, appToken);
  });

  it('is disabled without a valid token or alert e-mail', () => {
    const bad = new EbayNotificationService(client as never, db as never, { get: () => undefined } as never, appToken);
    expect(bad.isEnabled()).toBe(false);
    expect(svc.isEnabled()).toBe(true);
    expect(svc.endpointUrl()).toBe('https://app.x.com/api/v1/ebay/notifications');
  });

  it('prefers EBAY_NOTIFICATION_ENDPOINT_URL and rejects a malformed token', () => {
    const customEnv: Record<string, string> = { ...env, EBAY_NOTIFICATION_ENDPOINT_URL: 'https://hooks.x.com/ebay', EBAY_NOTIFICATION_VERIFICATION_TOKEN: 'short' };
    const custom = new EbayNotificationService(client as never, db as never, { get: (k: string) => customEnv[k] } as never, appToken);
    expect(custom.endpointUrl()).toBe('https://hooks.x.com/ebay');
    expect(custom.isEnabled()).toBe(false);
    expect(custom.verificationToken()).toBeNull();
    expect(svc.verificationToken()).toBe('v'.repeat(40));
  });

  it('ensureDestination creates once and persists the id', async () => {
    client.createDestination.mockResolvedValue('d1');
    await expect(svc.ensureDestination()).resolves.toBe('d1');
    await expect(svc.ensureDestination()).resolves.toBe('d1');
    expect(client.putConfig).toHaveBeenCalledWith('ops@x.com');
    expect(client.createDestination).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ebay_notification_destinations'), expect.arrayContaining(['production', 'https://app.x.com/api/v1/ebay/notifications', 'd1']));
  });

  it('ensureDestination adopts an existing destination on 195021', async () => {
    client.createDestination.mockRejectedValue(new EbayNotificationApiError(409, [195021], 'exists'));
    client.listDestinations.mockResolvedValue([{ destinationId: 'd9', endpoint: 'https://app.x.com/api/v1/ebay/notifications', status: 'ENABLED' }]);
    await expect(svc.ensureDestination()).resolves.toBe('d9');
  });

  it('ensureDestination reuses the stored row before calling eBay', async () => {
    db.query.mockResolvedValueOnce([{ destination_id: 'stored' }]);
    await expect(svc.ensureDestination()).resolves.toBe('stored');
    expect(client.createDestination).not.toHaveBeenCalled();
  });

  it('ensureDestination returns null (never throws) when eBay refuses', async () => {
    client.createDestination.mockRejectedValue(new EbayNotificationApiError(400, [195000], 'bad'));
    await expect(svc.ensureDestination()).resolves.toBeNull();
  });

  it('subscribeAccount creates and stamps the row; 195012 adopts; 195011 reports scope_missing', async () => {
    client.createDestination.mockResolvedValue('d1');
    client.createSubscription.mockResolvedValueOnce('s1');
    await expect(svc.subscribeAccount('acc', 'user-tok')).resolves.toBe('created');
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('message_subscription_id = $1'), ['s1', 'acc']);
    client.createSubscription.mockRejectedValueOnce(new EbayNotificationApiError(409, [195012], 'exists'));
    client.listSubscriptions.mockResolvedValue([{ subscriptionId: 's-old', topicId: 'NEW_MESSAGE', destinationId: 'd1', status: 'ENABLED' }]);
    await expect(svc.subscribeAccount('acc', 'user-tok')).resolves.toBe('existing');
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('message_subscription_id = $1'), ['s-old', 'acc']);
    client.createSubscription.mockRejectedValueOnce(new EbayNotificationApiError(403, [195011], 'scope'));
    await expect(svc.subscribeAccount('acc', 'user-tok')).resolves.toBe('scope_missing');
  });

  it('subscribeAccount never throws — any other failure is failed', async () => {
    client.createDestination.mockResolvedValue('d1');
    client.createSubscription.mockRejectedValueOnce(new Error('network down'));
    await expect(svc.subscribeAccount('acc', 'user-tok')).resolves.toBe('failed');
    client.getTopic.mockRejectedValueOnce(new Error('topic down'));
    await expect(svc.subscribeAccount('acc', 'user-tok')).resolves.toBe('failed');
  });

  it('subscribeAccount is a no-op when disabled', async () => {
    const off = new EbayNotificationService(client as never, db as never, { get: () => undefined } as never, appToken);
    await expect(off.subscribeAccount('acc', 't')).resolves.toBe('disabled');
    expect(client.createSubscription).not.toHaveBeenCalled();
  });

  it('unsubscribeAccount deletes the stored subscription, clears the column and swallows eBay errors', async () => {
    db.query.mockResolvedValueOnce([{ message_subscription_id: 's1' }]);
    client.deleteSubscription.mockRejectedValueOnce(new EbayNotificationApiError(404, [195002], 'gone'));
    await expect(svc.unsubscribeAccount('acc', 'user-tok')).resolves.toBeUndefined();
    expect(client.deleteSubscription).toHaveBeenCalledWith('user-tok', 's1');
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('message_subscription_id = NULL'), ['acc']);
  });

  it('unsubscribeAccount does nothing on eBay when no subscription is stored, and never throws', async () => {
    db.query.mockResolvedValueOnce([{ message_subscription_id: null }]);
    await svc.unsubscribeAccount('acc', 'user-tok');
    expect(client.deleteSubscription).not.toHaveBeenCalled();
    db.query.mockRejectedValueOnce(new Error('db down'));
    await expect(svc.unsubscribeAccount('acc', 'user-tok')).resolves.toBeUndefined();
  });

  it('caches public keys by kid and returns null on failure', async () => {
    client.getPublicKey.mockResolvedValueOnce({ key: 'PEM', algorithm: 'ECDSA', digest: 'SHA1' });
    expect(await svc.publicKey('k')).toBe('PEM');
    expect(await svc.publicKey('k')).toBe('PEM');
    expect(client.getPublicKey).toHaveBeenCalledTimes(1);
    client.getPublicKey.mockRejectedValueOnce(new EbayNotificationApiError(404, [195001], 'no'));
    expect(await svc.publicKey('other')).toBeNull();
  });

  it('negative-caches a failed kid for 10 minutes — one eBay call for repeated lookups', async () => {
    jest.useFakeTimers();
    try {
      client.getPublicKey.mockRejectedValue(new EbayNotificationApiError(404, [195001], 'no'));
      expect(await svc.publicKey('bad-kid-1')).toBeNull();
      expect(await svc.publicKey('bad-kid-1')).toBeNull();
      expect(client.getPublicKey).toHaveBeenCalledTimes(1);
      // An empty key is a failure too.
      client.getPublicKey.mockResolvedValueOnce({ key: '' });
      expect(await svc.publicKey('empty-kid')).toBeNull();
      expect(await svc.publicKey('empty-kid')).toBeNull();
      expect(client.getPublicKey).toHaveBeenCalledTimes(2);
      // After the window the kid is looked up again.
      jest.advanceTimersByTime(10 * 60 * 1000 + 1);
      client.getPublicKey.mockResolvedValueOnce({ key: 'PEM2' });
      expect(await svc.publicKey('bad-kid-1')).toBe('PEM2');
      expect(client.getPublicKey).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });

  describe('onApplicationBootstrap', () => {
    afterEach(() => {
      jest.useRealTimers();
    });
    it('schedules ensureDestination after 20s only when enabled', async () => {
      jest.useFakeTimers();
      client.createDestination.mockResolvedValue('d1');
      svc.onApplicationBootstrap();
      expect(client.createDestination).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(20_000);
      expect(client.createDestination).toHaveBeenCalledTimes(1);
      const off = new EbayNotificationService(client as never, db as never, { get: () => undefined } as never, appToken);
      off.onApplicationBootstrap();
      await jest.advanceTimersByTimeAsync(20_000);
      expect(client.createDestination).toHaveBeenCalledTimes(1);
    });
  });

  describe('recordDelivery', () => {
    const parsed = (over: Partial<Record<string, unknown>> = {}) => ({ notificationId: 'n1', topic: 'NEW_MESSAGE', eventDate: null, publishAttemptCount: 1, data: { messageId: 'm', conversationId: 'c', conversationType: 'FROM_MEMBERS', recipientUserName: 'seller-id', senderUserName: 'b', readStatus: false, ...over } });
    it('counts an unread message for the active store and inserts the event once', async () => {
      db.query.mockResolvedValueOnce([{ id: 'acc' }]);                          // account lookup
      db.query.mockResolvedValueOnce([{ counted: false }]);                       // same-conversation check
      db.query.mockResolvedValueOnce([{ id: 1 }]);                                // INSERT … RETURNING id
      await expect(svc.recordDelivery(parsed())).resolves.toEqual({ stored: true, outcome: 'counted' });
      const lookup = (db.query.mock.calls as unknown[][])[0];
      expect(lookup[0]).toMatch(/seller_id = \$1 OR LOWER\(ebay_username\) = LOWER\(\$1\)/);
      expect(lookup[0]).toMatch(/status = 'active'/);
      expect(lookup[0]).toMatch(/message_subscription_id IS NOT NULL/);
      expect(lookup[0]).toMatch(/LIMIT 2/);
      expect(lookup[0]).not.toMatch(/ORDER BY/);
      expect(lookup[1]).toEqual(['seller-id']);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('unread_message_count = unread_message_count + 1'), ['acc']);
    });
    it('counts a conversation once per sync window — a second message in it is stored, not counted', async () => {
      db.query.mockResolvedValueOnce([{ id: 'acc' }]);
      db.query.mockResolvedValueOnce([{ counted: true }]);
      db.query.mockResolvedValueOnce([{ id: 7 }]);
      await expect(svc.recordDelivery(parsed({ messageId: 'm2' }))).resolves.toEqual({ stored: true, outcome: 'counted_same_conversation' });
      const check = (db.query.mock.calls as unknown[][])[1];
      expect(check[0]).toMatch(/outcome = 'counted'/);
      expect(check[0]).toMatch(/received_at > COALESCE\(a\.unread_message_synced_at, '-infinity'\)/);
      expect(check[1]).toEqual(['acc', 'c']);
      expect((db.query.mock.calls as unknown[][])[2][1]).toEqual(expect.arrayContaining(['counted_same_conversation']));
      expect(db.query).not.toHaveBeenCalledWith(expect.stringContaining('unread_message_count + 1'), expect.anything());
    });
    it('a redelivered notification does not double-count', async () => {
      db.query.mockResolvedValueOnce([{ id: 'acc' }]);
      db.query.mockResolvedValueOnce([{ counted: false }]);
      db.query.mockResolvedValueOnce([]);                                         // ON CONFLICT DO NOTHING → no row
      await expect(svc.recordDelivery(parsed({ publishAttemptCount: 2 }))).resolves.toEqual({ stored: false, outcome: 'duplicate' });
      expect(db.query).not.toHaveBeenCalledWith(expect.stringContaining('unread_message_count + 1'), expect.anything());
    });
    it('books an ambiguous recipient (two stores match) without counting and without an account id', async () => {
      db.query.mockResolvedValueOnce([{ id: 'acc-a' }, { id: 'acc-b' }]);
      db.query.mockResolvedValueOnce([{ id: 2 }]);
      await expect(svc.recordDelivery(parsed())).resolves.toEqual({ stored: true, outcome: 'ambiguous_account' });
      const insert = (db.query.mock.calls as unknown[][])[1];
      expect(insert[0]).toContain('INSERT INTO ebay_notification_events');
      expect((insert[1] as unknown[])[2]).toBeNull();
      expect((insert[1] as unknown[])[5]).toBe('ambiguous_account');
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(db.query).not.toHaveBeenCalledWith(expect.stringContaining('unread_message_count + 1'), expect.anything());
    });
    it('a redelivered ambiguous notification is a duplicate', async () => {
      db.query.mockResolvedValueOnce([{ id: 'acc-a' }, { id: 'acc-b' }]);
      db.query.mockResolvedValueOnce([]);
      await expect(svc.recordDelivery(parsed())).resolves.toEqual({ stored: false, outcome: 'duplicate' });
    });
    it('stores an unknown recipient as no_account and an already-read message without counting', async () => {
      db.query.mockResolvedValueOnce([]); db.query.mockResolvedValueOnce([{ id: 3 }]);
      await expect(svc.recordDelivery(parsed())).resolves.toEqual({ stored: true, outcome: 'no_account' });
      db.query.mockResolvedValueOnce([{ id: 'acc' }]); db.query.mockResolvedValueOnce([{ id: 4 }]);
      await expect(svc.recordDelivery(parsed({ readStatus: true }))).resolves.toEqual({ stored: true, outcome: 'already_read' });
      expect(db.query).not.toHaveBeenCalledWith(expect.stringContaining('unread_message_count + 1'), expect.anything());
    });
    it('stores an unknown topic as ignored', async () => {
      db.query.mockResolvedValueOnce([{ id: 5 }]);
      await expect(svc.recordDelivery({ ...parsed(), topic: 'SOMETHING_ELSE' })).resolves.toEqual({ stored: true, outcome: 'ignored' });
      expect(db.query).toHaveBeenCalledTimes(1);
    });
    it('stores an unparseable NEW_MESSAGE payload as ignored without an account lookup', async () => {
      db.query.mockResolvedValueOnce([{ id: 6 }]);
      await expect(svc.recordDelivery({ ...parsed(), data: { messageId: 'm' } })).resolves.toEqual({ stored: true, outcome: 'ignored' });
      expect(db.query).toHaveBeenCalledTimes(1);
      expect((db.query.mock.calls as unknown[][])[0][0]).toContain('INSERT INTO ebay_notification_events');
    });
  });
});
