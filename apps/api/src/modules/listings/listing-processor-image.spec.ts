import { attachMirroredImage } from './listing-processor.service';

describe('attachMirroredImage', () => {
  const mirror = (url: string | null) => ({ ensureMirrored: jest.fn().mockResolvedValue(url) });

  it('attaches our URL when the mirror succeeds', async () => {
    const product = { imageUrls: ['https://a/images/I/71nx65qZq6L.jpg'] } as never;
    const service = mirror('https://img.example.com/71nx65qZq6L.jpg');
    await attachMirroredImage(service as never, 'p1', product, false);
    expect((product as { mainImageMirroredUrl?: string }).mainImageMirroredUrl).toBe(
      'https://img.example.com/71nx65qZq6L.jpg'
    );
  });

  it('leaves the field undefined when the mirror fails', async () => {
    const product = { imageUrls: ['https://a/images/I/71nx65qZq6L.jpg'] } as never;
    await attachMirroredImage(mirror(null) as never, 'p1', product, false);
    expect((product as { mainImageMirroredUrl?: string }).mainImageMirroredUrl).toBeUndefined();
  });

  it('attempts nothing for a product with no images', async () => {
    const product = { imageUrls: [] } as never;
    const service = mirror(null);
    await attachMirroredImage(service as never, 'p1', product, false);
    expect(service.ensureMirrored).not.toHaveBeenCalled();
  });

  it('never throws, whatever the mirror does', async () => {
    const product = { imageUrls: ['https://a/images/I/71nx65qZq6L.jpg'] } as never;
    const service = { ensureMirrored: jest.fn().mockRejectedValue(new Error('boom')) };
    await expect(attachMirroredImage(service as never, 'p1', product, false)).resolves.toBeUndefined();
  });
});
