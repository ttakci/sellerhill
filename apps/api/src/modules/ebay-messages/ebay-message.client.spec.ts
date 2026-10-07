import {
  EbayApiResource,
  EbayCallPriority,
  EbayConversationStatus,
  EbayConversationType,
} from '@repo/shared';

import { EbayMessageApiError, EbayMessageClient, mapConversation, mapMessage } from './ebay-message.client';

const mockPost = jest.fn<Promise<unknown>, unknown[]>();
const mockGet = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

const BASE = 'https://api.sandbox.ebay.com/commerce/message/v1';

const rawMessage = {
  messageId: 'm1',
  subject: 'Hi',
  messageBody: 'hello',
  senderUsername: 'buyer',
  recipientUsername: 'seller',
  readStatus: false,
  createdDate: '2026-01-02T00:00:00.000Z',
  messageMedia: [],
};

const rawConversation = {
  conversationId: 'c1',
  conversationTitle: 'Hi',
  conversationType: 'FROM_MEMBERS',
  conversationStatus: 'ACTIVE',
  unreadCount: 2,
  referenceType: 'LISTING',
  referenceId: '1234',
  createdDate: '2026-01-01T00:00:00.000Z',
  latestMessage: rawMessage,
};

describe('EbayMessageClient', () => {
  const budget = { acquire: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn((key: string) => (key === 'EBAY_REST_API_URL' ? 'https://api.sandbox.ebay.com/' : undefined)) };
  const client = new EbayMessageClient(budget as never, config as never);

  beforeEach(() => {
    jest.clearAllMocks();
    budget.acquire.mockResolvedValue(undefined);
  });

  it('lists conversations with the required type, the user token and the MESSAGE budget', async () => {
    mockGet.mockResolvedValue({ status: 200, data: { conversations: [rawConversation], total: 1 } });

    const result = await client.getConversations(
      'tok',
      { type: EbayConversationType.FROM_MEMBERS, status: EbayConversationStatus.UNREAD, limit: 25, offset: 25 },
      EbayCallPriority.INTERACTIVE
    );

    const [url, cfg] = mockGet.mock.calls[0] as [string, { params: Record<string, unknown>; headers: Record<string, string> }];
    expect(url).toBe(`${BASE}/conversation`);
    expect(cfg.params).toEqual({ conversation_type: 'FROM_MEMBERS', conversation_status: 'UNREAD', limit: 25, offset: 25 });
    expect(cfg.headers.Authorization).toBe('Bearer tok');
    expect(budget.acquire).toHaveBeenCalledWith(EbayApiResource.MESSAGE, EbayCallPriority.INTERACTIVE);
    expect(result).toEqual({
      items: [
        {
          conversationId: 'c1',
          type: EbayConversationType.FROM_MEMBERS,
          status: EbayConversationStatus.ACTIVE,
          title: 'Hi',
          unreadCount: 2,
          referenceType: 'LISTING',
          referenceId: '1234',
          createdAt: '2026-01-01T00:00:00.000Z',
          latestMessage: {
            messageId: 'm1',
            subject: 'Hi',
            body: 'hello',
            senderUsername: 'buyer',
            recipientUsername: 'seller',
            read: false,
            createdAt: '2026-01-02T00:00:00.000Z',
            media: [],
          },
          otherPartyUsername: null,
          imageUrl: null,
        },
      ],
      total: 1,
    });
  });

  it('sends ARCHIVED / DELETED for the archive and deleted folders and maps them back', async () => {
    mockGet.mockResolvedValue({
      status: 200,
      data: { conversations: [{ ...rawConversation, conversationStatus: 'ARCHIVED' }], total: 1 },
    });

    const archived = await client.getConversations(
      'tok',
      { type: EbayConversationType.FROM_MEMBERS, status: EbayConversationStatus.ARCHIVE, limit: 25, offset: 0 },
      EbayCallPriority.INTERACTIVE
    );
    await client.getConversations(
      'tok',
      { type: EbayConversationType.FROM_EBAY, status: EbayConversationStatus.DELETE, limit: 25, offset: 0 },
      EbayCallPriority.INTERACTIVE
    );

    const statuses = mockGet.mock.calls.map((call) => (call[1] as { params: Record<string, unknown> }).params.conversation_status);
    expect(statuses).toEqual(['ARCHIVED', 'DELETED']);
    expect(archived.items[0].status).toBe(EbayConversationStatus.ARCHIVE);
  });

  it('counts unread FROM_EBAY from unreadCount across every page, because eBay ignores the UNREAD filter there', async () => {
    const conv = (id: string, unreadCount: number) => ({ ...rawConversation, conversationId: id, conversationType: 'FROM_EBAY', unreadCount });
    const firstPage = Array.from({ length: 50 }, (_, i) => conv(`a${i}`, i === 3 ? 1 : 0));
    mockGet
      .mockResolvedValueOnce({ status: 200, data: { conversations: firstPage, total: 52 } })
      .mockResolvedValueOnce({ status: 200, data: { conversations: [conv('b0', 2), conv('b1', 0)], total: 52 } });

    const result = await client.getConversations(
      'tok',
      { type: EbayConversationType.FROM_EBAY, status: EbayConversationStatus.UNREAD, limit: 25, offset: 0 },
      EbayCallPriority.BACKGROUND
    );

    const params = mockGet.mock.calls.map((call) => (call[1] as { params: Record<string, unknown> }).params);
    expect(params).toEqual([
      { conversation_type: 'FROM_EBAY', limit: 50, offset: 0 },
      { conversation_type: 'FROM_EBAY', limit: 50, offset: 50 },
    ]);
    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.conversationId)).toEqual(['a3', 'b0']);
  });

  it('passes the reference and other-party filters and clamps limit to 50', async () => {
    mockGet.mockResolvedValue({ status: 200, data: {} });
    const result = await client.getConversations(
      'tok',
      { type: EbayConversationType.FROM_EBAY, limit: 500, offset: 0, referenceId: '99', otherPartyUsername: 'bob' },
      EbayCallPriority.BACKGROUND
    );
    const cfg = mockGet.mock.calls[0][1] as { params: Record<string, unknown> };
    expect(cfg.params).toEqual({
      conversation_type: 'FROM_EBAY',
      limit: 50,
      offset: 0,
      reference_type: 'LISTING',
      reference_id: '99',
      other_party_username: 'bob',
    });
    expect(result).toEqual({ items: [], total: 0 });
    expect(budget.acquire).toHaveBeenCalledWith(EbayApiResource.MESSAGE, EbayCallPriority.BACKGROUND);
  });

  it('reads one conversation thread', async () => {
    mockGet.mockResolvedValue({
      status: 200,
      data: {
        conversationStatus: 'ARCHIVE',
        conversationTitle: 'Order question',
        conversationType: 'FROM_MEMBERS',
        messages: [rawMessage, { bogus: true }],
      },
    });
    const result = await client.getConversation(
      'tok',
      'c 1',
      EbayConversationType.FROM_MEMBERS,
      { limit: 80, offset: 10 },
      EbayCallPriority.INTERACTIVE
    );
    const [url, cfg] = mockGet.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(url).toBe(`${BASE}/conversation/c%201`);
    expect(cfg.params).toEqual({ conversation_type: 'FROM_MEMBERS', limit: 50, offset: 10 });
    expect(result.conversation).toEqual({
      conversationId: 'c 1',
      type: EbayConversationType.FROM_MEMBERS,
      status: EbayConversationStatus.ARCHIVE,
      title: 'Order question',
    });
    expect(result.messages.map((m) => m.messageId)).toEqual(['m1']);
    expect(result.total).toBe(1);
    expect(budget.acquire).toHaveBeenCalledWith(EbayApiResource.MESSAGE, EbayCallPriority.INTERACTIVE);
  });

  it('sends a reply with a listing reference', async () => {
    mockPost.mockResolvedValue({ status: 201, data: { messageId: 'm9' } });
    await expect(
      client.sendMessage('tok', { conversationId: 'c1', text: 'hi', referenceItemId: '1234' }, EbayCallPriority.INTERACTIVE)
    ).resolves.toEqual({ messageId: 'm9' });
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe(`${BASE}/send_message`);
    expect(body).toEqual({ conversationId: 'c1', messageText: 'hi', reference: { referenceType: 'LISTING', referenceId: '1234' } });
    expect(budget.acquire).toHaveBeenCalledWith(EbayApiResource.MESSAGE, EbayCallPriority.INTERACTIVE);
  });

  it('omits the reference when there is no item id', async () => {
    mockPost.mockResolvedValue({ status: 201, data: { messageId: 'm9' } });
    await client.sendMessage('tok', { otherPartyUsername: 'buyer', text: 'hi' }, EbayCallPriority.INTERACTIVE);
    expect(mockPost.mock.calls[0][1]).toEqual({ otherPartyUsername: 'buyer', messageText: 'hi' });
  });

  it('throws when eBay answers a send without a message id', async () => {
    mockPost.mockResolvedValue({ status: 201, data: {} });
    await expect(
      client.sendMessage('tok', { conversationId: 'c1', text: 'hi' }, EbayCallPriority.INTERACTIVE)
    ).rejects.toBeInstanceOf(EbayMessageApiError);
  });

  it('marks a conversation read', async () => {
    mockPost.mockResolvedValue({ status: 204, data: undefined });
    await client.updateRead('tok', 'c1', EbayConversationType.FROM_MEMBERS, true, EbayCallPriority.INTERACTIVE);
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe(`${BASE}/update_conversation`);
    expect(body).toEqual({ conversationId: 'c1', conversationType: 'FROM_MEMBERS', read: true });
    expect(budget.acquire).toHaveBeenCalledWith(EbayApiResource.MESSAGE, EbayCallPriority.INTERACTIVE);
  });

  // Response shape from eBay's commerce_message_v1_oas3.json (BulkUpdateConversationsResponse):
  // `conversationsResponse[].updateStatus` is SUCCESS / FAILURE, plus `conversationsMetadata` counts.
  it('bulk-updates status and splits succeeded from failed', async () => {
    mockPost.mockResolvedValue({
      status: 200,
      data: {
        conversationsMetadata: { totalConversationsCount: 3, updateSuccessCount: 1, updateFailureCount: 1 },
        conversationsResponse: [
          { conversationId: 'c1', updateStatus: 'SUCCESS' },
          { conversationId: 'c2', updateStatus: 'FAILURE' },
        ],
      },
    });
    const result = await client.bulkUpdateStatus(
      'tok',
      EbayConversationType.FROM_MEMBERS,
      ['c1', 'c2', 'c3'],
      EbayConversationStatus.ARCHIVE,
      EbayCallPriority.INTERACTIVE
    );
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe(`${BASE}/bulk_update_conversation`);
    expect(body).toEqual({
      conversations: ['c1', 'c2', 'c3'].map((id) => ({
        conversationId: id,
        conversationType: 'FROM_MEMBERS',
        conversationStatus: 'ARCHIVE',
      })),
    });
    // c3 was not reported back — counted as failed, never as success.
    expect(result).toEqual({ succeeded: ['c1'], failed: ['c2', 'c3'] });
    expect(budget.acquire).toHaveBeenCalledWith(EbayApiResource.MESSAGE, EbayCallPriority.INTERACTIVE);
  });

  it('reads an all-success bulk answer that carries only the metadata counts', async () => {
    mockPost.mockResolvedValue({
      status: 200,
      data: { conversationsMetadata: { totalConversationsCount: 2, updateSuccessCount: 2, updateFailureCount: 0 } },
    });
    const result = await client.bulkUpdateStatus(
      'tok',
      EbayConversationType.FROM_MEMBERS,
      ['c1', 'c2'],
      EbayConversationStatus.DELETE,
      EbayCallPriority.INTERACTIVE
    );
    expect(result).toEqual({ succeeded: ['c1', 'c2'], failed: [] });
  });

  it('turns an HTTP error into an EbayMessageApiError carrying the eBay ids', async () => {
    mockGet.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { errors: [{ errorId: 1100, message: 'Access denied' }, { errorId: 'x' }] } },
    });
    const call = client.getConversations(
      'tok',
      { type: EbayConversationType.FROM_MEMBERS, limit: 10, offset: 0 },
      EbayCallPriority.INTERACTIVE
    );
    await expect(call).rejects.toBeInstanceOf(EbayMessageApiError);
    await expect(call).rejects.toMatchObject({ status: 403, errorIds: [1100], message: 'Access denied' });
  });

  it('rethrows a non-HTTP failure untouched', async () => {
    const boom = new Error('socket hang up');
    mockGet.mockRejectedValue(boom);
    await expect(
      client.getConversations('tok', { type: EbayConversationType.FROM_MEMBERS, limit: 10, offset: 0 }, EbayCallPriority.INTERACTIVE)
    ).rejects.toBe(boom);
  });
});

describe('mapConversation / mapMessage', () => {
  it('returns null on input without an id', () => {
    expect(mapConversation(null)).toBeNull();
    expect(mapConversation('x')).toBeNull();
    expect(mapConversation({ conversationId: 5 })).toBeNull();
    expect(mapMessage(undefined)).toBeNull();
    expect(mapMessage({ messageBody: 'x' })).toBeNull();
  });

  it('fills safe defaults for missing fields', () => {
    expect(mapConversation({ conversationId: 'c1' })).toEqual({
      conversationId: 'c1',
      type: EbayConversationType.FROM_MEMBERS,
      status: EbayConversationStatus.ACTIVE,
      title: null,
      unreadCount: 0,
      referenceType: null,
      referenceId: null,
      createdAt: '',
      latestMessage: null,
      otherPartyUsername: null,
      imageUrl: null,
    });
    expect(mapMessage({ messageId: 'm1', readStatus: true, messageMedia: [{ mediaName: 'a.jpg', mediaType: 'IMAGE', mediaUrl: 'https://i' }, 3] })).toEqual({
      messageId: 'm1',
      subject: null,
      body: '',
      senderUsername: '',
      recipientUsername: '',
      read: true,
      createdAt: '',
      media: [{ mediaName: 'a.jpg', mediaType: 'IMAGE', mediaUrl: 'https://i' }],
    });
  });

  it('maps FROM_EBAY and a non-enum status defensively', () => {
    const c = mapConversation({ conversationId: 'c1', conversationType: 'FROM_EBAY', conversationStatus: 'WHATEVER' });
    expect(c?.type).toBe(EbayConversationType.FROM_EBAY);
    expect(c?.status).toBe(EbayConversationStatus.ACTIVE);
  });
});
