// apps/api/src/modules/buyer-messaging/buyer-message.provider.spec.ts
import { EbayCallPriority } from '@repo/shared';

import { EbayMessageApiProvider } from './buyer-message.provider';

interface SentMessage {
  otherPartyUsername?: string;
  text: string;
  referenceItemId?: string;
}

function makeClient() {
  return {
    sendMessage: jest.fn<Promise<{ messageId: string }>, [string, SentMessage, EbayCallPriority]>(),
  };
}

function makeEbay() {
  return { getAccountAccessToken: jest.fn<Promise<string>, [string]>() };
}

describe('EbayMessageApiProvider', () => {
  it('sends a new conversation to the buyer with the listing reference', async () => {
    const client = makeClient();
    client.sendMessage.mockResolvedValue({ messageId: 'm1' });
    const ebay = makeEbay();
    ebay.getAccountAccessToken.mockResolvedValue('tok');
    const provider = new EbayMessageApiProvider(client as never, ebay as never);

    await expect(
      provider.sendMessage({
        ebayAccountId: 'a',
        orderId: 'o',
        ebayItemId: '1234',
        buyerUsername: 'buyer',
        body: 'hi',
      }),
    ).resolves.toEqual({ providerMessageId: 'm1' });

    expect(ebay.getAccountAccessToken).toHaveBeenCalledWith('a');
    expect(client.sendMessage).toHaveBeenCalledWith(
      'tok',
      { otherPartyUsername: 'buyer', text: 'hi', referenceItemId: '1234' },
      EbayCallPriority.BACKGROUND,
    );
  });

  it('omits referenceItemId when the order has no eBay item reference', async () => {
    const client = makeClient();
    client.sendMessage.mockResolvedValue({ messageId: 'm2' });
    const ebay = makeEbay();
    ebay.getAccountAccessToken.mockResolvedValue('tok');
    const provider = new EbayMessageApiProvider(client as never, ebay as never);

    await provider.sendMessage({
      ebayAccountId: 'a',
      orderId: 'o',
      buyerUsername: 'buyer',
      body: 'hi',
    });

    expect(client.sendMessage).toHaveBeenCalledWith(
      'tok',
      { otherPartyUsername: 'buyer', text: 'hi', referenceItemId: undefined },
      EbayCallPriority.BACKGROUND,
    );
  });

  it('truncates the body to the eBay message-length cap', async () => {
    const client = makeClient();
    client.sendMessage.mockResolvedValue({ messageId: 'm3' });
    const ebay = makeEbay();
    ebay.getAccountAccessToken.mockResolvedValue('tok');
    const provider = new EbayMessageApiProvider(client as never, ebay as never);
    const longBody = 'x'.repeat(2100);

    await provider.sendMessage({
      ebayAccountId: 'a',
      orderId: 'o',
      buyerUsername: 'buyer',
      body: longBody,
    });

    const [, sentBody] = client.sendMessage.mock.calls[0];
    expect(sentBody.text).toHaveLength(2000);
  });

  it('propagates errors from the client so the processor can redact + retry', async () => {
    const client = makeClient();
    client.sendMessage.mockRejectedValue(new Error('eBay Message API 500'));
    const ebay = makeEbay();
    ebay.getAccountAccessToken.mockResolvedValue('tok');
    const provider = new EbayMessageApiProvider(client as never, ebay as never);

    await expect(
      provider.sendMessage({ ebayAccountId: 'a', orderId: 'o', buyerUsername: 'buyer', body: 'hi' }),
    ).rejects.toThrow('eBay Message API 500');
  });
});
