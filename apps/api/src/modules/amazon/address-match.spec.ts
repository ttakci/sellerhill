import { addressBlockMatchesBuyer, type MatchableAddress } from './address-match';

const buyer: MatchableAddress = {
  fullName: 'Jane Buyer',
  street: '30 N Gould St 24233',
  city: 'Sheridan',
  state: 'WY',
  zipCode: '82801-6317',
};

describe('addressBlockMatchesBuyer', () => {
  it('matches the buyer address as Amazon renders it', () => {
    expect(
      addressBlockMatchesBuyer(
        'JANE BUYER 30 N GOULD ST 24233, SHERIDAN, WY, 82801-6317, United States',
        buyer,
      ),
    ).toBe(true);
  });

  it('matches when only the 5-digit zip is shown', () => {
    expect(
      addressBlockMatchesBuyer('JANE BUYER 30 N GOULD ST 24233, SHERIDAN, WY 82801', buyer),
    ).toBe(true);
  });

  it('rejects a different unit at the same street and zip', () => {
    // The live account held exactly this pair; a zip-only rule shipped to
    // whichever entry Amazon listed first.
    expect(
      addressBlockMatchesBuyer(
        'JANE BUYER 30 N GOULD ST STE567, SHERIDAN, WY, 82801-6317, United States',
        buyer,
      ),
    ).toBe(false);
  });

  it('rejects a same-zip address on another street', () => {
    expect(
      addressBlockMatchesBuyer('JANE BUYER 12 ELM AVE, SHERIDAN, WY, 82801-6317', buyer),
    ).toBe(false);
  });

  it('rejects the same street in a different zip', () => {
    expect(
      addressBlockMatchesBuyer('JANE BUYER 30 N GOULD ST 24233, SHERIDAN, WY, 99999', buyer),
    ).toBe(false);
  });

  it('ignores case, punctuation and extra whitespace', () => {
    expect(
      addressBlockMatchesBuyer('jane buyer,  30  n. gould st 24233 · sheridan wy 82801', buyer),
    ).toBe(true);
  });

  it('tolerates a differently rendered recipient name', () => {
    // eBay and Amazon often render the recipient differently; the address itself
    // is the decisive signal.
    expect(
      addressBlockMatchesBuyer('J. BUYER 30 N GOULD ST 24233, SHERIDAN, WY, 82801-6317', buyer),
    ).toBe(true);
  });

  it('requires the buyer unit line when present', () => {
    const withUnit: MatchableAddress = { ...buyer, street: '30 N Gould St', street2: 'Ste 567' };
    expect(
      addressBlockMatchesBuyer('JANE BUYER 30 N GOULD ST, SHERIDAN, WY, 82801-6317', withUnit),
    ).toBe(false);
    expect(
      addressBlockMatchesBuyer(
        'JANE BUYER 30 N GOULD ST STE 567, SHERIDAN, WY, 82801-6317',
        withUnit,
      ),
    ).toBe(true);
  });

  describe('USPS standardisation (Amazon rewrites the address it saves)', () => {
    // Amazon standardises every saved address to USPS form: street suffixes and
    // directions are abbreviated, everything is upper case, a missing space
    // between the house number and the street is inserted. The eBay side keeps
    // what the buyer typed. Shapes below are the ones production orders carry.
    const cases: Array<[string, MatchableAddress, string]> = [
      [
        'Lane -> LN',
        { street: '115 Cambron Lane', zipCode: '40060-7518' },
        'M J BUYER 115 CAMBRON LN, RAYWICK, KY, 40060-7518, United States',
      ],
      [
        'Road -> RD, lower-case input',
        { street: 'w10281 benson lake road', zipCode: '54102-9301' },
        'R BUYER W10281 BENSON LAKE RD, AMBERG, WI, 54102-9301, United States',
      ],
      [
        'missing space after the house number, trailing dot',
        { street: '121Daniel St.', zipCode: '07064-1134' },
        'P BUYER 121 DANIEL ST, PORT READING, NJ, 07064-1134, United States',
      ],
      [
        'Drive / North -> DR / N',
        { street: '802 North Cliftwood Drive', zipCode: '27344' },
        'R BUYER 802 N CLIFTWOOD DR, SILER CITY, NC, 27344-2302, United States',
      ],
      [
        'unit designator spelled out on eBay',
        { street: '106 Van Wagner Road', street2: 'Apartment 3B', zipCode: '12603-1305' },
        'D BUYER 106 VAN WAGNER RD APT 3B, POUGHKEEPSIE, NY, 12603-1305, United States',
      ],
      [
        'Court -> CT',
        { street: '4820 Juniper Court', zipCode: '97024-1111' },
        'S BUYER 4820 JUNIPER CT, FAIRVIEW, OR, 97024-1111, United States',
      ],
    ];

    it.each(cases)('matches across %s', (_label, address, block) => {
      expect(addressBlockMatchesBuyer(block, address)).toBe(true);
    });

    it('still rejects a different house number on the same standardised street', () => {
      expect(
        addressBlockMatchesBuyer('M J BUYER 117 CAMBRON LN, RAYWICK, KY, 40060-7518', {
          street: '115 Cambron Lane',
          zipCode: '40060-7518',
        }),
      ).toBe(false);
    });

    it('does not let an abbreviation collapse two different streets', () => {
      // "Court" and "Circle" are distinct suffixes; the same name with the other
      // suffix is a different street.
      expect(
        addressBlockMatchesBuyer('S BUYER 4820 JUNIPER CIR, FAIRVIEW, OR, 97024-1111', {
          street: '4820 Juniper Court',
          zipCode: '97024-1111',
        }),
      ).toBe(false);
    });
  });

  it('refuses to match when the buyer address lacks zip or street', () => {
    expect(addressBlockMatchesBuyer('anything', { ...buyer, zipCode: undefined })).toBe(false);
    expect(addressBlockMatchesBuyer('anything', { ...buyer, street: undefined })).toBe(false);
  });
});
