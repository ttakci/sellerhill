/**
 * Sign-up-free demo mode.
 *
 * Sellerboard hands visitors a seeded server-side account; we serve the same
 * experience from fixtures in the browser instead. That choice is deliberate:
 * no shared mutable account (one visitor's edits can't leak into the next
 * one's session), no real auth surface to guard, and no provider quota spent
 * on someone who is only looking around.
 *
 * The flag is read ONCE at module load and entering/leaving demo mode is a
 * full document navigation, never a router push. That is what keeps the Redux
 * store, the RTK Query cache and this flag from ever disagreeing mid-session —
 * a live toggle would leave real cached responses sitting behind demo fixtures
 * (or the reverse).
 *
 * `sessionStorage` scopes it per tab, so opening the demo never disturbs a real
 * session in another tab.
 */
const DEMO_FLAG_KEY = 'sellerhill_demo';

function readFlag(): boolean {
  try {
    return sessionStorage.getItem(DEMO_FLAG_KEY) === '1';
  } catch {
    // Private-mode / blocked storage: treat as "not a demo" and serve the real API.
    return false;
  }
}

/**
 * Pages that are the way OUT of the app: the landing and the sign-in/sign-up
 * screens. Opening one in the demo tab (typed URL, bookmark, back button)
 * ends the demo — otherwise the landing wore the demo banner and the login
 * form was answered by fixtures, handing out the sample user.
 */
const DEMO_EXIT_PATH =
  /^\/(?:(?:[a-z]{2}\/)?(?:login|register|verify-email|auth\/check-email|forgot-password|reset-password)\/?)?$/;

function readActive(): boolean {
  if (!readFlag()) {
    return false;
  }
  if (DEMO_EXIT_PATH.test(window.location.pathname)) {
    try {
      sessionStorage.removeItem(DEMO_FLAG_KEY);
    } catch {
      // ignore — this document is still served by the real API below
    }
    return false;
  }
  return true;
}

const active = readActive();

/** True for the whole lifetime of this document when the demo is running. */
export function isDemoMode(): boolean {
  return active;
}

/** Turns the demo on and hard-navigates into the app. */
export function enterDemoMode(path: string): void {
  try {
    sessionStorage.setItem(DEMO_FLAG_KEY, '1');
  } catch {
    // Nothing to fall back to — without storage the next document cannot know
    // it is a demo, so bail out rather than landing on a login redirect.
    return;
  }
  window.location.assign(path);
}

/** Turns the demo off and hard-navigates away. */
export function exitDemoMode(path: string): void {
  try {
    sessionStorage.removeItem(DEMO_FLAG_KEY);
  } catch {
    // ignore — the navigation below still leaves the demo surface
  }
  window.location.assign(path);
}
