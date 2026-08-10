// apps/api/src/modules/amazon/browser-profile-gc.ts
//
// Pure decision layer for the per-account Chromium profile garbage collector.
// No fs, no Playwright, no Nest — everything here is unit-testable.
//
// WHY THIS EXISTS
// ---------------
// `BrowserStateManager` gives every Amazon buyer account its own
// `user_data_dir` under `${BROWSER_STATE_DIR}/profiles/${accountId}/`. The
// idle-eviction sweep in that service closes the Chromium PROCESS to bound
// RSS, but nothing ever touched the DIRECTORY. A profile keeps growing (HTTP
// cache, code cache, service-worker CacheStorage, GPU/shader caches) with no
// upper bound, and a deleted Amazon account left its profile behind forever.
// At 500 accounts that is 50–250 GB of disk that nothing reclaims.
//
// THE LOGIN QUESTION — the whole design turns on this
// ---------------------------------------------------
// Deleting the WRONG file forces a full Amazon re-login, and a re-login is the
// single riskiest thing we can do to a buyer account: it can land a captcha or
// an OTP challenge and take the account out of service. So the GC is split in
// two, and the default path never touches the session:
//
//   * CACHE PRUNE (safe, the default) — deletes only the disposable caches in
//     `CHROMIUM_DISPOSABLE_CACHE_PATHS`. Chromium treats every one of these as
//     evictable (its own quota manager deletes them under disk pressure), so
//     removing them is indistinguishable from a normal browser cache eviction.
//     The session survives: Amazon's auth lives in cookies
//     (`at-main` / `sess-at-main` / `session-id` / `ubid-main`), which sit in
//     `Default/Network/Cookies`, and the key that decrypts them is in the
//     profile-root `Local State`. Both are in
//     `CHROMIUM_SESSION_CRITICAL_PATHS` and MUST never be deleted by a prune.
//     Cost of a prune: the next page load re-downloads static assets. Seconds.
//
//   * FULL EVICTION (forces re-login) — removes the entire profile dir. Only
//     two cases justify it: the account no longer exists in `amazon_accounts`
//     (orphan — nothing to log back in to, zero risk), or the profile has been
//     untouched for `dormantDays`. The dormant window is deliberately long
//     (90 days default): by then Amazon has almost certainly expired the
//     session server-side anyway, so the eviction costs a re-login that was
//     already coming.
//
// Anything ambiguous keeps the profile — reclaiming disk is never worth
// risking a buyer account.

/**
 * Subpaths inside a Chromium `user_data_dir` that hold **disposable cache**
 * and can be deleted without affecting the logged-in session.
 *
 * Every entry is a browser-managed cache that Chromium itself evicts under
 * disk pressure. Paths are relative to the profile root and use forward
 * slashes; the sweeper joins them with `path.join`, so they resolve on Windows
 * too. A path that does not exist is skipped silently.
 *
 * Ordered roughly by how much they grow in practice.
 */
export const CHROMIUM_DISPOSABLE_CACHE_PATHS: readonly string[] = [
  // The main HTTP cache — by far the largest contributor to profile growth.
  'Default/Cache',
  // Compiled JS/WASM bytecode cache. Second largest on a JS-heavy site.
  'Default/Code Cache',
  // Service-worker caches. Amazon registers service workers, and CacheStorage
  // is unbounded-ish. `Service Worker/Database` (the REGISTRATION store) is
  // deliberately NOT listed: dropping only the payload caches is a supported
  // state that Chromium recovers from by re-fetching.
  'Default/Service Worker/CacheStorage',
  'Default/Service Worker/ScriptCache',
  // GPU / shader / graphics caches. Present even headless.
  'Default/GPUCache',
  'Default/DawnGraphiteCache',
  'Default/DawnWebGPUCache',
  'GPUCache',
  'GrShaderCache',
  'ShaderCache',
  'GraphiteDawnCache',
  // Deprecated AppCache + media cache, still emitted by some builds.
  'Default/Application Cache',
  'Default/Media Cache',
  // Transient blob spill-over; only valid while a browser is running, and the
  // sweeper only ever prunes profiles with no live context.
  'Default/blob_storage',
  // Component/extension CRX download caches and crash dumps — pure churn.
  'component_crx_cache',
  'extensions_crx_cache',
  'Crashpad',
] as const;

/**
 * Paths that carry the Amazon session. A cache prune must NEVER remove these —
 * deleting any one of them logs the account out and forces a re-login (with
 * its captcha / OTP risk).
 *
 * This list is not consumed by the prune (which works off an allowlist, the
 * safer direction); it exists so `browser-profile-gc.spec.ts` can assert the
 * two lists never overlap. That guard is the regression test for someone
 * later adding `Default/Network` or `Local State` to the disposable list.
 */
export const CHROMIUM_SESSION_CRITICAL_PATHS: readonly string[] = [
  // Modern cookie store — this is where at-main/sess-at-main/session-id live.
  'Default/Network',
  'Default/Network/Cookies',
  // Legacy cookie store path (older Chromium builds).
  'Default/Cookies',
  // Holds `os_crypt.encrypted_key`, which decrypts the cookie values. Deleting
  // it makes every stored cookie unreadable — a silent logout.
  'Local State',
  // Amazon writes csm/session tokens into localStorage and IndexedDB.
  'Default/Local Storage',
  'Default/Session Storage',
  'Default/IndexedDB',
  // Profile-level prefs, including the per-profile crypto state.
  'Default/Preferences',
  'Default/Secure Preferences',
  'Default/Login Data',
  'Default/Web Data',
] as const;

/** What the GC decided to do with one profile directory. */
export enum BrowserProfileGcAction {
  /** A live Chromium context owns this dir — never touch it. */
  SKIP_LIVE = 'skip_live',
  /** The Amazon account no longer exists — delete the whole profile. */
  PURGE_ORPHAN = 'purge_orphan',
  /** Untouched past the dormant window — delete the whole profile (re-login). */
  EVICT_DORMANT = 'evict_dormant',
  /** Delete only the disposable caches; the session survives. */
  PRUNE_CACHE = 'prune_cache',
}

/** Resolved GC tuning. All durations in days. */
export interface BrowserProfileGcConfig {
  /** Master switch. When false the sweep does not run at all. */
  enabled: boolean;
  /**
   * Delete the whole profile after this many days without use. Long by
   * design — a full eviction costs a re-login. 0 disables dormant eviction
   * entirely (orphan purge and cache prune still run).
   */
  dormantDays: number;
  /**
   * Remove profile dirs whose account is gone from `amazon_accounts`.
   * Separately switchable because it is the only destructive action that can
   * never cost a re-login, so it is safe to leave on even when dormant
   * eviction is disabled.
   */
  purgeOrphans: boolean;
}

export const BROWSER_PROFILE_GC_DEFAULTS = {
  /** Long enough that Amazon has usually expired the session server-side. */
  dormantDays: 90,
  /** Refuse absurd values rather than silently evicting live accounts. */
  minDormantDays: 7,
  maxDormantDays: 3650,
} as const;

/** Inputs for a single profile-directory decision. */
export interface ProfileGcInput {
  /** Whether this process currently holds an open Chromium context for it. */
  isLive: boolean;
  /** Whether the directory name still matches a row in `amazon_accounts`. */
  isKnownAccount: boolean;
  /**
   * Most recent activity for the profile, epoch ms. The sweeper passes the
   * newest of (in-memory last-touch, profile dir mtime) so a restart does not
   * make every profile look dormant.
   */
  lastActiveAtMs: number;
  /** Current time, epoch ms — injected so tests are deterministic. */
  nowMs: number;
  config: BrowserProfileGcConfig;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Decide what to do with one profile directory.
 *
 * Precedence is load-bearing and ordered by risk, safest guard first:
 *   1. A live context always wins — evicting a dir out from under a running
 *      Chromium corrupts the profile and can crash an in-flight checkout.
 *   2. Orphan purge — the account is gone, so there is no session to lose.
 *   3. Dormant eviction — the only branch that can cost a re-login.
 *   4. Cache prune — the default for everything still in use.
 *
 * Never returns "do nothing": every non-live, known, non-dormant profile gets
 * its cache pruned. That is what makes the growth bounded. An account scraped
 * every few hours therefore loses its HTTP cache about once per sweep, which
 * costs seconds on the next page load and is the entire point.
 */
export function decideProfileAction(input: ProfileGcInput): BrowserProfileGcAction {
  const { isLive, isKnownAccount, lastActiveAtMs, nowMs, config } = input;

  if (isLive) {
    return BrowserProfileGcAction.SKIP_LIVE;
  }
  if (!isKnownAccount && config.purgeOrphans) {
    return BrowserProfileGcAction.PURGE_ORPHAN;
  }
  if (config.dormantDays > 0 && isKnownAccount) {
    const idleMs = nowMs - lastActiveAtMs;
    if (idleMs > config.dormantDays * MS_PER_DAY) {
      return BrowserProfileGcAction.EVICT_DORMANT;
    }
  }
  return BrowserProfileGcAction.PRUNE_CACHE;
}

/**
 * Parse + clamp GC config from raw env/settings strings.
 *
 * A typo must never widen the blast radius, so an unparseable dormant window
 * falls back to the default rather than to 0 (which would mean "evict
 * nothing" — safe but silently useless) or to a tiny number (which would mean
 * "evict everything" — a mass re-login event).
 */
export function resolveBrowserProfileGcConfig(raw: {
  enabled?: string | boolean | null;
  dormantDays?: string | number | null;
  purgeOrphans?: string | boolean | null;
}): BrowserProfileGcConfig {
  return {
    enabled: coerceFlag(raw.enabled, true),
    purgeOrphans: coerceFlag(raw.purgeOrphans, true),
    dormantDays: coerceDormantDays(raw.dormantDays),
  };
}

function coerceFlag(value: string | boolean | null | undefined, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }
  return fallback;
}

function coerceDormantDays(value: string | number | null | undefined): number {
  const { dormantDays, minDormantDays, maxDormantDays } = BROWSER_PROFILE_GC_DEFAULTS;
  if (value === undefined || value === null || value === '') {
    return dormantDays;
  }
  const parsed = typeof value === 'number' ? value : Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed)) {
    return dormantDays;
  }
  // 0 is an explicit, meaningful choice: disable dormant eviction.
  if (parsed === 0) {
    return 0;
  }
  if (parsed < minDormantDays) {
    return minDormantDays;
  }
  if (parsed > maxDormantDays) {
    return maxDormantDays;
  }
  return Math.floor(parsed);
}

/** Human-readable byte size for log lines. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
