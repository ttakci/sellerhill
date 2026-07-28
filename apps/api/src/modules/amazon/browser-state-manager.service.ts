import * as fs from 'fs';
import * as path from 'path';

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BrowserContext } from 'playwright';

import { DatabaseService } from '../../common/database/database.service';

import { ProxyService } from './proxy.service';

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
];

interface Fingerprint {
  userAgent: string;
  viewport: { width: number; height: number };
  timezoneId: string;
}

/**
 * Shape of the pre-persistent storageState JSON written by the legacy
 * `storageState`-only BrowserStateManager (pre-Task-4). Used for one-shot
 * cookie migration into the new persistent user_data_dir. Only `cookies` is
 * consumed — Amazon session state is cookie-only; localStorage is intentionally
 * not migrated.
 */
interface LegacyStorageState {
  cookies: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
  origins?: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

/**
 * Per-account persistent browser-context manager.
 *
 * Each Amazon buyer account gets its own `user_data_dir` under
 * `${BROWSER_STATE_DIR}/profiles/${accountId}/` (cookies + localStorage + cache
 * survive across runs) and its own deterministic fingerprint (UA / viewport /
 * timezone from `hashCode(accountId)`). Contexts are launched via
 * `playwright-extra`'s chromium + stealth plugin.
 *
 * Proxy-aware: when `ProxyService` is configured (env), each context launches
 * with the injected residential proxy (sticky session per Zonds user by
 * default). When proxy env is absent, the `proxy` option is omitted entirely —
 * network behavior is identical to a direct connection (no scraping regression).
 *
 * Public method signatures are preserved so existing callers
 * (AmazonScrapingService etc.) do not break.
 */
@Injectable()
export class BrowserStateManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BrowserStateManager.name);
  private readonly stateDir: string;
  private readonly profilesDir: string;
  private readonly idleTtl: number;
  private readonly sweepInterval: number;
  private activeContexts = new Map<string, BrowserContext>();
  // Last-touch timestamp (ms) per account — refreshed on every getContext hit.
  // Used by `evictIdle` alongside the zero-page guard to decide which cached
  // contexts can be safely closed to bound resident Chromium memory.
  private readonly lastUsedAt = new Map<string, number>();
  // Whether the LIVE context for an account was actually launched THROUGH the
  // proxy (set at launch time, retained for the context's lifetime). Reflects
  // launch reality, not a prediction: `resolveProxy` returns null on a DB error
  // or missing-account and the context then launches DIRECT. Auto-fulfill
  // checkout asserts this (via `isProxyActive`) so it can fail closed with
  // `proxy_required` instead of clicking Place Order over the bare server IP.
  private readonly proxyActiveFor = new Map<string, boolean>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly proxyService: ProxyService,
  ) {
    this.stateDir = this.configService.get<string>('BROWSER_STATE_DIR')
      || path.resolve(process.cwd(), '.browser-state');
    this.profilesDir = path.join(this.stateDir, 'profiles');

    // Each persistent context owns a Chromium process (~150-300MB RSS). To
    // bound resident memory at scale (many accounts), zero-page idle contexts
    // are evicted by a periodic sweep. Defaults: a context must have zero open
    // pages AND be untouched for 10 min before it is eligible; sweep runs every
    // 2 min. Both guards are required — see `evictIdle`.
    this.idleTtl = this.parsePositiveInt(
      this.configService.get<string>('BROWSER_CONTEXT_IDLE_TTL_MS'),
      600_000,
      'BROWSER_CONTEXT_IDLE_TTL_MS',
    );
    this.sweepInterval = this.parsePositiveInt(
      this.configService.get<string>('BROWSER_CONTEXT_SWEEP_INTERVAL_MS'),
      120_000,
      'BROWSER_CONTEXT_SWEEP_INTERVAL_MS',
    );

    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
    if (!fs.existsSync(this.profilesDir)) {
      fs.mkdirSync(this.profilesDir, { recursive: true });
    }
  }

  onModuleInit() {
    // Start the idle-context sweep. `setInterval` is fine here — Node keeps the
    // event loop alive only while the API is up; `onModuleDestroy` clears it.
    this.sweepTimer = setInterval(() => {
      void this.evictIdle();
    }, this.sweepInterval);
  }

  async onModuleDestroy() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    await this.closeAll();
  }

  /**
   * Periodic sweep that closes cached contexts which are PROVABLY idle:
   *   1. `context.pages()` returns length === 0 (no operation is using it —
   *      any in-flight scrape/checkout holds ≥1 page on its context), AND
   *   2. untouched for longer than `idleTtl`.
   *
   * Safety relies on `AmazonRateLimiter`'s per-account 1-concurrent contract:
   * if a context has zero open pages, no operation is mid-flight on it, so
   * closing it cannot crash another account's work. The `pages.length === 0`
   * guard is non-negotiable — never evict a context with open pages even if
   * the idle TTL has elapsed.
   *
   * Never throws — per-account failures are isolated so one bad context
   * doesn't kill the sweep.
   */
  private async evictIdle(): Promise<void> {
    for (const [accountId, context] of this.activeContexts) {
      try {
        // Playwright's pages() is sync — do not await (lint: await-thenable).
        const pages = context.pages();
        if (pages.length > 0) {
          continue;
        }
        const lastUsed = this.lastUsedAt.get(accountId) ?? 0;
        const idleFor = Date.now() - lastUsed;
        if (idleFor <= this.idleTtl) {
          continue;
        }
        await context.close();
        this.activeContexts.delete(accountId);
        this.lastUsedAt.delete(accountId);
        this.logger.log(
          `Evicted idle browser context for account ${accountId} (unused for ${idleFor}ms, no open pages).`,
        );
      } catch (err) {
        this.logger.warn(
          `Idle-context sweep failed for account ${accountId}: ${(err as Error).message}`,
        );
      }
    }
  }

  private parsePositiveInt(
    raw: string | undefined,
    fallback: number,
    envName: string,
  ): number {
    if (raw === undefined || raw === '') {return fallback;}
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      this.logger.warn(
        `Invalid ${envName}="${raw}" — falling back to ${fallback}.`,
      );
      return fallback;
    }
    return parsed;
  }

  // INVARIANT: callers must go through `AmazonRateLimiter.schedule(accountId, …)`
  // (per-account 1-concurrent) so two `launchPersistentContext` calls never
  // race on the same user_data_dir `SingletonLock`. Auto-fulfill checkout
  // (Task 6) must reuse the same rate limiter — do not call `getContext` directly.
  async getContext(amazonAccountId: string): Promise<BrowserContext> {
    if (this.activeContexts.has(amazonAccountId)) {
      const cached = this.activeContexts.get(amazonAccountId)!;
      // Persistent contexts own their Browser; `browser()` returns null once
      // closed. Re-launch only if the underlying browser is gone/disconnected.
      const browser = cached.browser();
      if (browser && browser.isConnected()) {
        this.lastUsedAt.set(amazonAccountId, Date.now());
        return cached;
      }
      this.activeContexts.delete(amazonAccountId);
      this.proxyActiveFor.delete(amazonAccountId);
    }

    const profileDir = this.getProfileDir(amazonAccountId);
    // First launch for this account = profile dir does NOT yet exist. Only on
    // first launch do we attempt a one-shot migration from the legacy
    // storageState JSON. Re-running migration once the dir exists would
    // clobber the persistent profile with stale cookies. The legacy file is
    // left in place — `clearState` already cleans it; never unlink on the
    // happy path (in case migration is partial and we need to retry).
    const isFirstLaunch = !fs.existsSync(profileDir);
    const legacyStateFile = this.getStateFilePath(amazonAccountId);
    const hasLegacyState = isFirstLaunch && fs.existsSync(legacyStateFile);

    await fs.promises.mkdir(profileDir, { recursive: true });

    const proxy = await this.resolveProxy(amazonAccountId);
    // Record launch truth BEFORE the launch — if launch throws, the flag still
    // reflects the resolved intent (and is cleaned up if the context never lands
    // in activeContexts, since callers treat launch failure as no-context).
    this.proxyActiveFor.set(amazonAccountId, proxy !== null);
    const fingerprint = this.getFingerprint(amazonAccountId);

    const playwrightExtra = await import('playwright-extra');
    const chromium = playwrightExtra.chromium;
    const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
    chromium.use(StealthPlugin());

    const launchOptions: Parameters<typeof chromium.launchPersistentContext>[1] = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
      userAgent: fingerprint.userAgent,
      viewport: fingerprint.viewport,
      locale: 'en-US',
      timezoneId: fingerprint.timezoneId,
    };

    if (proxy) {
      launchOptions.proxy = proxy;
      this.logger.debug(
        `Launching persistent context for account ${amazonAccountId} via proxy ${proxy.server}`,
      );
    }

    const context = await chromium.launchPersistentContext(profileDir, launchOptions);

    // One-shot legacy session migration. NOTE: Playwright 1.59's
    // `launchPersistentContext` does NOT accept a `storageState` option in its
    // launch params (verified from playwright-core types — it would also race
    // with the user_data_dir's own cookie store). The supported pattern is to
    // import via `context.addCookies` after launch. Only cookies are migrated —
    // Amazon's session-bearing state (`at-main`/`sess-at-main`/`session-id`/
    // `ubid-main`) is cookie-only; localStorage is intentionally not migrated.
    if (hasLegacyState) {
      await this.migrateLegacyStorageState(amazonAccountId, context, legacyStateFile);
    }

    this.activeContexts.set(amazonAccountId, context);
    this.lastUsedAt.set(amazonAccountId, Date.now());
    return context;
  }

  /**
   * Best-effort migration of a pre-persistent storageState JSON (cookies only)
   * into a freshly-launched persistent context. Failures are logged and
   * swallowed — the user simply re-logs in if migration misses.
   */
  private async migrateLegacyStorageState(
    amazonAccountId: string,
    context: BrowserContext,
    legacyStateFile: string,
  ): Promise<void> {
    try {
      const raw = await fs.promises.readFile(legacyStateFile, 'utf8');
      const parsed = JSON.parse(raw) as LegacyStorageState;
      if (Array.isArray(parsed.cookies) && parsed.cookies.length > 0) {
        await context.addCookies(parsed.cookies);
        this.logger.log(
          `Migrated ${parsed.cookies.length} cookies from legacy state for account ${amazonAccountId} into ${this.getProfileDir(amazonAccountId)}.`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Legacy storageState migration failed for account ${amazonAccountId} (${(err as Error).message}) — continuing with a fresh session.`,
      );
    }
  }

  /**
   * Persistent contexts write cookies/localStorage to the user_data_dir
   * continuously, so this is a no-op for state persistence. Kept for back-compat
   * with existing callers; ensures the profile dir exists.
   */
  async saveState(amazonAccountId: string): Promise<void> {
    const profileDir = this.getProfileDir(amazonAccountId);
    if (!fs.existsSync(profileDir)) {
      try {
        await fs.promises.mkdir(profileDir, { recursive: true });
      } catch {
        // best-effort
      }
    }
  }

  async releaseContext(amazonAccountId: string): Promise<void> {
    const context = this.activeContexts.get(amazonAccountId);
    if (!context) {return;}

    try {
      // Persistent context flushes to disk on close — no explicit saveState needed.
      await context.close();
    } catch {
      this.logger.warn(`Failed to close persistent context for account ${amazonAccountId}`);
    }
    this.activeContexts.delete(amazonAccountId);
    this.lastUsedAt.delete(amazonAccountId);
    this.proxyActiveFor.delete(amazonAccountId);
  }

  /**
   * Whether the LIVE context for `amazonAccountId` was launched through the
   * proxy. Reflects actual launch truth (set in `getContext`), retained for the
   * context's lifetime so cache-hit reuses report the original launch. Returns
   * `false` when unknown (no live context / launched before tracking) — callers
   * that require a proxy (auto-fulfill checkout) must treat `false` as
   * "not proven proxied" and fail closed.
   */
  isProxyActive(amazonAccountId: string): boolean {
    return this.proxyActiveFor.get(amazonAccountId) ?? false;
  }

  async isSessionValid(amazonAccountId: string): Promise<boolean> {
    // With persistent contexts the cookie state lives in the user_data_dir, not
    // a JSON storageState file. A profile dir that exists is a candidate for a
    // valid session — the only definitive check is a navigation to Amazon that
    // does not redirect to /signin.
    const profileDir = this.getProfileDir(amazonAccountId);
    if (!fs.existsSync(profileDir)) {return false;}

    try {
      const context = await this.getContext(amazonAccountId);
      const page = await context.newPage();
      try {
        await page.goto('https://www.amazon.com/gp/css/homepage.html', {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        const url = page.url();
        const isValid = !url.includes('/signin') && !url.includes('/ap/signin');
        return isValid;
      } finally {
        await page.close();
      }
    } catch {
      return false;
    }
  }

  async clearState(amazonAccountId: string): Promise<void> {
    // Close the live context first so no file handle holds the profile dir.
    await this.releaseContext(amazonAccountId);

    const profileDir = this.getProfileDir(amazonAccountId);
    if (fs.existsSync(profileDir)) {
      try {
        await fs.promises.rm(profileDir, { recursive: true, force: true });
      } catch {
        this.logger.warn(`Failed to remove profile dir for account ${amazonAccountId}`);
      }
    }

    // Legacy .json storageState files (pre-persistent) — remove if present.
    const stateFile = this.getStateFilePath(amazonAccountId);
    if (fs.existsSync(stateFile)) {
      try {
        fs.unlinkSync(stateFile);
      } catch {
        // best-effort
      }
    }
  }

  async closeAll(): Promise<void> {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    for (const [id] of this.activeContexts) {
      await this.releaseContext(id);
    }
    this.lastUsedAt.clear();
    this.proxyActiveFor.clear();
  }

  private async resolveProxy(
    amazonAccountId: string,
  ): Promise<{ server: string; username: string; password: string } | null> {
    if (!(await this.proxyService.isConfigured())) {return null;}
    try {
      const rows = await this.databaseService.query<{ user_id: string }>(
        'SELECT user_id FROM amazon_accounts WHERE id = $1',
        [amazonAccountId],
      );
      if (rows.length === 0) {
        this.logger.warn(
          `Amazon account ${amazonAccountId} not found — launching direct (no proxy).`,
        );
        return null;
      }
      return await this.proxyService.resolve(rows[0].user_id, amazonAccountId);
    } catch (err) {
      this.logger.warn(
        `Proxy resolution failed for account ${amazonAccountId}: ${(err as Error).message} — launching direct.`,
      );
      return null;
    }
  }

  private getProfileDir(amazonAccountId: string): string {
    return path.join(this.profilesDir, amazonAccountId);
  }

  private getStateFilePath(amazonAccountId: string): string {
    return path.join(this.stateDir, `${amazonAccountId}.json`);
  }

  private getFingerprint(amazonAccountId: string): Fingerprint {
    const hash = this.hashCode(amazonAccountId);
    return {
      userAgent: USER_AGENTS[Math.abs(hash) % USER_AGENTS.length],
      viewport: VIEWPORTS[Math.abs(hash >> 4) % VIEWPORTS.length],
      timezoneId: TIMEZONES[Math.abs(hash >> 8) % TIMEZONES.length],
    };
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash;
  }
}
