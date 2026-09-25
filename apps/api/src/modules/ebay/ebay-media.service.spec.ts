import { EbayMediaService, MAX_BACKOFF_MS } from './ebay-media.service';

const ACCOUNT_ID = 'acct-1';
const TOKEN = 'test-token';
const SOURCE_URL = 'https://images-na.ssl-images-amazon.com/images/I/71nx65qZq6L.jpg';

interface FakeResponse {
  status: number;
  headers: Headers;
  text: () => Promise<string>;
}

interface FakeRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

type FakeFetch = jest.Mock<Promise<FakeResponse>, [string, FakeRequestInit]>;

function makeService(fetchMock: FakeFetch) {
  const ebayService = { getAccountAccessToken: jest.fn().mockResolvedValue(TOKEN) };
  const service = new EbayMediaService(ebayService as never);
  global.fetch = fetchMock as unknown as typeof fetch;
  return { service, ebayService };
}

function response(overrides: { status: number; headers?: Headers; body?: string }): FakeResponse {
  return {
    status: overrides.status,
    headers: overrides.headers ?? new Headers(),
    text: () => Promise.resolve(overrides.body ?? ''),
  };
}

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

    await expect(service.uploadFromUrl(ACCOUNT_ID, SOURCE_URL)).resolves.toBe(epsUrl);
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

    await expect(service.uploadFromUrl(ACCOUNT_ID, SOURCE_URL)).resolves.toBe(epsUrl);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [getUrl, getInit] = fetchMock.mock.calls[1];
    expect(getUrl).toBe('https://apim.ebay.com/commerce/media/v1_beta/image/img456');
    expect(getInit.headers?.['Authorization']).toBe(`Bearer ${TOKEN}`);
  });

  it('a 201 with neither a usable body nor a Location header returns null', async () => {
    const fetchMock = jest.fn<Promise<FakeResponse>, [string, FakeRequestInit]>().mockResolvedValueOnce(response({ status: 201 }));
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl(ACCOUNT_ID, SOURCE_URL)).resolves.toBeNull();
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

    await expect(service.uploadFromUrl(ACCOUNT_ID, SOURCE_URL)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a 403 returns null', async () => {
    const fetchMock = jest.fn<Promise<FakeResponse>, [string, FakeRequestInit]>().mockResolvedValueOnce(response({ status: 403 }));
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl(ACCOUNT_ID, SOURCE_URL)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetch rejecting returns null rather than throwing', async () => {
    const fetchMock = jest.fn<Promise<FakeResponse>, [string, FakeRequestInit]>().mockRejectedValueOnce(new Error('network down'));
    const { service } = makeService(fetchMock);

    await expect(service.uploadFromUrl(ACCOUNT_ID, SOURCE_URL)).resolves.toBeNull();
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

    await expect(service.uploadFromUrl(ACCOUNT_ID, SOURCE_URL)).resolves.toBe(epsUrl);
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

    await expect(service.uploadFromUrl(ACCOUNT_ID, SOURCE_URL)).resolves.toBe(epsUrl);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledTimes(1);
    expect(sleepSpy).toHaveBeenCalledWith(MAX_BACKOFF_MS);
    expect(sleepSpy.mock.calls[0][0]).toBeLessThan(999_999 * 1000);
  });
});
