import { CampaignAction, EbayApiResource, EbayCallPriority } from '@repo/shared';
import axios from 'axios';

import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';

import { EbayMarketingClient } from './ebay-marketing.client';

const ctx = { accessToken: 'tok', marketplaceId: 'EBAY_US' };

function build() {
  const acquire = jest.fn().mockResolvedValue(undefined);
  const config = { get: jest.fn().mockReturnValue('https://api.test') };
  const client = new EbayMarketingClient(config as never, { acquire } as never);
  return { client, acquire };
}

function axiosError(status: number, data: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data } });
}

function matchingCampaign(startDate: string) {
  return {
    campaignId: '9876', campaignName: 'N', marketplaceId: ctx.marketplaceId, startDate,
    fundingStrategy: { fundingModel: 'COST_PER_SALE', adRateStrategy: 'FIXED', bidPercentage: '5.0' },
  };
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
    const post = jest.spyOn(axios, 'post').mockRejectedValue(axiosError(409, { errors: [{ errorId: 35021 }] }));
    const get = jest.spyOn(axios, 'get');
    await expect(client.createCampaign(ctx, 'N', '5.0')).resolves.toEqual({ campaignId: null, nameTaken: true });
    expect(post).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
  });

  it('resolves a successful create without Location using matching by-name attributes', async () => {
    const { client } = build();
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: {}, headers: {} });
    const get = jest.spyOn(axios, 'get').mockImplementation(() => Promise.resolve({
      data: matchingCampaign((post.mock.calls[0][1] as { startDate: string }).startDate),
    }));
    await expect(client.createCampaign(ctx, 'N', '5.0')).resolves.toEqual({ campaignId: '9876', nameTaken: false });
    expect(post).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
    expect((get.mock.calls[0][1] as { params: unknown }).params).toEqual({ campaign_name: 'N' });
  });

  it('resolves an ambiguous create after one POST only when by-name matches the request', async () => {
    const { client, acquire } = build();
    const post = jest.spyOn(axios, 'post').mockRejectedValue(axiosError(500, { errors: [] }));
    jest.spyOn(axios, 'get').mockImplementation(() => Promise.resolve({
      data: matchingCampaign((post.mock.calls[0][1] as { startDate: string }).startDate),
    }));
    await expect(client.createCampaign(ctx, 'N', '5.0')).resolves.toEqual({ campaignId: '9876', nameTaken: false });
    expect(post).toHaveBeenCalledTimes(1);
    expect(acquire).toHaveBeenCalledTimes(2);
  });

  it('never adopts an unrelated by-name campaign after an ambiguous create', async () => {
    const { client } = build();
    const error = axiosError(500, { errors: [] });
    const post = jest.spyOn(axios, 'post').mockRejectedValue(error);
    jest.spyOn(axios, 'get').mockImplementation(() => Promise.resolve({
      data: {
        ...matchingCampaign((post.mock.calls[0][1] as { startDate: string }).startDate),
        fundingStrategy: { fundingModel: 'COST_PER_SALE', adRateStrategy: 'FIXED', bidPercentage: '7.0' },
      },
    }));
    await expect(client.createCampaign(ctx, 'N', '5.0')).rejects.toBe(error);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('does not adopt an unrelated campaign after a successful POST with no Location', async () => {
    const { client } = build();
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: {}, headers: {} });
    jest.spyOn(axios, 'get').mockImplementation(() => Promise.resolve({
      data: { ...matchingCampaign((post.mock.calls[0][1] as { startDate: string }).startDate), marketplaceId: 'EBAY_GB' },
    }));
    await expect(client.createCampaign(ctx, 'N', '5.0')).rejects.toThrow('could not be verified');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('returns documented per-item 400 responses and a resolved 207 response', async () => {
    const { client } = build();
    const body = { responses: [{ listingId: '1', statusCode: 400 }] };
    const post = jest.spyOn(axios, 'post').mockRejectedValueOnce(axiosError(400, body)).mockResolvedValueOnce({ status: 207, data: body });
    await expect(client.bulkCreateAds(ctx, 'c1', ['1'], '5.0')).resolves.toEqual(body);
    await expect(client.bulkCreateAds(ctx, 'c1', ['1'], '5.0')).resolves.toEqual(body);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('rethrows request, auth, transport and budget failures', async () => {
    const { client, acquire } = build();
    const post = jest.spyOn(axios, 'post');
    for (const error of [
      axiosError(400, { errors: [{ errorId: 35035 }] }),
      axiosError(401, { errors: [{ errorId: 1 }] }),
      axiosError(401, { responses: [{ listingId: '1', statusCode: 401 }] }),
      axiosError(403, { errors: [{ errorId: 1 }] }),
      new Error('connection closed'),
    ]) {
      post.mockRejectedValueOnce(error);
      await expect(client.bulkDeleteAds(ctx, 'c1', ['1'])).rejects.toBe(error);
    }
    const budgetError = new EbayBudgetExhaustedError('marketing', new Date('2026-10-05T00:00:00Z'));
    acquire.mockRejectedValueOnce(budgetError);
    await expect(client.bulkUpdateBids(ctx, 'c1', ['1'], '5.0')).rejects.toBe(budgetError);
    expect(post).toHaveBeenCalledTimes(5);
  });

  it('sends the documented action URL and default rate body', async () => {
    const { client } = build();
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: {} });
    await client.updateDefaultRate(ctx, 'c/1', '5.0');
    await client.campaignAction(ctx, 'c/1', CampaignAction.PAUSE);
    expect(post.mock.calls[0][0]).toBe('https://api.test/sell/marketing/v1/ad_campaign/c%2F1/update_ad_rate_strategy');
    expect(post.mock.calls[0][1]).toEqual({ adRateStrategy: 'FIXED', bidPercentage: '5.0' });
    expect(post.mock.calls[1][0]).toBe('https://api.test/sell/marketing/v1/ad_campaign/c%2F1/pause');
  });

  it('creates a report task with the exact request and reads the id from a trusted Location without charging the ad budget', async () => {
    const { client, acquire } = build();
    const body = { reportType: 'CAMPAIGN_PERFORMANCE_REPORT', reportFormat: 'TSV_GZIP' };
    // Axios' overloaded mock response is `any`; the call itself is asserted below.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const post = jest.spyOn(axios, 'post').mockResolvedValue({
      headers: { location: 'https://api.test/sell/marketing/v1/ad_report_task/task%2F1' },
    } as never);
    await expect(client.createReportTask(ctx, body as never)).resolves.toBe('task/1');
    // Jest asymmetric matcher is intentionally untyped here; the call shape is the assertion.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    expect(post).toHaveBeenCalledWith('https://api.test/sell/marketing/v1/ad_report_task', body, expect.objectContaining({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      headers: expect.objectContaining({ Authorization: 'Bearer tok' }), maxRedirects: 0,
    }));
    expect(acquire).not.toHaveBeenCalled();
  });

  it('rejects an untrusted report task Location before another request', async () => {
    const { client, acquire } = build();
    // Axios' overloaded mock response is `any`; the call itself is asserted below.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ headers: { location: 'https://attacker.test/task/1' } });
    const get = jest.spyOn(axios, 'get');
    await expect(client.createReportTask(ctx, {} as never)).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
    expect(acquire).not.toHaveBeenCalled();
  });

  it('polls and downloads only through configured report endpoints with exact bytes and no ad budget', async () => {
    const { client, acquire } = build();
    const bytes = Buffer.from([0x1f, 0x8b, 0, 255]);
    const get = jest.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: { reportTaskStatus: 'SUCCESS', reportId: 'r/1' } })
      .mockResolvedValueOnce({ data: bytes });
    const task = await client.getReportTask(ctx, 'task/1');
    expect(task).toEqual({ reportTaskStatus: 'SUCCESS', reportId: 'r/1' });
    await expect(client.downloadReport(ctx, 'r/1')).resolves.toEqual(bytes);
    expect(get.mock.calls[0][0]).toBe('https://api.test/sell/marketing/v1/ad_report_task/task%2F1');
    expect(get.mock.calls[1][0]).toBe('https://api.test/sell/marketing/v1/ad_report/r%2F1');
    expect(get.mock.calls[1][1]).toEqual(expect.objectContaining({ responseType: 'arraybuffer', maxRedirects: 0 }));
    expect(acquire).not.toHaveBeenCalled();
  });
});
