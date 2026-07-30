import { decideAmazonAuth, type AmazonAuthSignals } from './amazon-auth-state';

const base: AmazonAuthSignals = {
  route: 'https://www.amazon.com/gp/css/homepage.html',
  authRoute: false,
  authControlVisible: false,
  signedOutNav: false,
  signedInNav: false,
  accountPageMarker: false,
};

const signals = (overrides: Partial<AmazonAuthSignals>): AmazonAuthSignals => ({
  ...base,
  ...overrides,
});

describe('decideAmazonAuth', () => {
  it('accepts auth-gated account content as proof', () => {
    expect(decideAmazonAuth(signals({ accountPageMarker: true }))).toBe(true);
  });

  it('accepts a populated signed-in nav greeting as proof', () => {
    expect(decideAmazonAuth(signals({ signedInNav: true }))).toBe(true);
  });

  it('does NOT let a CDN-cached signed-out header veto auth-gated content', () => {
    // The exact contradictory pair observed live: Your Account rendered while
    // the cached nav still said "Hello, sign in". Vetoing here is what wrongly
    // failed verification for a genuinely logged-in session.
    expect(
      decideAmazonAuth(signals({ accountPageMarker: true, signedOutNav: true }))
    ).toBe(true);
  });

  it('rejects a signed-out header with no positive signal', () => {
    expect(decideAmazonAuth(signals({ signedOutNav: true }))).toBe(false);
  });

  it('rejects when nothing at all was observed', () => {
    expect(decideAmazonAuth(base)).toBe(false);
  });

  it('rejects an auth route even when account content appears to render', () => {
    expect(
      decideAmazonAuth(
        signals({
          route: 'https://www.amazon.com/ax/claim/intent',
          authRoute: true,
          accountPageMarker: true,
        })
      )
    ).toBe(false);
  });

  it('rejects a visible credential/OTP control even alongside a signed-in nav', () => {
    expect(
      decideAmazonAuth(signals({ authControlVisible: true, signedInNav: true }))
    ).toBe(false);
  });

  it('accepts a signed-in storefront with no account-page marker', () => {
    // Observed live: an authenticated request for /gp/css/homepage.html was
    // served as the normal storefront — nav read "Hello, BURAK" but none of the
    // Your Account markers existed. Requiring the marker made a fully valid
    // session look signed out, so verification re-ran performLogin, found no
    // email field (already logged in) and blocked the order on `login`.
    expect(
      decideAmazonAuth(
        signals({ route: 'https://www.amazon.com/', signedInNav: true, accountPageMarker: false })
      )
    ).toBe(true);
  });

  it('would reject a checkout page, which is why checkout uses the inverse probe', () => {
    // Amazon's checkout pipeline renders neither account cards nor the site nav,
    // so every positive marker is absent. Guard rail for the split: if someone
    // points checkout at decideAmazonAuth, this documents why it fails.
    expect(decideAmazonAuth(signals({ route: 'https://www.amazon.com/gp/buy/spc/handlers/display.html' }))).toBe(
      false
    );
  });
});
