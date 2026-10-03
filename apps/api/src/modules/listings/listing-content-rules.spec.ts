import { BlacklistAction, BlacklistType, type BlacklistKeyword, type ProductData } from '@repo/shared';

import { applyContentRules, removeKeywords, stripContactDetails } from './listing-content-rules';

const product = (over: Partial<ProductData> = {}): ProductData => ({
  asin: 'B000000001',
  title: 'Acme Steel Bottle with Lifetime Guarantee, 24oz',
  description: 'Questions? Email help@acme.com or call (800) 555-0199. Visit www.acme.com/support today.',
  imageUrls: ['https://example.test/a.jpg'],
  brand: 'Acme',
  manufacturer: 'Acme Inc',
  features: ['Guarantee: 2 years', 'Keeps drinks cold'],
  specs: { Brand: 'Acme', Color: 'Blue', Manufacturer: 'Acme Inc' },
  identifiers: { upc: '012345678905', mpn: 'AC-24' },
  price: { current: 12, currency: 'USD' },
  ...over,
});

const keyword = (word: string, types: BlacklistType[], action?: BlacklistAction): BlacklistKeyword => ({
  id: word,
  keyword: word,
  types,
  action,
});

describe('stripContactDetails', () => {
  it('removes e-mail, web addresses and separated phone numbers', () => {
    const out = stripContactDetails(product().description);
    expect(out).not.toMatch(/acme\.com|@|555/);
    expect(out).toContain('Questions?');
  });

  it('leaves a barcode, a model number and a measurement alone', () => {
    const text = 'UPC 012345678905, model 8005550199, 12.5 x 4.25 in, fits 2020-2024 models';
    expect(stripContactDetails(text)).toBe(text);
  });

  it('never rewrites a URL inside a tag attribute', () => {
    const html = '<p>See <img src="https://m.media-amazon.com/x.jpg"> or shop.example.com</p>';
    expect(stripContactDetails(html)).toBe('<p>See <img src="https://m.media-amazon.com/x.jpg"> or </p>');
  });

  it('does not eat the next sentence when the copy drops the space after a full stop', () => {
    const text = 'Leak-proof.Store upright. Durable.Net weight 2 lb. Easy.Shop with confidence.';
    expect(stripContactDetails(text)).toBe(text);
  });

  it('catches a bare domain and a phone number with a country code', () => {
    expect(stripContactDetails('Support: acme-tools.com, +1 800 555 0199.')).not.toMatch(/acme-tools|800/);
  });
});

describe('removeKeywords', () => {
  it('removes whole words only, in any case', () => {
    expect(removeKeywords('Original packaging, GUARANTEE included', ['guarantee', 'gin'])).toBe(
      'Original packaging, included'
    );
  });

  it('treats a hyphenated compound as a different word', () => {
    expect(removeKeywords('cross-body bag, cross stitch', ['cross'])).toBe('cross-body bag, stitch');
  });

  it('touches only text between tags', () => {
    expect(removeKeywords('<div class="amazon">Amazon choice</div>', ['amazon'])).toBe(
      '<div class="amazon"> choice</div>'
    );
  });
});

describe('applyContentRules', () => {
  const base = { checkBlacklist: true, hideBrand: false };

  it('removes a REMOVE keyword only from the fields it is scoped to', () => {
    const out = applyContentRules(product(), {
      ...base,
      blacklist: [keyword('guarantee', [BlacklistType.TITLE], BlacklistAction.REMOVE)],
    });
    expect(out.title).toBe('Acme Steel Bottle with Lifetime, 24oz');
    expect(out.features).toContain('Guarantee: 2 years');
  });

  it('ignores a keyword whose action is block (or absent)', () => {
    const out = applyContentRules(product(), {
      ...base,
      blacklist: [
        keyword('guarantee', [BlacklistType.TITLE]),
        keyword('steel', [BlacklistType.TITLE], BlacklistAction.BLOCK),
      ],
    });
    expect(out.title).toBe(product().title);
  });

  it('removes nothing while the blacklist switch is off, but still strips contact details', () => {
    const out = applyContentRules(product(), {
      checkBlacklist: false,
      hideBrand: false,
      blacklist: [keyword('guarantee', [BlacklistType.TITLE], BlacklistAction.REMOVE)],
    });
    expect(out.title).toBe(product().title);
    expect(out.description).not.toContain('help@acme.com');
  });

  it('keeps the original title when every word of it would be removed', () => {
    const out = applyContentRules(product({ title: 'Guarantee' }), {
      ...base,
      blacklist: [keyword('guarantee', [BlacklistType.TITLE], BlacklistAction.REMOVE)],
    });
    expect(out.title).toBe('Guarantee');
  });

  it('hides the brand: no brand, no brand specifics, no identifiers', () => {
    const out = applyContentRules(product(), { ...base, hideBrand: true });
    expect(out.brand).toBe('');
    expect(out.manufacturer).toBeUndefined();
    expect(out.identifiers).toEqual({});
    expect(out.specs).toEqual({ Color: 'Blue' });
  });

  it('does not mutate the product it was given', () => {
    const input = product();
    const snapshot = JSON.stringify(input);
    applyContentRules(input, {
      ...base,
      hideBrand: true,
      blacklist: [keyword('steel', [BlacklistType.TITLE], BlacklistAction.REMOVE)],
    });
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
