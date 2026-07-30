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

  it('refuses to match when the buyer address lacks zip or street', () => {
    expect(addressBlockMatchesBuyer('anything', { ...buyer, zipCode: undefined })).toBe(false);
    expect(addressBlockMatchesBuyer('anything', { ...buyer, street: undefined })).toBe(false);
  });
});
