import type { Page } from 'playwright';

/**
 * Amazon authentication routes seen across legacy and Unified Auth flows.
 * A session is never authenticated while it remains on one of these routes.
 */
const AUTH_ROUTE_FRAGMENTS = ['/ap/signin', '/ax/claim/', '/signin'];

/** Credential/challenge controls that prove the page is still in auth flow. */
const AUTH_CONTROL_SELECTOR = [
  '#ap_email_login',
  '#ap_email',
  '#ap_password_login',
  '#ap_password',
  '#auth-mfa-otpcode',
  'input[name="email"]',
  'input[name="password"]',
  'input[name="otpCode"]',
].join(', ');

/**
 * Content that only renders for a signed-in customer on the Your Account page.
 * Treated as supporting evidence, not a requirement: Amazon does not always
 * serve this layout for `/gp/css/homepage.html` — an authenticated session can
 * be sent to the normal storefront instead (observed live 2026-07-30), which is
 * why the nav greeting below is the primary signal.
 */
const ACCOUNT_MARKER_SELECTOR = [
  'h1:has-text("Your Account")',
  '[data-card-identifier="YourOrders"]',
  '#yourOrders',
].join(', ');

/**
 * Account-menu greeting. Amazon renders "Hello, <name>" for a signed-in
 * customer and "Hello, sign in" for an anonymous one. Several ids/structures
 * ship concurrently, so read the whole account-list link and fall back through
 * the known containers rather than depending on one inner line element.
 */
const NAV_GREETING_SELECTOR = [
  '#nav-link-accountList-nav-line-1',
  '#nav-link-accountList',
  '#nav-your-account',
].join(', ');

/** Raw DOM observations, separated from the decision so the rule is testable. */
export interface AmazonAuthSignals {
  /** Origin + pathname of the settled page (no query — it carries claim ids). */
  route: string;
  /** The route itself is part of the sign-in/claim flow. */
  authRoute: boolean;
  /** A credential or OTP control is visible. */
  authControlVisible: boolean;
  /** Nav greeting reads as "sign in" (WEAK — see `decideAmazonAuth`). */
  signedOutNav: boolean;
  /** Nav greeting is populated and is not the signed-out variant. */
  signedInNav: boolean;
  /** Auth-gated account content is visible. */
  accountPageMarker: boolean;
}

export interface AmazonAuthProbe extends AmazonAuthSignals {
  authenticated: boolean;
}

/**
 * Decide whether the observed page proves an authenticated Amazon session.
 *
 * Precedence, strongest first:
 *  1. HARD NEGATIVE — an auth route or a visible credential/OTP control means
 *     the flow has not completed. Nothing overrides this.
 *  2. STRONG POSITIVE — auth-gated account content, or a populated non-signed-out
 *     nav greeting.
 *  3. WEAK NEGATIVE — `signedOutNav` alone. Amazon serves its header from a CDN
 *     cache that can render "Hello, sign in" on a fully authenticated page, so
 *     this must NOT veto a strong positive. Treating it as a veto is what made
 *     verification fail with the contradictory `accountMarker=true,
 *     signedOutNav=true` pair.
 */
export function decideAmazonAuth(signals: AmazonAuthSignals): boolean {
  if (signals.authRoute || signals.authControlVisible) {
    return false;
  }
  if (signals.accountPageMarker || signals.signedInNav) {
    return true;
  }
  return false;
}

/**
 * Prove that an Amazon page is authenticated; absence of a signin URL alone is
 * not proof. Unified Auth serves credential pages under `/ax/claim/*`, and a
 * stale profile can render signed-out chrome without redirecting.
 *
 * Callers must navigate to an auth-gated page (e.g. `/gp/css/homepage.html`)
 * before probing. No page body, email or input value is read.
 */
/**
 * Mid-checkout auth check. Amazon's checkout pipeline renders neither the
 * account cards nor the site nav, so `probeAmazonAuth`'s positive markers are
 * absent by design and would produce a false negative there. Inside checkout
 * the only meaningful question is the inverse one: has Amazon bounced us into
 * an identity challenge? Returns false only on that positive evidence.
 */
export async function isOnAmazonAuthChallenge(page: Page): Promise<AmazonAuthProbe> {
  const url = new URL(page.url());
  const route = `${url.origin}${url.pathname}`;
  const authRoute = AUTH_ROUTE_FRAGMENTS.some((fragment) => url.pathname.includes(fragment));
  const authControlVisible = await page
    .locator(AUTH_CONTROL_SELECTOR)
    .first()
    .isVisible()
    .catch(() => false);

  return {
    route,
    authRoute,
    authControlVisible,
    signedOutNav: false,
    signedInNav: false,
    accountPageMarker: false,
    authenticated: !authRoute && !authControlVisible,
  };
}

export async function probeAmazonAuth(page: Page): Promise<AmazonAuthProbe> {
  const url = new URL(page.url());
  const route = `${url.origin}${url.pathname}`;
  const authRoute = AUTH_ROUTE_FRAGMENTS.some((fragment) => url.pathname.includes(fragment));

  const [authControlVisible, navGreeting, accountPageMarker] = await Promise.all([
    page.locator(AUTH_CONTROL_SELECTOR).first().isVisible().catch(() => false),
    page
      .locator(NAV_GREETING_SELECTOR)
      .first()
      .textContent()
      .then((text) => text?.replace(/\s+/g, ' ').trim() ?? '')
      .catch(() => ''),
    page.locator(ACCOUNT_MARKER_SELECTOR).first().isVisible().catch(() => false),
  ]);

  const signedOutNav = /sign\s*in/i.test(navGreeting);
  const signals: AmazonAuthSignals = {
    route,
    authRoute,
    authControlVisible,
    signedOutNav,
    signedInNav: navGreeting.length > 0 && !signedOutNav,
    accountPageMarker,
  };

  return { ...signals, authenticated: decideAmazonAuth(signals) };
}
