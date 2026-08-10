// apps/api/src/modules/amazon/browser-profile-gc.spec.ts
//
// The load-bearing test here is `does not overlap session-critical paths`.
// Everything else in the GC is recoverable; deleting a session file is not —
// it logs an Amazon buyer account out and the re-login can hit a captcha/OTP
// that takes the account out of service.

import {
  BROWSER_PROFILE_GC_DEFAULTS,
  BrowserProfileGcAction,
  CHROMIUM_DISPOSABLE_CACHE_PATHS,
  CHROMIUM_SESSION_CRITICAL_PATHS,
  decideProfileAction,
  formatBytes,
  resolveBrowserProfileGcConfig,
  type BrowserProfileGcConfig,
} from './browser-profile-gc';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-08-10T12:00:00.000Z');

const config = (over: Partial<BrowserProfileGcConfig> = {}): BrowserProfileGcConfig => ({
  enabled: true,
  dormantDays: 90,
  purgeOrphans: true,
  ...over,
});

const daysAgo = (days: number): number => NOW - days * MS_PER_DAY;

describe('CHROMIUM_DISPOSABLE_CACHE_PATHS', () => {
  it('never overlaps a session-critical path', () => {
    // A prune deletes a directory recursively, so an entry is unsafe if it IS
    // a session path or is an ANCESTOR of one. `Default/Network` being listed
    // as disposable, for example, would take `Default/Network/Cookies` with it.
    for (const disposable of CHROMIUM_DISPOSABLE_CACHE_PATHS) {
      for (const critical of CHROMIUM_SESSION_CRITICAL_PATHS) {
        expect(disposable).not.toBe(critical);
        expect(critical.startsWith(`${disposable}/`)).toBe(false);
      }
    }
  });

  it('keeps the service-worker registration store while dropping its payload caches', () => {
    // Dropping CacheStorage/ScriptCache is a state Chromium recovers from by
    // re-fetching. Dropping `Service Worker/Database` too has no disk payoff
    // and widens the blast radius for no reason.
    expect(CHROMIUM_DISPOSABLE_CACHE_PATHS).toContain('Default/Service Worker/CacheStorage');
    expect(CHROMIUM_DISPOSABLE_CACHE_PATHS).not.toContain('Default/Service Worker/Database');
    expect(CHROMIUM_DISPOSABLE_CACHE_PATHS).not.toContain('Default/Service Worker');
  });

  it('uses forward-slash relative paths only (never absolute, never traversing up)', () => {
    for (const entry of CHROMIUM_DISPOSABLE_CACHE_PATHS) {
      expect(entry.startsWith('/')).toBe(false);
      expect(entry).not.toMatch(/^[A-Za-z]:/);
      expect(entry.split('/')).not.toContain('..');
      expect(entry).not.toContain('\\');
    }
  });

  it('lists the HTTP cache, which is the largest contributor to growth', () => {
    expect(CHROMIUM_DISPOSABLE_CACHE_PATHS).toContain('Default/Cache');
    expect(CHROMIUM_DISPOSABLE_CACHE_PATHS).toContain('Default/Code Cache');
  });
});

describe('decideProfileAction', () => {
  it('never touches a profile with a live context, whatever else is true', () => {
    // Highest-precedence guard: removing files under a running Chromium
    // corrupts the profile and can crash an in-flight checkout.
    const action = decideProfileAction({
      isLive: true,
      isKnownAccount: false,
      lastActiveAtMs: daysAgo(400),
      nowMs: NOW,
      config: config(),
    });
    expect(action).toBe(BrowserProfileGcAction.SKIP_LIVE);
  });

  it('purges a profile whose Amazon account no longer exists', () => {
    const action = decideProfileAction({
      isLive: false,
      isKnownAccount: false,
      lastActiveAtMs: daysAgo(1),
      nowMs: NOW,
      config: config(),
    });
    expect(action).toBe(BrowserProfileGcAction.PURGE_ORPHAN);
  });

  it('prunes cache instead of purging an orphan when orphan purge is disabled', () => {
    const action = decideProfileAction({
      isLive: false,
      isKnownAccount: false,
      lastActiveAtMs: daysAgo(1),
      nowMs: NOW,
      config: config({ purgeOrphans: false }),
    });
    expect(action).toBe(BrowserProfileGcAction.PRUNE_CACHE);
  });

  it('evicts a known account only after the dormant window has fully elapsed', () => {
    const base = { isLive: false, isKnownAccount: true, nowMs: NOW, config: config() };
    expect(decideProfileAction({ ...base, lastActiveAtMs: daysAgo(91) })).toBe(
      BrowserProfileGcAction.EVICT_DORMANT,
    );
    // Exactly at the boundary is NOT dormant — the comparison is strict, so a
    // rounding wobble can never trigger an unnecessary re-login.
    expect(decideProfileAction({ ...base, lastActiveAtMs: daysAgo(90) })).toBe(
      BrowserProfileGcAction.PRUNE_CACHE,
    );
    expect(decideProfileAction({ ...base, lastActiveAtMs: daysAgo(89) })).toBe(
      BrowserProfileGcAction.PRUNE_CACHE,
    );
  });

  it('never evicts a dormant profile when dormantDays is 0 (eviction disabled)', () => {
    const action = decideProfileAction({
      isLive: false,
      isKnownAccount: true,
      lastActiveAtMs: daysAgo(5000),
      nowMs: NOW,
      config: config({ dormantDays: 0 }),
    });
    expect(action).toBe(BrowserProfileGcAction.PRUNE_CACHE);
  });

  it('prunes the cache of an actively used profile — this is what bounds growth', () => {
    const action = decideProfileAction({
      isLive: false,
      isKnownAccount: true,
      lastActiveAtMs: NOW - 60_000,
      nowMs: NOW,
      config: config(),
    });
    expect(action).toBe(BrowserProfileGcAction.PRUNE_CACHE);
  });
});

describe('resolveBrowserProfileGcConfig', () => {
  it('defaults to enabled with orphan purge on and the default dormant window', () => {
    expect(resolveBrowserProfileGcConfig({})).toEqual({
      enabled: true,
      purgeOrphans: true,
      dormantDays: BROWSER_PROFILE_GC_DEFAULTS.dormantDays,
    });
  });

  it('falls back to the default dormant window on an unparseable value', () => {
    // Not to a small number: a typo must never cause a mass re-login event.
    expect(resolveBrowserProfileGcConfig({ dormantDays: 'soon' }).dormantDays).toBe(
      BROWSER_PROFILE_GC_DEFAULTS.dormantDays,
    );
    expect(resolveBrowserProfileGcConfig({ dormantDays: '' }).dormantDays).toBe(
      BROWSER_PROFILE_GC_DEFAULTS.dormantDays,
    );
  });

  it('clamps a dangerously short dormant window up to the floor', () => {
    expect(resolveBrowserProfileGcConfig({ dormantDays: 1 }).dormantDays).toBe(
      BROWSER_PROFILE_GC_DEFAULTS.minDormantDays,
    );
    expect(resolveBrowserProfileGcConfig({ dormantDays: -30 }).dormantDays).toBe(
      BROWSER_PROFILE_GC_DEFAULTS.minDormantDays,
    );
  });

  it('clamps an absurdly long window down to the ceiling', () => {
    expect(resolveBrowserProfileGcConfig({ dormantDays: 99999 }).dormantDays).toBe(
      BROWSER_PROFILE_GC_DEFAULTS.maxDormantDays,
    );
  });

  it('treats 0 as the explicit "disable dormant eviction" choice, not as invalid', () => {
    expect(resolveBrowserProfileGcConfig({ dormantDays: 0 }).dormantDays).toBe(0);
    expect(resolveBrowserProfileGcConfig({ dormantDays: '0' }).dormantDays).toBe(0);
  });

  it('accepts string and boolean flags', () => {
    expect(resolveBrowserProfileGcConfig({ enabled: 'false' }).enabled).toBe(false);
    expect(resolveBrowserProfileGcConfig({ enabled: false }).enabled).toBe(false);
    expect(resolveBrowserProfileGcConfig({ enabled: '0' }).enabled).toBe(false);
    expect(resolveBrowserProfileGcConfig({ purgeOrphans: 'false' }).purgeOrphans).toBe(false);
    // An unrecognised string keeps the safe default rather than guessing.
    expect(resolveBrowserProfileGcConfig({ enabled: 'maybe' }).enabled).toBe(true);
  });

  it('floors a fractional dormant window', () => {
    expect(resolveBrowserProfileGcConfig({ dormantDays: 90.9 }).dormantDays).toBe(90);
  });
});

describe('formatBytes', () => {
  it('renders zero and negatives as 0 B', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });

  it('scales through the unit table', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });
});
