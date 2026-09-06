import { AmazonVerificationFailureCode } from '@repo/shared';

import { classifyAmazonVerificationFailure } from './amazon-verify-helpers';

describe('classifyAmazonVerificationFailure', () => {
  it.each([
    [
      'Amazon login failed: credentials or challenge rejected',
      AmazonVerificationFailureCode.INVALID_CREDENTIALS,
    ],
    [
      'Amazon captcha challenge blocked automated login',
      AmazonVerificationFailureCode.CAPTCHA,
    ],
    [
      'Amazon requires 2FA but no secret key is configured for this account',
      AmazonVerificationFailureCode.TWO_FACTOR_REQUIRED,
    ],
    [
      'Amazon authentication could not be proven (route=/ap/signin; authRoute=true; authControl=true; signedOutNav=true; signedInNav=false; accountMarker=false)',
      AmazonVerificationFailureCode.AUTH_NOT_PROVEN,
    ],
    [
      'Amazon login page did not expose an email field (HTTP 503, URL https://www.amazon.com/ap/signin, title Sorry)',
      AmazonVerificationFailureCode.UNEXPECTED_LOGIN_PAGE,
    ],
    [
      'Amazon password step unavailable: route=https://www.amazon.com/ap/signin; title=Sign-In; captcha=false; accountError=false; passkey=true; otp=false; controls=[]',
      AmazonVerificationFailureCode.UNEXPECTED_LOGIN_PAGE,
    ],
    [
      'Amazon claim-intent page exposed 0 submit controls; expected exactly one',
      AmazonVerificationFailureCode.UNEXPECTED_LOGIN_PAGE,
    ],
    [
      'page.goto: Timeout 30000ms exceeded.',
      AmazonVerificationFailureCode.TRANSPORT,
    ],
    [
      'Target page, context or browser has been closed',
      AmazonVerificationFailureCode.TRANSPORT,
    ],
    ['net::ERR_CONNECTION_RESET at https://www.amazon.com/', AmazonVerificationFailureCode.TRANSPORT],
  ])('maps %j → %s', (raw, expected) => {
    expect(classifyAmazonVerificationFailure(raw)).toBe(expected);
  });

  it('checks 2FA-missing before the generic credential phrase', () => {
    // The message contains neither "captcha" nor "credentials", but a naive
    // ordering that tested INVALID_CREDENTIALS on "requires" first would break.
    expect(
      classifyAmazonVerificationFailure(
        'Amazon requires 2FA but no secret key is configured for this account',
      ),
    ).toBe(AmazonVerificationFailureCode.TWO_FACTOR_REQUIRED);
  });

  it('is case-insensitive', () => {
    expect(classifyAmazonVerificationFailure('AMAZON CAPTCHA CHALLENGE BLOCKED')).toBe(
      AmazonVerificationFailureCode.CAPTCHA,
    );
  });

  it.each([[''], ['   '], [null], [undefined], ['something we have never seen before']])(
    'falls back to UNKNOWN for %j',
    (raw) => {
      expect(classifyAmazonVerificationFailure(raw)).toBe(AmazonVerificationFailureCode.UNKNOWN);
    },
  );
});
