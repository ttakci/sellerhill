// apps/api/src/modules/amazon/aquiline.client.spec.ts
import { AquilineAccountOrigin, AquilineWebhookEvent } from '@repo/shared';

import {
  AquilineClient,
  AquilineError,
  AquilineErrorKind,
  classifyAquilineFailure,
  extractPlanUsage,
  parseAssignResult,
  type AquilineConfig,
  type AquilineMeResult,
} from './aquiline.client';

describe('classifyAquilineFailure', () => {
  it('reads the provider code rather than grepping the message', () => {
    // Observed live 2026-08-23.
    const err = classifyAquilineFailure(404, {
      success: false,
      code: 'not-found',
      message: 'Profile not found.',
    });
    expect(err.kind).toBe(AquilineErrorKind.NOT_FOUND);
    expect(err.code).toBe('not-found');
  });

  it('does NOT read a quota wall out of an unrelated message', () => {
    // The shipped implementation grepped for /quota|exceeded/ and would have
    // called this a quota failure, silently stopping every later conversion.
    const err = classifyAquilineFailure(400, {
      success: false,
      code: 'validation',
      message: 'The tracking URL exceeded the allowed length.',
    });
    expect(err.kind).toBe(AquilineErrorKind.BAD_REQUEST);
  });

  it('treats 402 as a plan wall, not something to retry', () => {
    expect(classifyAquilineFailure(402, { success: false }).kind).toBe(
      AquilineErrorKind.QUOTA_EXCEEDED,
    );
  });

  it('treats 429 and 5xx as retryable transport', () => {
    expect(classifyAquilineFailure(429, {}).kind).toBe(AquilineErrorKind.TRANSPORT);
    expect(classifyAquilineFailure(503, {}).kind).toBe(AquilineErrorKind.TRANSPORT);
  });

  it('maps 413 to payload-too-large so an oversized HTML upload is diagnosable', () => {
    expect(classifyAquilineFailure(413, {}).kind).toBe(AquilineErrorKind.PAYLOAD_TOO_LARGE);
  });

  it('treats 401/403 as unauthorized', () => {
    expect(classifyAquilineFailure(401, {}).kind).toBe(AquilineErrorKind.UNAUTHORIZED);
    expect(classifyAquilineFailure(403, {}).kind).toBe(AquilineErrorKind.UNAUTHORIZED);
  });

  it('falls back to HTTP status in the message when the body carries no code', () => {
    const err = classifyAquilineFailure(500, {});
    expect(err.message).toBe('HTTP 500');
    expect(err.code).toBeNull();
  });

  it('tolerates a non-object body (e.g. a raw-text error page)', () => {
    const err = classifyAquilineFailure(500, 'nginx 502');
    expect(err.kind).toBe(AquilineErrorKind.TRANSPORT);
  });
});

describe('parseAssignResult', () => {
  it('accepts a well-formed AQUA number and reads optional fields defensively', () => {
    const result = parseAssignResult({
      success: true,
      aquiline: 'AQUAA6435850826YQ',
      chargedCents: 14,
      planLimit: 300,
      planUsed: 1,
      planRemaining: 299,
      reused: true,
    });
    expect(result).toEqual({
      aquiline: 'AQUAA6435850826YQ',
      chargedCents: 14,
      planLimit: 300,
      planUsed: 1,
      planRemaining: 299,
      reused: true,
    });
  });

  it('defaults reused to false when the undocumented field is absent', () => {
    const result = parseAssignResult({
      success: true,
      aquiline: 'AQAA123456789YQ',
      chargedCents: null,
      planLimit: null,
      planUsed: null,
      planRemaining: null,
    });
    expect(result.reused).toBe(false);
  });

  it('never treats a non-boolean reused as true', () => {
    const result = parseAssignResult({ aquiline: 'AQAA123456789YQ', reused: 'true' });
    expect(result.reused).toBe(false);
  });

  it('rejects a tracking number that is not AQUA-shaped as MALFORMED_RESPONSE', () => {
    let caught: unknown;
    try {
      parseAssignResult({ aquiline: 'TBA303940404000' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AquilineError);
    expect((caught as AquilineError).kind).toBe(AquilineErrorKind.MALFORMED_RESPONSE);
  });

  it('rejects a response with no tracking number at all', () => {
    expect(() => parseAssignResult({})).toThrow(AquilineError);
  });
});

describe('extractPlanUsage', () => {
  it('projects the GET /v1/me billing block onto the shared AquilinePlanUsage shape', () => {
    const me: AquilineMeResult = {
      success: true,
      uid: 'seller-1',
      subscriptionActive: true,
      billing: {
        subscription: {
          planCode: 'starter',
          cadence: 'monthly',
          status: 'active',
          currentPeriodStart: '2026-08-23',
          currentPeriodEnd: '2026-09-23',
          pendingPlanCode: null,
          pendingCadence: null,
        },
        usage: { windowKey: '2026-08-23', used: 1, limit: 300, remaining: 299 },
        plan: { code: 'starter', label: 'Starter', trackLimitPerMonth: 300 },
      },
    };
    expect(extractPlanUsage(me)).toEqual({
      planCode: 'starter',
      windowKey: '2026-08-23',
      used: 1,
      limit: 300,
      remaining: 299,
    });
  });
});

// ---------------------------------------------------------------------------
// AquilineClient — routes, auth, and the never-retry-a-4xx retry discipline.
// ---------------------------------------------------------------------------

interface MockResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

function jsonResponse(status: number, body: unknown): MockResponse {
  return { ok: status >= 200 && status < 300, status, text: () => Promise.resolve(JSON.stringify(body)) };
}

function config(overrides: Partial<AquilineConfig> = {}): AquilineConfig {
  return {
    baseUrl: 'https://aquiline-tracking.com/app/api/integration',
    token: 'tok-id.tok-secret',
    profilePrefix: 'sh-test',
    maxProfiles: 10,
    timeoutMs: 5000,
    ...overrides,
  };
}

function callUrl(fetchMock: jest.Mock, index = 0): string {
  return (fetchMock.mock.calls as Array<[string, RequestInit]>)[index][0];
}

function callInit(fetchMock: jest.Mock, index = 0): RequestInit {
  return (fetchMock.mock.calls as Array<[string, RequestInit]>)[index][1];
}

describe('AquilineClient', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let client: AquilineClient;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    client = new AquilineClient();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends the whole token as one Bearer string, never split', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, uid: 'u1', subscriptionActive: true }));
    await client.getMe(config({ token: 'abc123.def456' }));
    const init = callInit(fetchMock);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc123.def456');
  });

  it('getMe calls GET /v1/me', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true }));
    await client.getMe(config());
    expect(callUrl(fetchMock)).toBe('https://aquiline-tracking.com/app/api/integration/v1/me');
    expect(callInit(fetchMock).method).toBe('GET');
  });

  it('listProfiles calls GET /v1/profiles', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [] }));
    await client.listProfiles(config());
    expect(callUrl(fetchMock)).toBe('https://aquiline-tracking.com/app/api/integration/v1/profiles');
  });

  it('createProfile POSTs to /v1/profiles with the profile body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { profileId: 'sh-test-u1-AMAZON_US' }));
    await client.createProfile(
      {
        accountOrigin: AquilineAccountOrigin.AMAZON,
        profileId: 'sh-test-u1-AMAZON_US',
        label: 'sh-test-u1-AMAZON_US',
        marketplaceHost: 'www.amazon.com',
      },
      config(),
    );
    expect(callUrl(fetchMock)).toBe('https://aquiline-tracking.com/app/api/integration/v1/profiles');
    const init = callInit(fetchMock);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({ profileId: 'sh-test-u1-AMAZON_US' });
  });

  it('patchProfile issues a PATCH to /v1/profiles/{id} without profileId in the body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await client.patchProfile('sh-test-u1-AMAZON_US', { label: 'renamed' }, config());
    expect(callUrl(fetchMock)).toBe(
      'https://aquiline-tracking.com/app/api/integration/v1/profiles/sh-test-u1-AMAZON_US',
    );
    const init = callInit(fetchMock);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ label: 'renamed' });
  });

  it('upsertOrders POSTs an { orders } envelope to the profile-scoped route', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true }));
    await client.upsertOrders(
      'sh-test-u1-AMAZON_US',
      [{ marketplaceOrderId: '111-2223334-4445556', status: 'Shipping' }],
      config(),
    );
    expect(callUrl(fetchMock)).toBe(
      'https://aquiline-tracking.com/app/api/integration/v1/profiles/sh-test-u1-AMAZON_US/orders/upsert',
    );
    const init = callInit(fetchMock);
    expect(JSON.parse(init.body as string)).toEqual({
      orders: [{ marketplaceOrderId: '111-2223334-4445556', status: 'Shipping' }],
    });
  });

  it('uploadTrackingHtml POSTs to the order-scoped tracking-html route', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { success: true, outcome: 'accepted', trackingUpdateStatus: 'processing' }),
    );
    const result = await client.uploadTrackingHtml(
      'sh-test-u1-AMAZON_US',
      '111-2223334-4445556',
      { trackingUrl: 'https://www.amazon.com/gp/your-account/ship-track?orderId=1', html: '<html></html>' },
      config(),
    );
    expect(callUrl(fetchMock)).toBe(
      'https://aquiline-tracking.com/app/api/integration/v1/profiles/sh-test-u1-AMAZON_US/orders/111-2223334-4445556/tracking-html',
    );
    expect(result.outcome).toBe('accepted');
    expect(result.trackingUpdateStatus).toBe('processing');
  });

  it('uploadTrackingHtml treats an unrecognized outcome as null rather than casting it', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, outcome: 'something_new' }));
    const result = await client.uploadTrackingHtml(
      'p1',
      'o1',
      { trackingUrl: 'https://example.com', html: '<html></html>' },
      config(),
    );
    expect(result.outcome).toBeNull();
  });

  it('assign POSTs to the order-scoped assign route and returns the parsed result', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        success: true,
        aquiline: 'AQUAA6435850826YQ',
        chargedCents: 14,
        planLimit: 300,
        planUsed: 1,
        planRemaining: 299,
      }),
    );
    const result = await client.assign(
      'sh-test-u1-AMAZON_US',
      '111-2223334-4445556',
      {
        trackingUrl: 'https://www.amazon.com/gp/your-account/ship-track?orderId=1',
        retailer: 'amazon-us',
        marketplaceHost: 'www.amazon.com',
        sourceTracking: 'Amazon',
      },
      config(),
    );
    expect(callUrl(fetchMock)).toBe(
      'https://aquiline-tracking.com/app/api/integration/v1/profiles/sh-test-u1-AMAZON_US/orders/111-2223334-4445556/assign',
    );
    expect(result.aquiline).toBe('AQUAA6435850826YQ');
    expect(result.chargedCents).toBe(14);
  });

  it('getOrder calls GET on the order-scoped route', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { marketplaceOrderId: '111-2223334-4445556' }));
    await client.getOrder('p1', 'o1', config());
    expect(callUrl(fetchMock)).toBe(
      'https://aquiline-tracking.com/app/api/integration/v1/profiles/p1/orders/o1',
    );
    expect(callInit(fetchMock).method).toBe('GET');
  });

  it('listWebhooks calls GET /v1/webhooks', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [] }));
    await client.listWebhooks(config());
    expect(callUrl(fetchMock)).toBe('https://aquiline-tracking.com/app/api/integration/v1/webhooks');
    expect(callInit(fetchMock).method).toBe('GET');
  });

  it('createWebhook POSTs { url, events } to /v1/webhooks', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'wh_1', url: 'https://x/test', events: [], secret: 's3cr3t' }));
    const result = await client.createWebhook(
      { url: 'https://x/test', events: [AquilineWebhookEvent.HTML_APPLIED] },
      config(),
    );
    expect(callUrl(fetchMock)).toBe('https://aquiline-tracking.com/app/api/integration/v1/webhooks');
    const init = callInit(fetchMock);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      url: 'https://x/test',
      events: ['tracking.html.applied'],
    });
    expect(result.secret).toBe('s3cr3t');
  });

  it('throws NOT_CONFIGURED without making a network call when the token is missing', async () => {
    await expect(client.getMe(config({ token: null }))).rejects.toMatchObject({
      kind: AquilineErrorKind.NOT_CONFIGURED,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('isConfigured is false without a token', () => {
    expect(client.isConfigured(config({ token: null }))).toBe(false);
    expect(client.isConfigured(config())).toBe(true);
  });

  it('retries a 503 (transport) and succeeds on the second attempt', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));
    const result = await client.getMe(config());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true });
  }, 10_000);

  it('never retries a 404 — the same request would get the same answer', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { success: false, code: 'not-found', message: 'Profile not found.' }));
    await expect(client.getProfile('missing', config())).rejects.toMatchObject({
      kind: AquilineErrorKind.NOT_FOUND,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never retries a 402 (quota wall) — retrying risks paying twice on the conversion path', async () => {
    fetchMock.mockResolvedValue(jsonResponse(402, { success: false }));
    await expect(
      client.assign('p1', 'o1', { trackingUrl: 'https://x' }, config()),
    ).rejects.toMatchObject({ kind: AquilineErrorKind.QUOTA_EXCEEDED });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('exhausts all 3 attempts on a persistent transport failure, then throws TRANSPORT', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));
    await expect(client.getMe(config())).rejects.toMatchObject({ kind: AquilineErrorKind.TRANSPORT });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 10_000);

  it('classifies a network failure (fetch rejection) as TRANSPORT and retries it', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));
    const result = await client.getMe(config());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true });
  }, 10_000);
});
