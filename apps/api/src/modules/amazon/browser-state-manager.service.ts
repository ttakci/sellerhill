import * as fs from 'fs';
import * as path from 'path';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
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
export class BrowserStateManager implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserStateManager.name);
  private readonly stateDir: string;
  private readonly profilesDir: string;
  private activeContexts = new Map<string, BrowserContext>();

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly proxyService: ProxyService,
  ) {
    this.stateDir = this.configService.get<string>('BROWSER_STATE_DIR')
      || path.resolve(process.cwd(), '.browser-state');
    this.profilesDir = path.join(this.stateDir, 'profiles');

    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
    if (!fs.existsSync(this.profilesDir)) {
      fs.mkdirSync(this.profilesDir, { recursive: true });
    }
  }

  async onModuleDestroy() {
    await this.closeAll();
  }

  async getContext(amazonAccountId: string): Promise<BrowserContext> {
    if (this.activeContexts.has(amazonAccountId)) {
      const cached = this.activeContexts.get(amazonAccountId)!;
      // Persistent contexts own their Browser; `browser()` returns null once
      // closed. Re-launch only if the underlying browser is gone/disconnected.
      const browser = cached.browser();
      if (browser && browser.isConnected()) {
        return cached;
      }
      this.activeContexts.delete(amazonAccountId);
    }

    const profileDir = this.getProfileDir(amazonAccountId);
    await fs.promises.mkdir(profileDir, { recursive: true });

    const proxy = await this.resolveProxy(amazonAccountId);
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
    this.activeContexts.set(amazonAccountId, context);
    return context;
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
    for (const [id] of this.activeContexts) {
      await this.releaseContext(id);
    }
  }

  private async resolveProxy(
    amazonAccountId: string,
  ): Promise<{ server: string; username: string; password: string } | null> {
    if (!this.proxyService.isConfigured()) {return null;}
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
      return this.proxyService.resolve(rows[0].user_id, amazonAccountId);
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
