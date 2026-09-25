import { EBAY_MAX_IMAGES } from '@repo/shared';

import { EbayImageResolver } from './ebay-image-resolver.service';

const PRODUCT_ID = 'product-1';
const ACCOUNT_ID = 'account-1';

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

function makeResolver(overrides: {
  database?: ReturnType<typeof makeDatabase>;
  ebayMedia?: ReturnType<typeof makeEbayMediaService>;
} = {}) {
  const database = overrides.database ?? makeDatabase();
  const ebayMedia = overrides.ebayMedia ?? makeEbayMediaService();
  const resolver = new EbayImageResolver(database as never, ebayMedia as never);
  return { resolver, database, ebayMedia };
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
    expect(uploadFromUrl).toHaveBeenNthCalledWith(1, ACCOUNT_ID, sourceUrls[0]);
    expect(uploadFromUrl).toHaveBeenNthCalledWith(2, ACCOUNT_ID, sourceUrls[1]);
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
    const uploadFromUrl = jest.fn().mockImplementation((_accountId: string, url: string) =>
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
