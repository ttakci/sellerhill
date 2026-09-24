import {
  buildAmazonSourceImageUrl,
  buildMirroredImageUrl,
  extractKeepaImageName,
  isValidKeepaImageName,
} from '@repo/shared';

const NAME = '71nx65qZq6L.jpg';
const SOURCE = `https://images-na.ssl-images-amazon.com/images/I/${NAME}`;

describe('isValidKeepaImageName', () => {
  it('accepts a real Keepa name', () => {
    expect(isValidKeepaImageName(NAME)).toBe(true);
    expect(isValidKeepaImageName('51a-b_c+d.png')).toBe(true);
  });

  it('rejects a name with no extension', () => {
    expect(isValidKeepaImageName('71nx65qZq6L')).toBe(false);
  });

  it('rejects an interior dot — the allowlist stays strict', () => {
    expect(isValidKeepaImageName('a.b.jpg')).toBe(false);
  });

  it('rejects path separators, traversal and query strings', () => {
    expect(isValidKeepaImageName('../secret.jpg')).toBe(false);
    expect(isValidKeepaImageName('a/b.jpg')).toBe(false);
    expect(isValidKeepaImageName('a\\b.jpg')).toBe(false);
    expect(isValidKeepaImageName('a.jpg?x=1')).toBe(false);
    expect(isValidKeepaImageName('a.jpg#f')).toBe(false);
  });

  it('rejects empty, overlong and non-string input', () => {
    expect(isValidKeepaImageName('')).toBe(false);
    expect(isValidKeepaImageName(`${'a'.repeat(70)}.jpg`)).toBe(false);
    expect(isValidKeepaImageName(undefined as unknown as string)).toBe(false);
  });
});

describe('extractKeepaImageName', () => {
  it('pulls the name out of an Amazon image URL', () => {
    expect(extractKeepaImageName(SOURCE)).toBe(NAME);
  });

  it('returns null for a URL whose last segment is not a valid name', () => {
    expect(extractKeepaImageName('https://images-na.ssl-images-amazon.com/images/I/71nx')).toBeNull();
    expect(extractKeepaImageName('')).toBeNull();
  });
});

describe('buildAmazonSourceImageUrl', () => {
  it('inserts the size variant before the final dot', () => {
    expect(buildAmazonSourceImageUrl(NAME)).toBe(
      'https://images-na.ssl-images-amazon.com/images/I/71nx65qZq6L._SL800_.jpg'
    );
  });

  it('returns null for an invalid name rather than a broken URL', () => {
    expect(buildAmazonSourceImageUrl('71nx65qZq6L')).toBeNull();
    expect(buildAmazonSourceImageUrl('../x.jpg')).toBeNull();
    // An interior dot is rejected by isValidKeepaImageName, so there is no
    // "which dot do we split on" question to answer. Real Keepa names are
    // `<stem>.<ext>` with no interior dot; keeping the allowlist strict keeps
    // the SSRF and key-injection guard tight.
    expect(buildAmazonSourceImageUrl('a.b.jpg')).toBeNull();
  });
});

describe('buildMirroredImageUrl', () => {
  it('joins the base and the name verbatim', () => {
    expect(buildMirroredImageUrl(NAME, 'https://img.example.com')).toBe(
      `https://img.example.com/${NAME}`
    );
  });

  it('tolerates a trailing slash on the base', () => {
    expect(buildMirroredImageUrl(NAME, 'https://img.example.com/')).toBe(
      `https://img.example.com/${NAME}`
    );
  });

  it('returns null for an invalid name or a missing base', () => {
    expect(buildMirroredImageUrl('../x.jpg', 'https://img.example.com')).toBeNull();
    expect(buildMirroredImageUrl(NAME, '')).toBeNull();
  });
});
