import { ImageMirrorService } from './image-mirror.service';

const NAME = '71nx65qZq6L.jpg';
const SOURCE = `https://images-na.ssl-images-amazon.com/images/I/${NAME}`;
// A DIFFERENT name from NAME — stands in for a Keepa refresh having rotated
// the product's primary image since it was mirrored under NAME.
const ROTATED_NAME = '81zzzzzzzzL.jpg';
const ROTATED_SOURCE = `https://images-na.ssl-images-amazon.com/images/I/${ROTATED_NAME}`;

function makeService(overrides: { put?: jest.Mock; fetch?: jest.Mock } = {}) {
  const config = {
    get: (key: string) =>
      ({
        R2_ACCOUNT_ID: 'acc',
        R2_ACCESS_KEY_ID: 'key',
        R2_SECRET_ACCESS_KEY: 'secret',
        R2_BUCKET: 'bucket',
        IMAGE_CDN_BASE_URL: 'https://img.example.com',
      })[key],
  };
  const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const service = new ImageMirrorService(config as never, database as never);
  const put = overrides.put ?? jest.fn().mockResolvedValue(undefined);
  (service as unknown as { putObject: unknown }).putObject = put;
  global.fetch = (overrides.fetch ??
    jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg', 'cache-control': 'max-age=630720000' }),
      arrayBuffer: () => new ArrayBuffer(1024),
    })) as never;
  return { service, put, database };
}

describe('ImageMirrorService.ensureMirrored', () => {
  it('mirrors and returns our own URL when nothing is stored yet', async () => {
    const { service, put, database } = makeService();
    await expect(service.ensureMirrored('p1', SOURCE, null)).resolves.toBe(
      `https://img.example.com/${NAME}`
    );
    expect(put).toHaveBeenCalledTimes(1);
    expect(database.query).toHaveBeenCalled();
  });

  it('reuse: skips the copy when a name is already stored, and still returns its URL', async () => {
    const { service, put } = makeService();
    await expect(service.ensureMirrored('p1', SOURCE, NAME)).resolves.toBe(
      `https://img.example.com/${NAME}`
    );
    expect(put).not.toHaveBeenCalled();
  });

  /**
   * THE regression test for the reuse-path bug: the caller's `imageUrl` is
   * `image_urls[0]`, which a Keepa refresh can rotate at any time, while the
   * eBay description already embeds the OLD (stored) name and is never
   * revised. This product was mirrored under NAME; its current image has
   * since rotated to ROTATED_NAME. The reuse path must return NAME's URL —
   * never re-derive a name from the rotated `imageUrl` — and must not
   * re-upload.
   *
   * This is deliberately NOT the same as the "reuse" test above: that test
   * reused SOURCE for both the stored name and the current imageUrl, so the
   * two could never disagree and the assertion could not distinguish "built
   * from the stored name" from "built from imageUrl" — which is exactly how
   * the bug survived review. See the failing-against-old-behavior evidence
   * captured for this test in the final fix report.
   */
  it('reuse: returns the STORED name URL even when the current imageUrl has rotated to a different image', async () => {
    const { service, put, database } = makeService();
    await expect(service.ensureMirrored('p1', ROTATED_SOURCE, NAME)).resolves.toBe(
      `https://img.example.com/${NAME}`
    );
    expect(put).not.toHaveBeenCalled();
    expect(database.query).not.toHaveBeenCalled();
  });

  it('null stored name takes the upload path even when imageUrl also carries a name', async () => {
    const { service, put, database } = makeService();
    await expect(service.ensureMirrored('p1', ROTATED_SOURCE, null)).resolves.toBe(
      `https://img.example.com/${ROTATED_NAME}`
    );
    expect(put).toHaveBeenCalledTimes(1);
    expect(database.query).toHaveBeenCalled();
  });

  it('does not store a non-image response and does not mark it mirrored', async () => {
    const fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: () => new ArrayBuffer(512),
    });
    const { service, put, database } = makeService({ fetch });
    await expect(service.ensureMirrored('p1', SOURCE, null)).resolves.toBeNull();
    expect(put).not.toHaveBeenCalled();
    expect(database.query).not.toHaveBeenCalled();
  });

  it('refuses an oversized response by content-length before reading the body', async () => {
    const arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(1024));
    const fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'image/jpeg',
        'content-length': String(10 * 1024 * 1024),
      }),
      arrayBuffer,
    });
    const { service, put, database } = makeService({ fetch });
    await expect(service.ensureMirrored('p1', SOURCE, null)).resolves.toBeNull();
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(database.query).not.toHaveBeenCalled();
  });

  it('returns null on a non-200 from Amazon', async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, headers: new Headers() });
    const { service, put } = makeService({ fetch });
    await expect(service.ensureMirrored('p1', SOURCE, null)).resolves.toBeNull();
    expect(put).not.toHaveBeenCalled();
  });

  it('swallows a storage failure so listing creation is never blocked', async () => {
    const put = jest.fn().mockRejectedValue(new Error('r2 down'));
    const { service, database } = makeService({ put });
    await expect(service.ensureMirrored('p1', SOURCE, null)).resolves.toBeNull();
    expect(database.query).not.toHaveBeenCalled();
  });

  it('returns null for a missing or unusable image URL when nothing is stored', async () => {
    const { service, put } = makeService();
    await expect(service.ensureMirrored('p1', undefined, null)).resolves.toBeNull();
    await expect(service.ensureMirrored('p1', 'https://x/images/I/nodot', null)).resolves.toBeNull();
    expect(put).not.toHaveBeenCalled();
  });

  it('returns the stored name URL even with no imageUrl at all (reuse never needs it)', async () => {
    const { service, put } = makeService();
    await expect(service.ensureMirrored('p1', undefined, NAME)).resolves.toBe(
      `https://img.example.com/${NAME}`
    );
    expect(put).not.toHaveBeenCalled();
  });
});
