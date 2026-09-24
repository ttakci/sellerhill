import { ImageMirrorService } from './image-mirror.service';

const NAME = '71nx65qZq6L.jpg';
const SOURCE = `https://images-na.ssl-images-amazon.com/images/I/${NAME}`;

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
  it('mirrors and returns our own URL', async () => {
    const { service, put, database } = makeService();
    await expect(service.ensureMirrored('p1', SOURCE, false)).resolves.toBe(
      `https://img.example.com/${NAME}`
    );
    expect(put).toHaveBeenCalledTimes(1);
    expect(database.query).toHaveBeenCalled();
  });

  it('skips the copy when already mirrored but still returns the URL', async () => {
    const { service, put } = makeService();
    await expect(service.ensureMirrored('p1', SOURCE, true)).resolves.toBe(
      `https://img.example.com/${NAME}`
    );
    expect(put).not.toHaveBeenCalled();
  });

  it('does not store a non-image response and does not mark it mirrored', async () => {
    const fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: () => new ArrayBuffer(512),
    });
    const { service, put, database } = makeService({ fetch });
    await expect(service.ensureMirrored('p1', SOURCE, false)).resolves.toBeNull();
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
    await expect(service.ensureMirrored('p1', SOURCE, false)).resolves.toBeNull();
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(database.query).not.toHaveBeenCalled();
  });

  it('returns null on a non-200 from Amazon', async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, headers: new Headers() });
    const { service, put } = makeService({ fetch });
    await expect(service.ensureMirrored('p1', SOURCE, false)).resolves.toBeNull();
    expect(put).not.toHaveBeenCalled();
  });

  it('swallows a storage failure so listing creation is never blocked', async () => {
    const put = jest.fn().mockRejectedValue(new Error('r2 down'));
    const { service, database } = makeService({ put });
    await expect(service.ensureMirrored('p1', SOURCE, false)).resolves.toBeNull();
    expect(database.query).not.toHaveBeenCalled();
  });

  it('returns null for a missing or unusable image URL', async () => {
    const { service, put } = makeService();
    await expect(service.ensureMirrored('p1', undefined, false)).resolves.toBeNull();
    await expect(service.ensureMirrored('p1', 'https://x/images/I/nodot', false)).resolves.toBeNull();
    expect(put).not.toHaveBeenCalled();
  });
});
