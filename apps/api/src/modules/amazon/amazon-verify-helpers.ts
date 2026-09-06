import { AmazonVerificationFailureCode } from '@repo/shared';

/**
 * Classify the raw failure message from a login/verification attempt
 * (`AmazonScrapingService.testLogin` → `performLogin`) into ONE stable,
 * seller-facing `AmazonVerificationFailureCode`.
 *
 * Pure + Jest-covered, mirroring `auto-fulfill-helpers.ts`. The verify
 * processor calls this BEFORE `markInvalid`, so `amazon_accounts
 * .last_verification_error` only ever holds a code — never the raw sentence,
 * which is unbounded and can echo account identifiers / URLs / DOM dumps
 * (see the throw sites in `amazon-scraping.service.ts`). The raw text stays
 * in the Winston logs the processor already writes.
 *
 * The known raw messages this must recognise (substring, case-insensitive):
 *   - "Amazon login failed: credentials or challenge rejected"
 *   - "Amazon captcha challenge blocked automated login"
 *   - "Amazon requires 2FA but no secret key is configured for this account"
 *   - "Amazon authentication could not be proven (route=…; …)"
 *   - "Amazon login page did not expose an email field (HTTP …)"
 *   - "Amazon password step unavailable: route=…; …"
 *   - "Amazon claim-intent page exposed N submit controls; expected exactly one"
 *   - anything else (navigation timeouts, "Target closed", network errors, …)
 *
 * @param rawMessage `Error.message` from the failed attempt (may be empty).
 * @returns the seller-facing code; `UNKNOWN` when nothing matches.
 */
export function classifyAmazonVerificationFailure(
  rawMessage: string | null | undefined,
): AmazonVerificationFailureCode {
  const msg = (rawMessage ?? '').toLowerCase();
  if (!msg.trim()) {
    return AmazonVerificationFailureCode.UNKNOWN;
  }

  // 2FA-missing is checked first: its message also contains "amazon requires",
  // and it is the one cause with a concrete seller fix (add the TOTP secret).
  if (/requires 2fa|no secret key is configured|2fa.*secret/.test(msg)) {
    return AmazonVerificationFailureCode.TWO_FACTOR_REQUIRED;
  }

  // Selector-drift phrases are matched BEFORE the generic `captcha` /
  // `credentials` checks: the "password step unavailable" diagnostic embeds
  // `captcha=false; accountError=false; …` as key names, which a bare
  // /captcha/ would wrongly claim as a captcha challenge.
  if (
    /did not expose an email field|password step unavailable|claim-intent page exposed|claim-intent .*submit controls/.test(
      msg,
    )
  ) {
    return AmazonVerificationFailureCode.UNEXPECTED_LOGIN_PAGE;
  }

  // Submit produced no error but no signed-in signal could be proven.
  if (/authentication could not be proven|not proven authenticated/.test(msg)) {
    return AmazonVerificationFailureCode.AUTH_NOT_PROVEN;
  }

  if (/captcha challenge|captcha required|captcha blocked|blocked automated login/.test(msg)) {
    return AmazonVerificationFailureCode.CAPTCHA;
  }

  // "credentials or challenge rejected" is the auth-error box on the sign-in
  // form; "invalid credentials" is the phrase the checkout path also keys on.
  if (/credentials or challenge rejected|invalid credentials|login failed/.test(msg)) {
    return AmazonVerificationFailureCode.INVALID_CREDENTIALS;
  }

  // Transport/infra: Playwright navigation timeouts, closed targets, network.
  if (
    /timeout|timed out|net::|err_|econnreset|econnrefused|socket hang up|target (page|frame|browser)?.*closed|navigation (failed|timeout)|browser has been closed/.test(
      msg,
    )
  ) {
    return AmazonVerificationFailureCode.TRANSPORT;
  }

  return AmazonVerificationFailureCode.UNKNOWN;
}
