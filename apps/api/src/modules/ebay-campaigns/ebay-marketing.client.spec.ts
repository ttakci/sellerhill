import { EbayApiResource, EbayCallPriority } from '@repo/shared';
import axios from 'axios';

import { EbayMarketingClient } from './ebay-marketing.client';

const ctx = { accessToken: 'tok', marketplaceId: 'EBAY_US' };

function build() {
  const acquire = jest.fn().mockResolvedValue(undefined);
  const config = { get: jest.fn().mockReturnValue('https://api.test') };
  const client = new EbayMarketingClient(config as never, { acquire } as never);
  return { client, acquire };
}

describe('EbayMarketingClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('getAds sends listing_ids comma-joined and charges MARKETING_ADS', async () => {
    const { client, acquire } = build();
    const get = jest.spyOn(axios, 'get').mockResolvedValue({ data: { ads: [] } });
    await client.getAds(ctx, 'c1', { listingIds: ['1', '2'], limit: 500 }, EbayCallPriority.BACKGROUND);
    const [url, options] = get.mock.calls[0];
    expect(url).toBe('https://api.test/sell/marketing/v1/ad_campaign/c1/ad');
    expect((options as { params: Record<string, unknown> }).params).toMatchObject({ listing_ids: '1,2', limit: 500 });
    expect(acquire).toHaveBeenCalledWith(EbayApiResource.MARKETING_ADS, EbayCallPriority.BACKGROUND);
  });

  it('createCampaign returns the id from the Location header', async () => {
    const { client } = build();
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: {},
      headers: { location: 'https://api.ebay.com/sell/marketing/v1/ad_campaign/9876' },
    });
    await expect(client.createCampaign(ctx, 'N', '5.0')).resolves.toEqual({ campaignId: '9876', nameTaken: false });
  });

  it('createCampaign reports a taken name (35021)', async () => {
    const { client } = build();
    const error = Object.assign(new Error('x'), {
      isAxiosError: true,
      response: { status: 409, data: { errors: [{ errorId: 35021 }] } },
    });
    jest.spyOn(axios, 'post').mockRejectedValue(error);
    await expect(client.createCampaign(ctx, 'N', '5.0')).resolves.toEqual({ campaignId: null, nameTaken: true });
  });

  it('a bulk 207 body inside an axios error is returned, not thrown', async () => {
    const { client } = build();
    const body = { responses: [{ listingId: '1', statusCode: 400 }] };
    const error = Object.assign(new Error('x'), { isAxiosError: true, response: { status: 207, data: body } });
    jest.spyOn(axios, 'post').mockRejectedValue(error);
    await expect(client.bulkCreateAds(ctx, 'c1', ['1'], '5.0')).resolves.toEqual(body);
  });
});
