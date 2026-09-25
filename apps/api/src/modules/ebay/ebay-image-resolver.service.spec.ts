import { EBAY_MAX_IMAGES } from '@repo/shared';

import { EbayImageResolver } from './ebay-image-resolver.service';

const PRODUCT_ID = 'product-1';
const ACCOUNT_ID = 'account-1';
const ACCESS_TOKEN = 'seller-token';

type QueryCall = [string, unknown[]];

function makeClient(overrides: { query?: jest.Mock } = {}) {
  return {
    query: overrides.query ?? jest.fn().mockResolvedValue({ rows: [] }),
  };
}

/** The one `client.query` call whose SQL text is the cache-store INSERT, typed so callers don't touch `any`. */
function findInsertCall(client: ReturnType<typeof makeClient>): QueryCall | undefined {
  const calls = client.query.mock.calls as QueryCall[];
  return calls.find(([sql]) => sql.includes('INSERT INTO product_ebay_images'));
}

/** The advisory-lock acquisition, so a test can assert a cheap path took none. */
function findLockCall(client: ReturnType<typeof makeClient>): QueryCall | undefined {
  const calls = client.query.mock.calls as QueryCall[];
  return calls.find(([sql]) => sql.includes('pg_advisory_xact_lock'));
}

function makeDatabase(overrides: { query?: jest.Mock; client?: ReturnType<typeof makeClient> } = {}) {
  const client = overrides.client ?? makeClient();
  return {
    query: overrides.query ?? jest.fn().mockResolvedValue([]),
    transaction: jest.fn(async (callback: (client: unknown) => Promise<unknown>) => callback(client)),
    client,
  };
}

function makeEbayMediaService(overrides: { uploadFromUrl?: jest.Mock } = {}) {
  return {
    uploadFromUrl: overrides.uploadFromUrl ?? jest.fn().mockResolvedValue(null),
  };
}

function makeEbayService(overrides: { getAccountAccessToken?: jest.Mock } = {}) {
  return {
    getAccountAccessToken: overrides.getAccountAccessToken ?? jest.fn().mockResolvedValue(ACCESS_TOKEN),
  };
}

function makeResolver(overrides: {
  database?: ReturnType<typeof makeDatabase>;
  ebayMedia?: ReturnType<typeof makeEbayMediaService>;
  ebay?: ReturnType<typeof makeEbayService>;
} = {}) {
  const database = overrides.database ?? makeDatabase();
  const ebayMedia = overrides.ebayMedia ?? makeEbayMediaService();
  const ebay = overrides.ebay ?? makeEbayService();
  const resolver = new EbayImageResolver(database as never, ebayMedia as never, ebay as never);
  return { resolver, database, ebayMedia, ebay };
}

describe('EbayImageResolver.resolve', () => {
  it('returns the cached row and performs no upload', async () => {
    const stored = ['https://i.ebayimg.com/a.jpg', 'https://i.ebayimg.com/b.jpg'];
    const database = makeDatabase({
      query: jest.fn().mockResolvedValue([{ image_urls: stored }]),
    });
    const ebayMedia = makeEbayMediaService();
    const { resolver } = makeResolver({ database, ebayMedia });

    const sourceUrls = ['https://amazon.example/a.jpg', 'https://amazon.example/b.jpg'];
    const result = await resolver.resolve(PRODUCT_ID, ACCOUNT_ID, sourceUrls);

    expect(result).toEqual({
      galleryUrls: stored,
      descriptionUrl: stored[0],
    });
    expect(ebayMedia.uploadFromUrl).not.toHaveBeenCalled();
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('uploads each source image once and stores the result on a cache miss', async () => {
    const sourceUrls = ['https://amazon.example/a.jpg', 'https://amazon.example/b.jpg'];
    const epsUrls = ['https://i.ebayimg.com/a.jpg', 'https://i.ebayimg.com/b.jpg'];
    const client = makeClient({ query: jest.fn().mockResolvedValue({ rows: [] }) });
    const database = makeDatabase({ query: jest.fn().mockResolvedValue([]), client });
    const uploadFromUrl = jest.fn().mockResolvedValueOnce(epsUrls[0]).mockResolvedValueOnce(epsUrls[1]);
    const ebayMedia = makeEbayMediaService({ uploadFromUrl });
    const { resolver } = makeResolver({ database, ebayMedia });

    const result = await resolver.resolve(PRODUCT_ID, ACCOUNT_ID, sourceUrls);

    expect(uploadFromUrl).toHaveBeenCalledTimes(2);
    expect(uploadFromUrl).toHaveBeenNthCalledWith(1, ACCESS_TOKEN, sourceUrls[0]);
    expect(uploadFromUrl).toHaveBeenNthCalledWith(2, ACCESS_TOKEN, sourceUrls[1]);
    expect(result).toEqual({ galleryUrls: epsUrls, descriptionUrl: epsUrls[0] });

    const insertCall = findInsertCall(client);
    expect(insertCall).toBeDefined();
    expect(insertCall?.[1]).toEqual([PRODUCT_ID, ACCOUNT_ID, JSON.stringify(epsUrls)]);
  });

  it('stores an empty string for a failed upload, falls back to the source URL in the gallery, and returns no description image when the first upload fails', async () => {
    const sourceUrls = ['https://amazon.example/a.jpg', 'https://amazon.example/b.jpg'];
    const epsUrl2 = 'https://i.ebayimg.com/b.jpg';
    const client = makeClient({ query: jest.fn().mockResolvedValue({ rows: [] }) });
    const database = makeDatabase({ query: jest.fn().mockResolvedValue([]), client });
    const uploadFromUrl = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(epsUrl2);
    const ebayMedia = makeEbayMediaService({ uploadFromUrl });
    const { resolver } = makeResolver({ database, ebayMedia });

    const result = await resolver.resolve(PRODUCT_ID, ACCOUNT_ID, sourceUrls);

    expect(result).toEqual({
      galleryUrls: [sourceUrls[0], epsUrl2],
      descriptionUrl: '',
    });

    const insertCall = findInsertCall(client);
    expect(insertCall?.[1]).toEqual([PRODUCT_ID, ACCOUNT_ID, JSON.stringify(['', epsUrl2])]);
  });

  it('returns empty results for empty sourceUrls without touching the database or the uploader', async () => {
    const database = makeDatabase();
    const ebayMedia = makeEbayMediaService();
    const { resolver } = makeResolver({ database, ebayMedia });

    const result = await resolver.resolve(PRODUCT_ID, ACCOUNT_ID, []);

    expect(result).toEqual({ galleryUrls: [], descriptionUrl: '' });
    expect(database.query).not.toHaveBeenCalled();
    expect(database.transaction).not.toHaveBeenCalled();
    expect(ebayMedia.uploadFromUrl).not.toHaveBeenCalled();
  });

  it('returns the source URLs unchanged, never throwing, when the database fails', async () => {
    const sourceUrls = ['https://amazon.example/a.jpg', 'https://amazon.example/b.jpg'];
    const database = makeDatabase({ query: jest.fn().mockRejectedValue(new Error('connection lost')) });
    const ebayMedia = makeEbayMediaService();
    const { resolver } = makeResolver({ database, ebayMedia });

    await expect(resolver.resolve(PRODUCT_ID, ACCOUNT_ID, sourceUrls)).resolves.toEqual({
      galleryUrls: sourceUrls,
      descriptionUrl: '',
    });
    expect(ebayMedia.uploadFromUrl).not.toHaveBeenCalled();
  });

  it('issues no write when every upload fails, and still falls back to the source URLs', async () => {
    const sourceUrls = ['https://amazon.example/a.jpg', 'https://amazon.example/b.jpg'];
    const client = makeClient({ query: jest.fn().mockResolvedValue({ rows: [] }) });
    const database = makeDatabase({ query: jest.fn().mockResolvedValue([]), client });
    const uploadFromUrl = jest.fn().mockResolvedValue(null);
    const ebayMedia = makeEbayMediaService({ uploadFromUrl });
    const { resolver } = makeResolver({ database, ebayMedia });

    const result = await resolver.resolve(PRODUCT_ID, ACCOUNT_ID, sourceUrls);

    expect(uploadFromUrl).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ galleryUrls: sourceUrls, descriptionUrl: '' });
    // A total failure must not write an all-empty row — that row would
    // satisfy the length-only cache check forever after, permanently hiding
    // the fallback-to-source-URL behaviour behind a false HIT with nothing
    // left to retry it.
    expect(findInsertCall(client)).toBeUndefined();
  });

  it('does not overwrite an existing cached row when a later re-upload fails entirely', async () => {
    const sourceUrls = ['https://amazon.example/a.jpg', 'https://amazon.example/b.jpg'];
    // A row from an earlier run, for a DIFFERENT image count than the product
    // carries today — parseCacheHit reads this as a miss (length mismatch),
    // which is exactly the situation that re-triggers an upload attempt on an
    // otherwise-good, already-cached product.
    const staleGoodRow = ['https://i.ebayimg.com/old-a.jpg', 'https://i.ebayimg.com/old-b.jpg', 'https://i.ebayimg.com/old-c.jpg'];
    const client = makeClient({ query: jest.fn().mockResolvedValue({ rows: [{ image_urls: staleGoodRow }] }) });
    const database = makeDatabase({
      query: jest.fn().mockResolvedValue([{ image_urls: staleGoodRow }]),
      client,
    });
    const uploadFromUrl = jest.fn().mockResolvedValue(null);
    const ebayMedia = makeEbayMediaService({ uploadFromUrl });
    const { resolver } = makeResolver({ database, ebayMedia });

    const result = await resolver.resolve(PRODUCT_ID, ACCOUNT_ID, sourceUrls);

    expect(uploadFromUrl).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ galleryUrls: sourceUrls, descriptionUrl: '' });
    // The pre-existing (mismatched-length, otherwise good) row must survive a
    // transient total-failure re-upload attempt — ON CONFLICT DO UPDATE would
    // otherwise clobber a working cache with an all-empty array.
    expect(findInsertCall(client)).toBeUndefined();
  });

  it('uploads only the first EBAY_MAX_IMAGES source URLs, and a later call recognizes the capped cache as a hit', async () => {
    const sourceUrls = Array.from({ length: EBAY_MAX_IMAGES + 6 }, (_, i) => `https://amazon.example/${i}.jpg`);
    const uploadFromUrl = jest.fn().mockImplementation((_accessToken: string, url: string) =>
      Promise.resolve(url.replace('https://amazon.example/', 'https://i.ebayimg.com/'))
    );
    const client = makeClient({ query: jest.fn().mockResolvedValue({ rows: [] }) });
    const database = makeDatabase({ query: jest.fn().mockResolvedValue([]), client });
    const ebayMedia = makeEbayMediaService({ uploadFromUrl });
    const { resolver } = makeResolver({ database, ebayMedia });

    const result = await resolver.resolve(PRODUCT_ID, ACCOUNT_ID, sourceUrls);

    expect(uploadFromUrl).toHaveBeenCalledTimes(EBAY_MAX_IMAGES);
    const stored = sourceUrls
      .slice(0, EBAY_MAX_IMAGES)
      .map((url) => url.replace('https://amazon.example/', 'https://i.ebayimg.com/'));
    const insertCall = findInsertCall(client);
    expect(insertCall?.[1]).toEqual([PRODUCT_ID, ACCOUNT_ID, JSON.stringify(stored)]);
    // Only the first EBAY_MAX_IMAGES entries got an EPS URL; the rest fall
    // back to their own source URL in the gallery, per resolveGalleryUrls.
    expect(result.galleryUrls.slice(0, EBAY_MAX_IMAGES)).toEqual(stored);
    expect(result.galleryUrls.slice(EBAY_MAX_IMAGES)).toEqual(sourceUrls.slice(EBAY_MAX_IMAGES));

    // A stored array capped at EBAY_MAX_IMAGES must still read as a cache hit
    // against the same (longer) sourceUrls — comparing against the raw
    // sourceUrls.length would treat this row as a permanent miss and re-upload
    // every image on every future listing of the same ASIN for this store.
    uploadFromUrl.mockClear();
    const secondDatabase = makeDatabase({ query: jest.fn().mockResolvedValue([{ image_urls: stored }]) });
    const { resolver: secondResolver } = makeResolver({ database: secondDatabase, ebayMedia });
    const secondResult = await secondResolver.resolve(PRODUCT_ID, ACCOUNT_ID, sourceUrls);
    expect(uploadFromUrl).not.toHaveBeenCalled();
    expect(secondDatabase.transaction).not.toHaveBeenCalled();
    expect(secondResult.galleryUrls.slice(0, EBAY_MAX_IMAGES)).toEqual(stored);
    expect(secondResult.galleryUrls.slice(EBAY_MAX_IMAGES)).toEqual(sourceUrls.slice(EBAY_MAX_IMAGES));
  });
});

/**
 * I3. A PARTIAL failure is stored — and before this it was stored for ever.
 * A row like `['', <eps>]` satisfies `parseCacheHit`'s length-only test on
 * every future listing of that (product, store), so gallery slot 0 served the
 * Amazon URL and the description rendered no image at all, permanently, off
 * the back of one transient 429 at first-listing time.
 */
describe('EbayImageResolver.resolve — re-attempting the gaps in a partial cache row', () => {
  const SOURCE_URLS = ['https://amazon.example/a.jpg', 'https://amazon.example/b.jpg'];
  const EPS_A = 'https://i.ebayimg.com/a.jpg';
  const EPS_B = 'https://i.ebayimg.com/b.jpg';

  /** A stored row with a hole in slot 0 — both read paths see the same row. */
  function makeRowDatabase(row: string[]) {
    const client = makeClient({ query: jest.fn().mockResolvedValue({ rows: [{ image_urls: row }] }) });
    return makeDatabase({ query: jest.fn().mockResolvedValue([{ image_urls: row }]), client });
  }

  it('re-uploads ONLY the empty slot, never the one that already succeeded', async () => {
    const database = makeRowDatabase(['', EPS_B]);
    const uploadFromUrl = jest.fn().mockResolvedValue(EPS_A);
    const ebayMedia = makeEbayMediaService({ uploadFromUrl });
    const { resolver } = makeResolver({ database, ebayMedia });

    await resolver.resolve(PRODUCT_ID, ACCOUNT_ID, SOURCE_URLS);

    expect(uploadFromUrl).toHaveBeenCalledTimes(1);
    expect(uploadFromUrl).toHaveBeenCalledWith(ACCESS_TOKEN, SOURCE_URLS[0]);
  });

  it('a successful retry updates the row and reaches BOTH surfaces', async () => {
    const database = makeRowDatabase(['', EPS_B]);
    const uploadFromUrl = jest.fn().mockResolvedValue(EPS_A);
    const ebayMedia = makeEbayMediaService({ uploadFromUrl });
    const { resolver } = makeResolver({ database, ebayMedia });

    const result = await resolver.resolve(PRODUCT_ID, ACCOUNT_ID, SOURCE_URLS);

    // The gallery slot that used to serve the Amazon URL for ever...
    expect(result.galleryUrls).toEqual([EPS_A, EPS_B]);
    // ...and the description, which is slot 0 and had been empty for ever.
    expect(result.descriptionUrl).toBe(EPS_A);
    expect(findInsertCall(database.client)?.[1]).toEqual([
      PRODUCT_ID,
      ACCOUNT_ID,
      JSON.stringify([EPS_A, EPS_B]),
    ]);
  });

  it('a retry that fails again leaves the row no worse — and writes nothing', async () => {
    const database = makeRowDatabase(['', EPS_B]);
    const uploadFromUrl = jest.fn().mockResolvedValue(null);
    const ebayMedia = makeEbayMediaService({ uploadFromUrl });
    const { resolver } = makeResolver({ database, ebayMedia });

    const result = await resolver.resolve(PRODUCT_ID, ACCOUNT_ID, SOURCE_URLS);

    expect(uploadFromUrl).toHaveBeenCalledTimes(1);
    // Exactly the pre-retry behaviour: the good slot survives untouched and
    // the failed one falls back to its own source URL.
    expect(result).toEqual({ galleryUrls: [SOURCE_URLS[0], EPS_B], descriptionUrl: '' });
    // Nothing new was produced, so the identical row is not rewritten — which
    // is also what stops a good entry ever being downgraded to ''.
    expect(findInsertCall(database.client)).toBeUndefined();
  });

  it('a COMPLETE hit still performs no upload and takes no lock', async () => {
    const stored = [EPS_A, EPS_B];
    const database = makeRowDatabase(stored);
    const ebayMedia = makeEbayMediaService();
    const { resolver, ebay } = makeResolver({ database, ebayMedia });

    const result = await resolver.resolve(PRODUCT_ID, ACCOUNT_ID, SOURCE_URLS);

    expect(result).toEqual({ galleryUrls: stored, descriptionUrl: EPS_A });
    expect(ebayMedia.uploadFromUrl).not.toHaveBeenCalled();
    expect(database.transaction).not.toHaveBeenCalled();
    expect(findLockCall(database.client)).toBeUndefined();
    // The cheap path stays cheap: no token read either.
    expect(ebay.getAccountAccessToken).not.toHaveBeenCalled();
  });

  it('retries under the SAME advisory lock the miss path takes', async () => {
    const database = makeRowDatabase(['', EPS_B]);
    const uploadFromUrl = jest.fn().mockResolvedValue(EPS_A);
    const ebayMedia = makeEbayMediaService({ uploadFromUrl });
    const { resolver } = makeResolver({ database, ebayMedia });

    await resolver.resolve(PRODUCT_ID, ACCOUNT_ID, SOURCE_URLS);

    expect(database.transaction).toHaveBeenCalledTimes(1);
    const calls = database.client.query.mock.calls as QueryCall[];
    expect(calls.findIndex(([sql]) => sql.includes('pg_advisory_xact_lock'))).toBe(0);
  });

  it('treats a stored entry that is not an EPS URL as a gap, never serving it', async () => {
    // Unreachable through the INSERT, which only ever writes EPS URLs or ''.
    // Checked because this is the last unguarded step of the invariant.
    const database = makeRowDatabase(['https://amazon.example/a.jpg', EPS_B]);
    const uploadFromUrl = jest.fn().mockResolvedValue(EPS_A);
    const ebayMedia = makeEbayMediaService({ uploadFromUrl });
    const { resolver } = makeResolver({ database, ebayMedia });

    const result = await resolver.resolve(PRODUCT_ID, ACCOUNT_ID, SOURCE_URLS);

    expect(uploadFromUrl).toHaveBeenCalledTimes(1);
    expect(uploadFromUrl).toHaveBeenCalledWith(ACCESS_TOKEN, SOURCE_URLS[0]);
    expect(result.descriptionUrl).toBe(EPS_A);
  });

  it('never carries entries forward from a row of a DIFFERENT length', async () => {
    // A length mismatch means the row describes a different set of images, so
    // position N of it says nothing about source N — every slot is re-uploaded.
    const database = makeRowDatabase([EPS_A]);
    const uploadFromUrl = jest.fn().mockResolvedValue(EPS_B);
    const ebayMedia = makeEbayMediaService({ uploadFromUrl });
    const { resolver } = makeResolver({ database, ebayMedia });

    await resolver.resolve(PRODUCT_ID, ACCOUNT_ID, SOURCE_URLS);

    expect(uploadFromUrl).toHaveBeenCalledTimes(2);
  });
});

/**
 * I2. The token used to be read inside `EbayMediaService.uploadFromUrl`, once
 * per image — up to 24 NESTED pool acquisitions from inside the transaction
 * this resolver holds open. The pool is `max: 20` with a 2s acquisition
 * timeout and is shared with every other worker in the process.
 */
describe('EbayImageResolver.resolve — the seller token is resolved once', () => {
  it('reads the eBay account ONCE for a full 24-image run', async () => {
    const sourceUrls = Array.from({ length: EBAY_MAX_IMAGES }, (_, i) => `https://amazon.example/${i}.jpg`);
    const client = makeClient({ query: jest.fn().mockResolvedValue({ rows: [] }) });
    const database = makeDatabase({ query: jest.fn().mockResolvedValue([]), client });
    const uploadFromUrl = jest
      .fn()
      .mockImplementation((_accessToken: string, url: string) =>
        Promise.resolve(url.replace('https://amazon.example/', 'https://i.ebayimg.com/'))
      );
    const ebayMedia = makeEbayMediaService({ uploadFromUrl });
    const { resolver, ebay } = makeResolver({ database, ebayMedia });

    await resolver.resolve(PRODUCT_ID, ACCOUNT_ID, sourceUrls);

    expect(uploadFromUrl).toHaveBeenCalledTimes(EBAY_MAX_IMAGES);
    expect(ebay.getAccountAccessToken).toHaveBeenCalledTimes(1);
    expect(ebay.getAccountAccessToken).toHaveBeenCalledWith(ACCOUNT_ID);
  });

  it('resolves the token BEFORE opening the transaction', async () => {
    const order: string[] = [];
    const client = makeClient({ query: jest.fn().mockResolvedValue({ rows: [] }) });
    const database = makeDatabase({ query: jest.fn().mockResolvedValue([]), client });
    database.transaction = jest.fn(async (callback: (c: unknown) => Promise<unknown>) => {
      order.push('transaction');
      return callback(client);
    });
    const ebay = makeEbayService({
      getAccountAccessToken: jest.fn().mockImplementation(() => {
        order.push('token');
        return Promise.resolve(ACCESS_TOKEN);
      }),
    });
    const { resolver } = makeResolver({ database, ebay });

    await resolver.resolve(PRODUCT_ID, ACCOUNT_ID, ['https://amazon.example/a.jpg']);

    // A token read from INSIDE the transaction is a nested pool acquisition
    // while a connection is already held — the shape that starves the pool.
    expect(order).toEqual(['token', 'transaction']);
  });

  it('keeps the EPS URLs it already had when the token read then fails', async () => {
    // The gapped-hit retry path: the good slot must survive a failure that has
    // nothing to do with it, rather than collapsing to raw source URLs.
    const sourceUrls = ['https://amazon.example/a.jpg', 'https://amazon.example/b.jpg'];
    const stored = ['', 'https://i.ebayimg.com/b.jpg'];
    const database = makeDatabase({ query: jest.fn().mockResolvedValue([{ image_urls: stored }]) });
    const ebay = makeEbayService({
      getAccountAccessToken: jest.fn().mockRejectedValue(new Error('eBay account not found')),
    });
    const { resolver } = makeResolver({ database, ebay });

    await expect(resolver.resolve(PRODUCT_ID, ACCOUNT_ID, sourceUrls)).resolves.toEqual({
      galleryUrls: [sourceUrls[0], stored[1]],
      descriptionUrl: '',
    });
  });

  it('falls back, never throws, when the token cannot be resolved', async () => {
    const sourceUrls = ['https://amazon.example/a.jpg'];
    const database = makeDatabase({ query: jest.fn().mockResolvedValue([]) });
    const ebayMedia = makeEbayMediaService();
    const ebay = makeEbayService({
      getAccountAccessToken: jest.fn().mockRejectedValue(new Error('eBay account not found')),
    });
    const { resolver } = makeResolver({ database, ebayMedia, ebay });

    await expect(resolver.resolve(PRODUCT_ID, ACCOUNT_ID, sourceUrls)).resolves.toEqual({
      galleryUrls: sourceUrls,
      descriptionUrl: '',
    });
    expect(database.transaction).not.toHaveBeenCalled();
    expect(ebayMedia.uploadFromUrl).not.toHaveBeenCalled();
  });
});
