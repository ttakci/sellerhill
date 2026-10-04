import axios from 'axios';

import { FinancesClient } from './finances.client';

const mockedGet = jest.spyOn(axios, 'get');

function build(restBase: string | undefined) {
  const config = { get: jest.fn(() => restBase) };
  const budget = { acquire: jest.fn().mockResolvedValue(undefined) };
  return new FinancesClient(config as never, budget as never);
}

describe('FinancesClient.getBillingActivities', () => {
  beforeEach(() => {
    mockedGet.mockClear();
    mockedGet.mockResolvedValue({ data: { billingActivities: [] } });
  });

  // The local OpenAPI (sell-finances-v1-oas3.json) overrides `servers` for
  // /billing_activity alone: https://api.ebay.com — not the apiz host the other
  // Finances paths use. Production answered 404 on apiz (2026-10-04).
  it('calls the api.ebay.com host the OpenAPI names for /billing_activity', async () => {
    await build('https://api.ebay.com').getBillingActivities('token', { filter: 'f', offset: 0 });
    expect(mockedGet.mock.calls[0][0]).toBe('https://api.ebay.com/sell/finances/v1/billing_activity');
  });

  it('falls back to api.ebay.com when no REST base is configured', async () => {
    await build(undefined).getBillingActivities('token', { filter: 'f', offset: 0 });
    expect(mockedGet.mock.calls[0][0]).toBe('https://api.ebay.com/sell/finances/v1/billing_activity');
  });
});
