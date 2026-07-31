import { extractProductAttributes, type KeepaRawProduct } from './keepa-normalizer';

/**
 * Fixtures mirror the official Keepa product schema
 * (keepacom/api_backend Product.java). The point of this suite is that we
 * harvest what Keepa ACTUALLY sends — an earlier version read invented fields
 * (`flavor`, `department`, `genre`, `variationAttributes`) and ignored the real
 * ones, which is why listings published with a handful of item specifics.
 */
describe('extractProductAttributes', () => {
  const raw: KeepaRawProduct = {
    asin: 'B00TEST123',
    title: 'Zero Gravity Chair Replacement Cord Set',
    brand: 'Fruit by the Foot',
    manufacturer: 'GENERAL MILLS',
    model: 'FRU-16',
    partNumber: '43396-136898',
    color: 'Black',
    size: '98.4 inches',
    pattern: 'Solid',
    style: 'Elastic',
    scent: 'Unscented',
    itemForm: 'Rolled',
    itemTypeKeyword: 'Cords Zero Gravity',
    targetAudienceKeyword: 'Adult',
    materials: ['Nylon', 'Latex'],
    includedComponents: 'User Manual',
    recommendedUsesForProduct: 'Lounge, Outdoor',
    specificUsesForProduct: ['Patio', 'Garden'],
    specialFeatures: ['Premium', 'Foldable'],
    batteriesRequired: false,
    numberOfItems: 4,
    packageQuantity: -1,
    itemWeight: 289,
    itemLength: 254,
    unitCount: { unitValue: 4, unitType: 'Count' },
    upcList: ['016000185234'],
    eanList: ['0016000185234'],
    variations: [
      { asin: 'B00TEST123', attributes: [{ dimension: 'Flavor Name', value: 'Variety Pack' }] },
      { asin: 'B00OTHER99', attributes: [{ dimension: 'Flavor Name', value: 'Strawberry' }] },
    ],
    hazardousMaterials: [{ aspect: 'Battery Type', value: 'Lithium Ion' }],
  };

  it('harvests the full descriptive attribute surface Keepa returns', () => {
    const { specs } = extractProductAttributes(raw);

    expect(specs).toMatchObject({
      Brand: 'Fruit by the Foot',
      Manufacturer: 'GENERAL MILLS',
      Color: 'Black',
      Pattern: 'Solid',
      Style: 'Elastic',
      'Item Form': 'Rolled',
      Type: 'Cords Zero Gravity',
      Department: 'Adult',
      Material: 'Nylon, Latex',
      'Included Components': 'User Manual',
      'Recommended Uses': 'Lounge, Outdoor',
      'Specific Uses': 'Patio, Garden',
      Features: 'Premium, Foldable',
      'Batteries Required': 'No',
      'Number of Items': '4',
      'Unit Quantity': '4 Count',
      'Unit Type': 'Count',
    });

    // A rich table, not the three specifics we used to publish.
    expect(Object.keys(specs).length).toBeGreaterThanOrEqual(20);
  });

  it('reads variation dimensions for THIS asin only', () => {
    const { specs } = extractProductAttributes(raw);
    expect(specs['Flavor Name']).toBe('Variety Pack');
  });

  it('carries hazard aspects under their own names', () => {
    const { specs } = extractProductAttributes(raw);
    expect(specs['Battery Type']).toBe('Lithium Ion');
  });

  it('converts weights and dimensions to US units', () => {
    const { specs } = extractProductAttributes(raw);
    expect(specs['Item Weight']).toBe('10.2 oz');
    expect(specs['Item Length']).toBe('10 in');
  });

  it('drops Keepa sentinels rather than publishing them', () => {
    const { specs } = extractProductAttributes(raw);
    expect(specs['Package Quantity']).toBeUndefined();
  });

  it('drops placeholder text like "Unknown" / "N/A"', () => {
    const { specs } = extractProductAttributes({ brand: 'Unknown', color: 'N/A', size: '  ' });
    expect(specs.Brand).toBeUndefined();
    expect(specs.Color).toBeUndefined();
    expect(specs.Size).toBeUndefined();
  });

  it('keeps only check-digit-valid GTINs', () => {
    const { identifiers } = extractProductAttributes(raw);
    expect(identifiers.upc).toBe('016000185234');
    expect(identifiers.ean).toBe('0016000185234');
    expect(identifiers.mpn).toBe('43396-136898');

    const junk = extractProductAttributes({ upcList: ['12345'], eanList: ['0000000000000'] });
    expect(junk.identifiers.upc).toBeUndefined();
    expect(junk.identifiers.ean).toBeUndefined();
  });

  it('never uses a barcode as MPN — eBay rejects the publish for it', () => {
    // Amazon fills partNumber with the UPC for most grocery ASINs.
    const { specs, identifiers } = extractProductAttributes({
      brand: 'Badia',
      partNumber: '021500000529',
      upcList: ['021500000529'],
    });

    expect(identifiers.mpn).toBeUndefined();
    expect(specs.MPN).toBeUndefined();
    expect(identifiers.upc).toBe('021500000529');
  });

  it('never uses the brand name as MPN — eBay rejects that too', () => {
    // Live failure: MPN has an invalid value of "BolaButty" (the brand).
    const { specs, identifiers } = extractProductAttributes({
      brand: 'BolaButty',
      partNumber: 'BolaButty',
    });

    expect(identifiers.mpn).toBeUndefined();
    expect(specs.MPN).toBeUndefined();
    expect(specs.Brand).toBe('BolaButty');
  });

  it('returns empty maps for an empty product instead of throwing', () => {
    const { specs, identifiers } = extractProductAttributes({});
    expect(specs).toEqual({});
    expect(identifiers).toEqual({});
  });
});
