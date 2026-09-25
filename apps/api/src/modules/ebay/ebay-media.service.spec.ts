import {
  CREATE_IMAGE_TIMEOUT_MS,
  EbayMediaService,
  GET_IMAGE_TIMEOUT_MS,
  MAX_BACKOFF_MS,
} from './ebay-media.service';

const TOKEN = 'test-token';
const SOURCE_URL = 'https://images-na.ssl-images-amazon.com/images/I/71nx65qZq6L.jpg';

interface FakeResponse {
  status: number;
  headers: Headers;
  text: () => Promise<string>;
  body?: { cancel: jest.Mock<Promise<void>, []> };
}

interface FakeRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

type FakeFetch = jest.Mock<Promise<FakeResponse>, [string, FakeRequestInit]>;

function makeService(fetchMock: FakeFetch) {
  const service = new EbayMediaService();
  global.fetch = fetchMock as unknown as typeof fetch;
  return { service };
}

function response(overrides: {
  status: number;
  headers?: Headers;
  body?: string;
  stream?: { cancel: jest.Mock<Promise<void>, []> };
}): FakeResponse {
  return {
    status: overrides.status,
    headers: overrides.headers ?? new Headers(),
    text: () => Promise.resolve(overrides.body ?? ''),
    body: overrides.stream,
  };
}

/** Captures the ms each attempt asks for — `AbortSignal` itself exposes none. */
function spyOnTimeout(): jest.SpyInstance<AbortSignal, [number]> {
  return jest.spyOn(AbortSignal, 'timeout');
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('EbayMediaService.uploadFromUrl', () => {
  it('a 201 whose body carries an EPS imageUrl returns it and makes no getImage call', async () => {
    const epsUrl = 'https://i.ebayimg.com/00/s/abc/$_1.JPG?set_id=1';
    const fetchMock = jest.fn<Promise<FakeResponse>, [string, FakeRequestInit]>().mockResolvedValueOnce(
      response({
        status: 201,
        headers: new Headers({ location: 'https://apim.ebay.com/commerce/media/v1_beta/image/img123' }),
        body: JSON.stringify({ imageUrl: epsUrl }),
      })
    );
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl(TOKEN, SOURCE_URL)).resolves.toBe(epsUrl);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://apim.ebay.com/commerce/media/v1_beta/image/create_image_from_url');
    expect(init.method).toBe('POST');
    expect(init.headers?.['Content-Type']).toBe('application/json');
    expect(init.headers?.['Authorization']).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(init.body ?? '')).toEqual({ imageUrl: SOURCE_URL });
  });

  it('a 201 whose body is empty falls back to getImage and returns its imageUrl', async () => {
    const epsUrl = 'https://i.ebayimg.com/00/s/xyz/$_1.JPG?set_id=2';
    const fetchMock = jest
      .fn<Promise<FakeResponse>, [string, FakeRequestInit]>()
      .mockResolvedValueOnce(
        response({
          status: 201,
          headers: new Headers({ location: 'https://apim.ebay.com/commerce/media/v1_beta/image/img456' }),
        })
      )
      .mockResolvedValueOnce(
        response({
          status: 200,
          body: JSON.stringify({ imageUrl: epsUrl }),
        })
      );
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl(TOKEN, SOURCE_URL)).resolves.toBe(epsUrl);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [getUrl, getInit] = fetchMock.mock.calls[1];
    expect(getUrl).toBe('https://apim.ebay.com/commerce/media/v1_beta/image/img456');
    expect(getInit.headers?.['Authorization']).toBe(`Bearer ${TOKEN}`);
  });

  it('a 201 with neither a usable body nor a Location header returns null', async () => {
    const fetchMock = jest.fn<Promise<FakeResponse>, [string, FakeRequestInit]>().mockResolvedValueOnce(response({ status: 201 }));
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl(TOKEN, SOURCE_URL)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a 400 (eBay could not download the URL, error 190204) returns null', async () => {
    const fetchMock = jest.fn<Promise<FakeResponse>, [string, FakeRequestInit]>().mockResolvedValueOnce(
      response({
        status: 400,
        body: JSON.stringify({ errors: [{ errorId: 190204, message: 'Could not download the image from url.' }] }),
      })
    );
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl(TOKEN, SOURCE_URL)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a 403 returns null', async () => {
    const fetchMock = jest.fn<Promise<FakeResponse>, [string, FakeRequestInit]>().mockResolvedValueOnce(response({ status: 403 }));
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl(TOKEN, SOURCE_URL)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetch rejecting returns null rather than throwing', async () => {
    const fetchMock = jest.fn<Promise<FakeResponse>, [string, FakeRequestInit]>().mockRejectedValueOnce(new Error('network down'));
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl(TOKEN, SOURCE_URL)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a 429 is retried and succeeds on the second attempt', async () => {
    const epsUrl = 'https://i.ebayimg.com/00/s/retry/$_1.JPG?set_id=3';
    const fetchMock = jest
      .fn<Promise<FakeResponse>, [string, FakeRequestInit]>()
      .mockResolvedValueOnce(response({ status: 429, headers: new Headers({ 'retry-after': '0' }) }))
      .mockResolvedValueOnce(
        response({
          status: 201,
          headers: new Headers({ location: 'https://apim.ebay.com/commerce/media/v1_beta/image/img789' }),
          body: JSON.stringify({ imageUrl: epsUrl }),
        })
      );
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl(TOKEN, SOURCE_URL)).resolves.toBe(epsUrl);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /**
   * A `Retry-After` this large would sleep for roughly eleven days if honoured
   * verbatim. `sleep` is overridden on the instance so this asserts the
   * CLAMPED duration actually passed to it, never the wall-clock — the test
   * must not, and does not, wait for anything close to the header's value.
   */
  it('clamps an absurd Retry-After to MAX_BACKOFF_MS instead of sleeping it verbatim', async () => {
    const epsUrl = 'https://i.ebayimg.com/00/s/clamped/$_1.JPG?set_id=4';
    const fetchMock = jest
      .fn<Promise<FakeResponse>, [string, FakeRequestInit]>()
      .mockResolvedValueOnce(response({ status: 429, headers: new Headers({ 'retry-after': '999999' }) }))
      .mockResolvedValueOnce(
        response({
          status: 201,
          headers: new Headers({ location: 'https://apim.ebay.com/commerce/media/v1_beta/image/img999' }),
          body: JSON.stringify({ imageUrl: epsUrl }),
        })
      );
    const { service } = makeService(fetchMock);
    const sleepSpy = jest.fn<Promise<void>, [number]>().mockResolvedValue(undefined);
    (service as unknown as { sleep: unknown }).sleep = sleepSpy;

    await expect(service.uploadFromUrl(TOKEN, SOURCE_URL)).resolves.toBe(epsUrl);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledTimes(1);
    expect(sleepSpy).toHaveBeenCalledWith(MAX_BACKOFF_MS);
    expect(sleepSpy.mock.calls[0][0]).toBeLessThan(999_999 * 1000);
  });
});

/**
 * I1. Both EPS calls used to be bare `fetch(url, init)` with no signal, so the
 * only bound was undici's ~300s default. That matters more here than for an
 * ordinary outbound call: `create_image_from_url` makes eBay go and download
 * the Amazon image synchronously inside our request, and `EbayImageResolver`
 * holds a pooled database connection for the whole upload loop.
 */
describe('every EPS request is bounded by a timeout', () => {
  const EPS_URL = 'https://i.ebayimg.com/00/s/timeout/$_1.JPG';

  it('bounds create_image_from_url at CREATE_IMAGE_TIMEOUT_MS', async () => {
    const timeoutSpy = spyOnTimeout();
    const fetchMock = jest.fn<Promise<FakeResponse>, [string, FakeRequestInit]>().mockResolvedValueOnce(
      response({ status: 201, body: JSON.stringify({ imageUrl: EPS_URL }) })
    );
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl(TOKEN, SOURCE_URL)).resolves.toBe(EPS_URL);
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(CREATE_IMAGE_TIMEOUT_MS);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('bounds the getImage fallback at GET_IMAGE_TIMEOUT_MS', async () => {
    const timeoutSpy = spyOnTimeout();
    const fetchMock = jest
      .fn<Promise<FakeResponse>, [string, FakeRequestInit]>()
      .mockResolvedValueOnce(
        response({
          status: 201,
          headers: new Headers({ location: 'https://apim.ebay.com/commerce/media/v1_beta/image/img-t' }),
        })
      )
      .mockResolvedValueOnce(response({ status: 200, body: JSON.stringify({ imageUrl: EPS_URL }) }));
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl(TOKEN, SOURCE_URL)).resolves.toBe(EPS_URL);
    expect(timeoutSpy.mock.calls.map(([ms]) => ms)).toEqual([CREATE_IMAGE_TIMEOUT_MS, GET_IMAGE_TIMEOUT_MS]);
    expect(fetchMock.mock.calls[1][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('a timed-out request is an ordinary failure: null, never a throw', async () => {
    // What undici raises when the signal fires mid-request.
    const abortError = Object.assign(new Error('The operation was aborted due to timeout'), {
      name: 'TimeoutError',
    });
    const fetchMock = jest.fn<Promise<FakeResponse>, [string, FakeRequestInit]>().mockRejectedValueOnce(abortError);
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl(TOKEN, SOURCE_URL)).resolves.toBeNull();
  });

  it('gives each retry attempt a FRESH signal — a reused one is already aborted', async () => {
    const timeoutSpy = spyOnTimeout();
    const fetchMock = jest
      .fn<Promise<FakeResponse>, [string, FakeRequestInit]>()
      .mockResolvedValueOnce(response({ status: 429, headers: new Headers({ 'retry-after': '0' }) }))
      .mockResolvedValueOnce(response({ status: 201, body: JSON.stringify({ imageUrl: EPS_URL }) }));
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl(TOKEN, SOURCE_URL)).resolves.toBe(EPS_URL);
    expect(timeoutSpy).toHaveBeenCalledTimes(2);
    const [first, second] = fetchMock.mock.calls.map(([, init]) => init.signal);
    expect(first).not.toBe(second);
  });
});

/**
 * M5. In undici an unconsumed body keeps its connection checked out, so a 429
 * left unread holds the socket for the whole backoff sleep and every attempt
 * after it.
 */
describe('a retried 429 releases its body before sleeping', () => {
  it('cancels the 429 response body', async () => {
    const cancel = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
    const epsUrl = 'https://i.ebayimg.com/00/s/drain/$_1.JPG';
    const fetchMock = jest
      .fn<Promise<FakeResponse>, [string, FakeRequestInit]>()
      .mockResolvedValueOnce(
        response({ status: 429, headers: new Headers({ 'retry-after': '0' }), stream: { cancel } })
      )
      .mockResolvedValueOnce(response({ status: 201, body: JSON.stringify({ imageUrl: epsUrl }) }));
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl(TOKEN, SOURCE_URL)).resolves.toBe(epsUrl);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('a body that refuses to cancel does not fail the upload', async () => {
    const cancel = jest.fn<Promise<void>, []>().mockRejectedValue(new Error('already consumed'));
    const epsUrl = 'https://i.ebayimg.com/00/s/drain2/$_1.JPG';
    const fetchMock = jest
      .fn<Promise<FakeResponse>, [string, FakeRequestInit]>()
      .mockResolvedValueOnce(
        response({ status: 429, headers: new Headers({ 'retry-after': '0' }), stream: { cancel } })
      )
      .mockResolvedValueOnce(response({ status: 201, body: JSON.stringify({ imageUrl: epsUrl }) }));
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl(TOKEN, SOURCE_URL)).resolves.toBe(epsUrl);
  });
});

/**
 * I2. The service used to resolve the seller token itself, once per image —
 * up to 24 nested pool acquisitions from inside `EbayImageResolver`'s open
 * transaction. It now takes one the caller already resolved.
 */
describe('the seller token is supplied, never resolved here', () => {
  it('sends the caller-supplied token and reads no eBay account', async () => {
    const epsUrl = 'https://i.ebayimg.com/00/s/token/$_1.JPG';
    const fetchMock = jest
      .fn<Promise<FakeResponse>, [string, FakeRequestInit]>()
      .mockResolvedValueOnce(response({ status: 201, body: JSON.stringify({ imageUrl: epsUrl }) }));
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl('supplied-token', SOURCE_URL)).resolves.toBe(epsUrl);
    expect(fetchMock.mock.calls[0][1].headers?.['Authorization']).toBe('Bearer supplied-token');
    // Constructed with no arguments at all: there is no account lookup left
    // in this class to make, nested or otherwise.
    expect(EbayMediaService.length).toBe(0);
  });
});
