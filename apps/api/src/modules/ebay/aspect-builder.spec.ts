import {
  buildAspectResolution,
  buildAspects,
  extractSpecsFromFeatures,
  fallbackValueFor,
  matchAspectValue,
  type CategoryAspect,
} from './aspect-builder';

const freeText = (name: string, required = false): CategoryAspect => ({
  name,
  required,
  selectionOnly: false,
  multiValue: false,
  values: [],
});

const selection = (name: string, values: string[], required = true): CategoryAspect => ({
  name,
  required,
  selectionOnly: true,
  multiValue: false,
  values,
});

describe('matchAspectValue', () => {
  it('returns free-text values trimmed and length-capped', () => {
    expect(matchAspectValue(freeText('Color'), '  Silver  ')).toBe('Silver');
    expect(matchAspectValue({ ...freeText('Type'), maxLength: 5 }, 'Wireless Headphones')).toBe('Wirel');
  });

  it('maps a value onto the category allowed list case-insensitively', () => {
    expect(matchAspectValue(selection('Color', ['Blue', 'Red']), 'blue')).toBe('Blue');
  });

  it('matches by containment when the wording differs', () => {
    expect(matchAspectValue(selection('Size', ['16 oz', '32 oz']), '16 oz.')).toBe('16 oz');
  });

  it('rejects a value the category does not allow instead of forcing it', () => {
    expect(matchAspectValue(selection('Color', ['Blue', 'Red']), 'Chartreuse')).toBeNull();
  });
});

describe('fallbackValueFor', () => {
  it('uses eBay\'s sanctioned "Does not apply" for identifier aspects', () => {
    expect(fallbackValueFor(freeText('MPN', true), 'Some product')).toBe('Does not apply');
    expect(fallbackValueFor(freeText('UPC', true), 'Some product')).toBe('Does not apply');
  });

  it('falls back to Unbranded for Brand', () => {
    expect(fallbackValueFor(freeText('Brand', true), 'Some product')).toBe('Unbranded');
  });

  it('picks an allowed value the title mentions for selection-only aspects', () => {
    const aspect = selection('Food Aisle', ['Snacks', 'Beverages']);
    expect(fallbackValueFor(aspect, 'Fruit Snacks Variety Pack')).toBe('Snacks');
  });

  it('returns null rather than inventing a value for an unknown free-text aspect', () => {
    expect(fallbackValueFor(freeText('Screen Size', true), 'Fruit Roll-Ups')).toBeNull();
  });
});

describe('extractSpecsFromFeatures', () => {
  it('pulls Key: Value pairs out of Amazon bullets', () => {
    expect(
      extractSpecsFromFeatures(['Flavor: Strawberry', 'Contains 16 pouches', 'Item Form: Rolled'])
    ).toEqual({ Flavor: 'Strawberry', 'Item Form': 'Rolled' });
  });

  it('rejects marketing headlines that merely contain a colon', () => {
    // Observed live: this became an item specific named
    // "LARGE 48OZ. CLEAN WATER TANK" on a real listing.
    expect(
      extractSpecsFromFeatures([
        'LARGE 48OZ. CLEAN WATER TANK: Clean more, uninterrupted, with a big tank',
        'EASY STAIN REMOVAL: Just spray, scrub and suction.',
      ])
    ).toEqual({});
  });

  it('normalizes shouty attribute names', () => {
    expect(extractSpecsFromFeatures(['MATERIAL: Nylon'])).toEqual({ Material: 'Nylon' });
  });
});

describe('buildAspects', () => {
  const categoryAspects: CategoryAspect[] = [
    freeText('Brand', true),
    freeText('MPN', true),
    freeText('Food Specifications'),
    selection('Type', ['Fruit Snacks', 'Candy']),
    freeText('Flavor'),
  ];

  it('fills declared aspects from product specs and identifiers', () => {
    const aspects = buildAspects({
      title: 'Fruit Roll-Ups Variety Pack',
      brand: 'Fruit by the Foot',
      specs: { Flavor: 'Assorted', Type: 'Fruit Snacks' },
      identifiers: { mpn: 'GM-16CT' },
      categoryAspects,
    });

    expect(aspects.Brand).toEqual(['Fruit by the Foot']);
    expect(aspects.MPN).toEqual(['GM-16CT']);
    expect(aspects.Type).toEqual(['Fruit Snacks']);
    expect(aspects.Flavor).toEqual(['Assorted']);
  });

  it('never publishes "Unknown", and never leaves a required aspect empty', () => {
    const aspects = buildAspects({
      title: 'Fruit Roll-Ups Variety Pack',
      categoryAspects: [freeText('Brand', true), freeText('MPN', true), freeText('Screen Size', true)],
    });

    expect(Object.values(aspects).flat()).not.toContain('Unknown');
    expect(aspects.MPN).toEqual(['Does not apply']);
    expect(aspects.Brand).toEqual(['Unbranded']);
    // An empty required aspect is what killed listings: eBay refuses the
    // publish and no retry can derive the value.
    expect(aspects['Screen Size']).toEqual(['Does not apply']);
  });

  it('resolves a required SELECTION_ONLY aspect it has no data for', () => {
    // The reported failure: "eBay requires the item specific Department for
    // category 260988 and no value could be derived".
    const resolution = buildAspectResolution({
      title: 'Badia Complete Seasoning, 6 oz',
      categoryAspects: [selection('Department', ['Boys', 'Girls', 'Unisex Adult'])],
    });

    expect(resolution.aspects.Department).toEqual(['Unisex Adult']);
    expect(resolution.unresolvedRequired).toEqual([]);
  });

  it('matches Amazon attribute names onto eBay aspect names via synonyms', () => {
    const aspects = buildAspects({
      title: 'Wireless Headphones',
      specs: { 'Part Number': 'WH-1000', Colour: 'Silver' },
      categoryAspects: [freeText('MPN'), freeText('Color')],
    });

    expect(aspects.MPN).toEqual(['WH-1000']);
    expect(aspects.Color).toEqual(['Silver']);
  });

  it('honours aspects eBay explicitly demanded even when the taxonomy omits them', () => {
    const aspects = buildAspects({
      title: 'Fruit Roll-Ups',
      categoryAspects: [],
      forcedAspectNames: ['UPC'],
    });

    expect(aspects.UPC).toEqual(['Does not apply']);
  });

  it('keeps a free-text aspect eBay demanded publishable without inventing data', () => {
    const aspects = buildAspects({
      title: 'Fruit Roll-Ups',
      categoryAspects: [freeText('Screen Size', true)],
      forcedAspectNames: ['Screen Size'],
    });

    expect(aspects['Screen Size']).toEqual(['Does not apply']);
  });

  it('still fills a selection-only aspect it cannot derive, from the allowed list', () => {
    const aspects = buildAspects({
      title: 'Fruit Roll-Ups',
      categoryAspects: [selection('Shoe Size', ['8', '9', '10'])],
      forcedAspectNames: ['Shoe Size'],
    });

    expect(['8', '9', '10']).toContain(aspects['Shoe Size'][0]);
  });

  it('can be asked NOT to guess (terminal fallback off)', () => {
    const resolution = buildAspectResolution({
      title: 'Fruit Roll-Ups',
      categoryAspects: [selection('Shoe Size', ['8', '9', '10'])],
      allowTerminalFallback: false,
    });

    expect(resolution.aspects['Shoe Size']).toBeUndefined();
    expect(resolution.unresolvedRequired).toEqual(['Shoe Size']);
  });

  it('refuses a barcode as MPN even when it arrives via a feature bullet', () => {
    const aspects = buildAspects({
      title: 'Badia Complete Seasoning',
      brand: 'Badia',
      features: ['Part Number: 021500000529'],
      categoryAspects: [freeText('MPN', true), freeText('UPC')],
      identifiers: { upc: '021500000529' },
    });

    // eBay: "MPN has an invalid value of 021500000529" → publish fails.
    expect(aspects.MPN).toEqual(['Does not apply']);
    expect(aspects.UPC).toEqual(['021500000529']);
  });

  it('refuses the brand name as MPN', () => {
    const aspects = buildAspects({
      title: 'BolaButty Body Butter',
      brand: 'BolaButty',
      specs: { MPN: 'BolaButty' },
      categoryAspects: [freeText('MPN', true)],
    });

    expect(aspects.MPN).toEqual(['Does not apply']);
  });

  it('always emits Brand so listings are never brandless', () => {
    const aspects = buildAspects({ title: 'Generic thing', categoryAspects: [] });
    expect(aspects.Brand).toEqual(['Unbranded']);
  });

  it('emits product attributes the category never declared as custom specifics', () => {
    // The strongest listings on eBay carry the source catalogue's whole
    // attribute table, not just the category's declared aspects.
    const aspects = buildAspects({
      title: 'Zero Gravity Chair Cord',
      specs: {
        'Included Components': 'User Manual',
        'Recommended Uses': 'Lounge, Outdoor',
        Flavor: 'Assorted',
      },
      categoryAspects: [freeText('Flavor')],
    });

    expect(aspects.Flavor).toEqual(['Assorted']);
    expect(aspects['Included Components']).toEqual(['User Manual']);
    expect(aspects['Recommended Uses']).toEqual(['Lounge, Outdoor']);
  });

  it('caps the payload at eBay\'s item-specifics limit, required ones first', () => {
    const specs: Record<string, string> = {};
    for (let i = 0; i < 80; i += 1) {
      specs[`Attribute ${i}`] = `Value ${i}`;
    }

    const aspects = buildAspects({
      title: 'Bulk attribute product',
      specs,
      categoryAspects: [freeText('Brand', true), freeText('Type', true)],
    });

    expect(Object.keys(aspects).length).toBeLessThanOrEqual(45);
    expect(aspects.Brand).toBeDefined();
    expect(aspects.Type).toBeDefined();
  });

  it('does not publish a synonym next to the category\'s own aspect name', () => {
    const aspects = buildAspects({
      title: 'Wireless Headphones',
      specs: { Colour: 'Silver', 'Part Number': 'WH-1000' },
      categoryAspects: [freeText('Color'), freeText('MPN')],
    });

    expect(aspects.Color).toEqual(['Silver']);
    expect(aspects.Colour).toBeUndefined();
    expect(aspects.MPN).toEqual(['WH-1000']);
    expect(aspects['Part Number']).toBeUndefined();
  });

  it('drops noise attributes that are not buyer-facing specifics', () => {
    const aspects = buildAspects({
      title: 'Product',
      specs: { asin: 'B00TEST123', description: 'long text', Color: 'Black' },
      categoryAspects: [],
    });

    expect(aspects.asin).toBeUndefined();
    expect(aspects.description).toBeUndefined();
    expect(aspects.Color).toEqual(['Black']);
  });
});
