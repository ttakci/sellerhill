import type { ProductData } from '@repo/shared';

import { attachEpsImages } from './attach-eps-images';

describe('attachEpsImages', () => {
  const resolver = (result: { galleryUrls: string[]; descriptionUrl: string }) => ({
    resolve: jest.fn().mockResolvedValue(result),
  });

  it('sets imageUrls to the resolver gallery URLs and mainImageUrl to its description URL', async () => {
    const product = {
      imageUrls: ['https://a/images/I/71nx65qZq6L.jpg', 'https://a/images/I/9106K0FD50L.jpg'],
    } as ProductData;
    const service = resolver({
      galleryUrls: ['https://i.ebayimg.com/1', 'https://i.ebayimg.com/2'],
      descriptionUrl: 'https://i.ebayimg.com/1',
    });

    await attachEpsImages(service, 'p1', 'account-1', product);

    expect(product.imageUrls).toEqual(['https://i.ebayimg.com/1', 'https://i.ebayimg.com/2']);
    expect(product.mainImageUrl).toBe('https://i.ebayimg.com/1');
    expect(service.resolve).toHaveBeenCalledWith('p1', 'account-1', [
      'https://a/images/I/71nx65qZq6L.jpg',
      'https://a/images/I/9106K0FD50L.jpg',
    ]);
  });

  it('leaves both untouched when the product has no images', async () => {
    const product = { imageUrls: [] } as unknown as ProductData;
    const service = resolver({ galleryUrls: [], descriptionUrl: '' });

    await attachEpsImages(service, 'p1', 'account-1', product);

    expect(service.resolve).not.toHaveBeenCalled();
    expect(product.imageUrls).toEqual([]);
    expect(product.mainImageUrl).toBeUndefined();
  });

  /**
   * The draft-publish path (`ListingsService.prepareDraftForPublish`) can
   * resolve `ebayAccountId` to null — there is no store to charge the upload
   * to or key `product_ebay_images` on, so this must no-op rather than call
   * the resolver with a null key.
   */
  it('leaves both untouched when there is no eBay account to key the cache on', async () => {
    const product = { imageUrls: ['https://a/images/I/71nx65qZq6L.jpg'] } as ProductData;
    const service = resolver({
      galleryUrls: ['https://i.ebayimg.com/1'],
      descriptionUrl: 'https://i.ebayimg.com/1',
    });

    await attachEpsImages(service, 'p1', null, product);

    expect(service.resolve).not.toHaveBeenCalled();
    expect(product.imageUrls).toEqual(['https://a/images/I/71nx65qZq6L.jpg']);
    expect(product.mainImageUrl).toBeUndefined();
  });

  it('never throws when the resolver rejects', async () => {
    const product = { imageUrls: ['https://a/images/I/71nx65qZq6L.jpg'] } as ProductData;
    const service = { resolve: jest.fn().mockRejectedValue(new Error('boom')) };

    await expect(attachEpsImages(service, 'p1', 'account-1', product)).resolves.toBeUndefined();
  });
});
