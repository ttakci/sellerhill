import { EbayApiResource } from '@repo/shared';

import { EbayNotificationClient } from './ebay-notification.client';

const mockPost = jest.fn<Promise<unknown>, unknown[]>();
const mockGet = jest.fn<Promise<unknown>, unknown[]>();
const mockPut = jest.fn<Promise<unknown>, unknown[]>();
const mockDelete = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));
const mocked = { post: mockPost, get: mockGet, put: mockPut, delete: mockDelete };

describe('EbayNotificationClient', () => {
  const appToken = { get: jest.fn().mockResolvedValue('app-tok'), restBase: () => 'https://api.sandbox.ebay.com', environment: () => 'sandbox' };
  const budget = { acquire: jest.fn().mockResolvedValue(undefined) };
  const client = new EbayNotificationClient(appToken as never, budget as never);
  beforeEach(() => {
    jest.clearAllMocks();
    appToken.get.mockResolvedValue('app-tok');
    budget.acquire.mockResolvedValue(undefined);
  });

  it('creates a destination and reads the id from Location, charging the NOTIFICATION budget', async () => {
    mocked.post.mockResolvedValue({ status: 201, headers: { location: '/commerce/notification/v1/destination/d1' }, data: {} });
    await expect(client.createDestination({ name: 'SellerHill', endpoint: 'https://x/api/v1/ebay/notifications', verificationToken: 'a'.repeat(40) })).resolves.toBe('d1');
    expect(mocked.post).toHaveBeenCalledWith('https://api.sandbox.ebay.com/commerce/notification/v1/destination',
      { name: 'SellerHill', status: 'ENABLED', deliveryConfig: { endpoint: 'https://x/api/v1/ebay/notifications', verificationToken: 'a'.repeat(40) } },
      expect.anything());
    const cfg = mocked.post.mock.calls[0][2] as { headers: Record<string, string> };
    expect(cfg.headers.Authorization).toBe('Bearer app-tok');
    expect(budget.acquire).toHaveBeenCalledWith(EbayApiResource.NOTIFICATION, expect.anything());
  });

  it('surfaces eBay error ids on a 409', async () => {
    mocked.post.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { errors: [{ errorId: 195021, message: 'Destination exists for this endpoint' }] } } });
    await expect(client.createDestination({ name: 'x', endpoint: 'https://x', verificationToken: 'a'.repeat(40) })).rejects.toMatchObject({ status: 409, errorIds: [195021] });
  });

  it('throws when a create answer carries no Location header', async () => {
    mocked.post.mockResolvedValue({ status: 201, headers: {}, data: {} });
    await expect(client.createDestination({ name: 'x', endpoint: 'https://x', verificationToken: 'a'.repeat(40) })).rejects.toMatchObject({ status: 201, errorIds: [] });
  });

  it('creates a subscription with the USER token', async () => {
    mocked.post.mockResolvedValue({ status: 201, headers: { location: '/commerce/notification/v1/subscription/s1' }, data: {} });
    await expect(client.createSubscription('user-tok', { topicId: 'NEW_MESSAGE', destinationId: 'd1', payload: { format: 'JSON', schemaVersion: '1.0', deliveryProtocol: 'HTTPS' } })).resolves.toBe('s1');
    const [, body, cfg] = mocked.post.mock.calls[0];
    expect(body).toEqual({ topicId: 'NEW_MESSAGE', status: 'ENABLED', destinationId: 'd1', payload: { format: 'JSON', schemaVersion: '1.0', deliveryProtocol: 'HTTPS' } });
    expect((cfg as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer user-tok');
    expect(appToken.get).not.toHaveBeenCalled();
  });

  it('reads the first supported payload of a topic', async () => {
    mocked.get.mockResolvedValue({ status: 200, data: { topicId: 'NEW_MESSAGE', supportedPayloads: [{ format: ['JSON'], schemaVersion: '1.0', deliveryProtocol: 'HTTPS' }] } }); // eBay's real shape: format is an array
    await expect(client.getTopic('NEW_MESSAGE')).resolves.toEqual({ format: 'JSON', schemaVersion: '1.0', deliveryProtocol: 'HTTPS' });
  });

  it('fetches a public key by kid', async () => {
    mocked.get.mockResolvedValue({ status: 200, data: { key: '-----BEGIN PUBLIC KEY-----abc-----END PUBLIC KEY-----', algorithm: 'ECDSA', digest: 'SHA1' } });
    await expect(client.getPublicKey('k1')).resolves.toMatchObject({ digest: 'SHA1' });
    expect(mocked.get).toHaveBeenCalledWith('https://api.sandbox.ebay.com/commerce/notification/v1/public_key/k1', expect.anything());
  });

  it('maps destinations and subscriptions lists', async () => {
    mocked.get.mockResolvedValueOnce({ status: 200, data: { destinations: [{ destinationId: 'd1', status: 'ENABLED', deliveryConfig: { endpoint: 'https://x' } }] } });
    await expect(client.listDestinations()).resolves.toEqual([{ destinationId: 'd1', endpoint: 'https://x', status: 'ENABLED' }]);
    mocked.get.mockResolvedValueOnce({ status: 200, data: { subscriptions: [{ subscriptionId: 's1', topicId: 'NEW_MESSAGE', destinationId: 'd1', status: 'ENABLED' }] } });
    await expect(client.listSubscriptions('user-tok')).resolves.toEqual([{ subscriptionId: 's1', topicId: 'NEW_MESSAGE', destinationId: 'd1', status: 'ENABLED' }]);
    expect(mocked.get.mock.calls[1][0]).toBe('https://api.sandbox.ebay.com/commerce/notification/v1/subscription?limit=100');
  });

  it('deletes a subscription and puts the config', async () => {
    mocked.delete.mockResolvedValue({ status: 204, data: undefined });
    mocked.put.mockResolvedValue({ status: 204, data: undefined });
    await client.deleteSubscription('user-tok', 's1');
    expect(mocked.delete).toHaveBeenCalledWith('https://api.sandbox.ebay.com/commerce/notification/v1/subscription/s1', expect.anything());
    await client.putConfig('ops@x.com');
    expect(mocked.put).toHaveBeenCalledWith('https://api.sandbox.ebay.com/commerce/notification/v1/config', { alertEmail: 'ops@x.com' }, expect.anything());
  });
});
