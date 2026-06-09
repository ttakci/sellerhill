import * as fs from 'fs';
import * as path from 'path';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Browser, BrowserContext } from 'playwright';

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

@Injectable()
export class BrowserStateManager implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserStateManager.name);
  private readonly stateDir: string;
  private browser: Browser | null = null;
  private activeContexts = new Map<string, BrowserContext>();

  constructor(private readonly configService: ConfigService) {
    this.stateDir = this.configService.get<string>('BROWSER_STATE_DIR')
      || path.resolve(process.cwd(), '.browser-state');

    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
  }

  async onModuleDestroy() {
    await this.closeAll();
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      const playwrightExtra = await import('playwright-extra');
      const chromium = playwrightExtra.chromium;
      const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
      chromium.use(StealthPlugin());

      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
      });
    }
    return this.browser;
  }

  async getContext(amazonAccountId: string): Promise<BrowserContext> {
    if (this.activeContexts.has(amazonAccountId)) {
      const ctx = this.activeContexts.get(amazonAccountId)!;
      if (!ctx.pages().length || !ctx.browser()?.isConnected()) {
        this.activeContexts.delete(amazonAccountId);
      } else {
        return ctx;
      }
    }

    const browser = await this.getBrowser();
    const stateFile = this.getStateFilePath(amazonAccountId);
    const fingerprint = this.getFingerprint(amazonAccountId);

    const contextOptions: Record<string, unknown> = {
      userAgent: fingerprint.userAgent,
      viewport: fingerprint.viewport,
      locale: 'en-US',
      timezoneId: fingerprint.timezoneId,
    };

    if (fs.existsSync(stateFile)) {
      contextOptions.storageState = stateFile;
    }

    const context = await browser.newContext(contextOptions);
    this.activeContexts.set(amazonAccountId, context);

    return context;
  }

  async saveState(amazonAccountId: string): Promise<void> {
    const context = this.activeContexts.get(amazonAccountId);
    if (!context) {return;}

    const stateFile = this.getStateFilePath(amazonAccountId);
    const dir = path.dirname(stateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await context.storageState({ path: stateFile });
    this.logger.debug(`Saved browser state for account ${amazonAccountId}`);
  }

  async releaseContext(amazonAccountId: string): Promise<void> {
    const context = this.activeContexts.get(amazonAccountId);
    if (!context) {return;}

    try {
      await this.saveState(amazonAccountId);
    } catch {
      this.logger.warn(`Failed to save state for account ${amazonAccountId}`);
    }

    await context.close().catch(() => {});
    this.activeContexts.delete(amazonAccountId);
  }

  async isSessionValid(amazonAccountId: string): Promise<boolean> {
    const stateFile = this.getStateFilePath(amazonAccountId);
    if (!fs.existsSync(stateFile)) {return false;}

    try {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as { cookies?: Array<{ expires: number }> };
      const now = Date.now() / 1000;
      const hasValidCookies = state.cookies?.some(
        (c) => c.expires === -1 || c.expires === 0 || c.expires > now
      );
      if (!hasValidCookies) {return false;}

      // Validate by navigating to Amazon
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
    const stateFile = this.getStateFilePath(amazonAccountId);
    if (fs.existsSync(stateFile)) {
      fs.unlinkSync(stateFile);
    }
    await this.releaseContext(amazonAccountId);
  }

  async closeAll(): Promise<void> {
    for (const [id] of this.activeContexts) {
      await this.releaseContext(id);
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
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
