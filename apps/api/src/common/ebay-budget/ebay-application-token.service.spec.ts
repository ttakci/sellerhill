import { ConfigService } from '@nestjs/config';

import { EbayApplicationTokenService } from './ebay-application-token.service';

function config(values: Record<string, string>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

describe('EbayApplicationTokenService', () => {
  const values = { EBAY_CLIENT_ID: 'id', EBAY_CLIENT_SECRET: 'secret', EBAY_TOKEN_URL: 'https://t/x', EBAY_REST_API_URL: 'https://api.sandbox.ebay.com/', EBAY_ENVIRONMENT: 'sandbox' };
  afterEach(() => jest.restoreAllMocks());

  it('mints a client-credentials token and caches it', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ access_token: 'tok', expires_in: 7200 }), { status: 200 }));
    const svc = new EbayApplicationTokenService(config(values));
    expect(await svc.get()).toBe('tok');
    expect(await svc.get()).toBe('tok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = String((fetchMock.mock.calls[0][1] as RequestInit).body);
    expect(body).toContain('grant_type=client_credentials');
    expect(svc.restBase()).toBe('https://api.sandbox.ebay.com');
    expect(svc.environment()).toBe('sandbox');
  });

  it('throws when eBay refuses the token', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('nope', { status: 401 }));
    await expect(new EbayApplicationTokenService(config(values)).get()).rejects.toThrow(/401/);
  });

  it('throws when credentials are missing', async () => {
    await expect(new EbayApplicationTokenService(config({})).get()).rejects.toThrow(/not configured/);
  });
});
