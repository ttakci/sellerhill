import {
  extractEpsImageId,
  isEpsImageUrl,
  readEpsImageUrl,
  resolveDescriptionUrl,
  resolveGalleryUrls,
} from '@repo/shared';

const EPS = 'https://i.ebayimg.com/00/s/MTM2OFgxMjMy/z/~sIAAeSwuiRqtYrb/$_1.JPG?set_id=8800005007';
const AMZ1 = 'https://images-na.ssl-images-amazon.com/images/I/9106K0FD50L.jpg';
const AMZ2 = 'https://images-na.ssl-images-amazon.com/images/I/71nx65qZq6L.jpg';

describe('extractEpsImageId', () => {
  it('reads the id from the Location header', () => {
    expect(
      extractEpsImageId('https://apim.ebay.com/commerce/media/v1_beta/image/~sIAAeSwuiRqtYrb')
    ).toBe('~sIAAeSwuiRqtYrb');
  });

  it('tolerates a trailing slash', () => {
    expect(extractEpsImageId('https://apim.ebay.com/commerce/media/v1_beta/image/abc/')).toBe('abc');
  });

  it('returns null for a missing or unusable header', () => {
    expect(extractEpsImageId(null)).toBeNull();
    expect(extractEpsImageId('')).toBeNull();
    expect(extractEpsImageId('https://apim.ebay.com/commerce/media/v1_beta/image/')).toBeNull();
  });
});

describe('readEpsImageUrl', () => {
  it('reads imageUrl from a 201 body', () => {
    expect(readEpsImageUrl(JSON.stringify({ imageUrl: EPS, expirationDate: 'x' }))).toBe(EPS);
  });

  it('returns null when the body carries no imageUrl', () => {
    // eBay's OpenAPI declares ImageResponse on the 201, but the probe never saw
    // a populated body. Absence has to be survivable, not a crash.
    expect(readEpsImageUrl(JSON.stringify({ expirationDate: 'x' }))).toBeNull();
    expect(readEpsImageUrl('')).toBeNull();
    expect(readEpsImageUrl('not json')).toBeNull();
  });

  it('rejects an imageUrl that is not an EPS URL', () => {
    expect(readEpsImageUrl(JSON.stringify({ imageUrl: AMZ1 }))).toBeNull();
  });
});

describe('isEpsImageUrl', () => {
  it('accepts an i.ebayimg.com url', () => {
    expect(isEpsImageUrl(EPS)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isEpsImageUrl(AMZ1)).toBe(false);
    expect(isEpsImageUrl('https://img.sellerhill.com/x.jpg')).toBe(false);
    expect(isEpsImageUrl('')).toBe(false);
    expect(isEpsImageUrl(undefined as unknown as string)).toBe(false);
  });
});

describe('resolveGalleryUrls', () => {
  it('uses EPS where available and the source where not', () => {
    // The gallery falls back per image: eBay revises imageUrls on every
    // price/stock sync, so a missing mirror there is correctable.
    const map = new Map([[AMZ2, EPS]]);
    expect(resolveGalleryUrls([AMZ1, AMZ2], map)).toEqual([AMZ1, EPS]);
  });

  it('preserves order', () => {
    const map = new Map([[AMZ1, EPS]]);
    expect(resolveGalleryUrls([AMZ1, AMZ2], map)).toEqual([EPS, AMZ2]);
  });

  it('returns an empty array for no source images', () => {
    expect(resolveGalleryUrls([], new Map())).toEqual([]);
  });
});

describe('resolveDescriptionUrl', () => {
  it('returns the EPS url for the FIRST image', () => {
    expect(resolveDescriptionUrl([AMZ1, AMZ2], new Map([[AMZ1, EPS]]))).toBe(EPS);
  });

  it('returns empty when the FIRST image has no EPS url, even if later ones do', () => {
    // The description is written once at publish and never revised, so it must
    // never fall back to Amazon — and must not silently promote image 2.
    expect(resolveDescriptionUrl([AMZ1, AMZ2], new Map([[AMZ2, EPS]]))).toBe('');
  });

  it('returns empty for no source images', () => {
    expect(resolveDescriptionUrl([], new Map())).toBe('');
  });
});
