// apps/api/src/modules/amazon/browser-profile-gc.service.ts
//
// Disk garbage collector for the per-account Chromium profiles that
// `BrowserStateManager` creates under `${BROWSER_STATE_DIR}/profiles/`.
//
// `BrowserStateManager.evictIdle` bounds resident MEMORY by closing idle
// Chromium processes; nothing bounded DISK. A profile grows without limit
// (HTTP cache, code cache, service-worker CacheStorage, GPU/shader caches) and
// a deleted Amazon account left its profile behind forever — at 500 accounts
// that is 50–250 GB nothing reclaims. This service is the missing half.
//
// All policy lives in the pure `browser-profile-gc.ts` module (unit-tested,
// including the guard that a cache prune can never delete a session file).
// This file is the fs + scheduling shell around it.
//
// SAFETY — three properties, each of which was a way to break a buyer account:
//   1. Every mutation runs inside `AmazonRateLimiter.schedule(accountId, …)`,
//      the same per-account 1-concurrent lock every browser action uses. That
//      is what makes "no live context" safe to act on: a launch cannot start
//      while we are deleting, and we cannot start while a launch is running.
//   2. A failed `amazon_accounts` read ABORTS the sweep. Treating a DB outage
//      as "no accounts exist" would purge all 500 profiles as orphans.
//   3. The default action is a cache prune, which preserves the Amazon login.
//      Full eviction (which forces a re-login, with its captcha/OTP risk) only
//      happens for accounts that no longer exist or have been dormant for
//      months.

import * as fs from 'fs';
import * as path from 'path';

import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PlatformSettingKey } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import { AmazonRateLimiter } from './amazon-rate-limiter.service';
import {
  BrowserProfileGcAction,
  CHROMIUM_DISPOSABLE_CACHE_PATHS,
  decideProfileAction,
  formatBytes,
  resolveBrowserProfileGcConfig,
  type BrowserProfileGcConfig,
} from './browser-profile-gc';
import { BrowserStateManager } from './browser-state-manager.service';

/** How often the sweep runs. Daily — a prune costs the next page load a cache miss. */
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Delay before the first sweep after boot. Long enough to stay out of the way
 * of startup work (migrations, scheduler reconciliation), short enough that a
 * process which restarts more often than daily still gets swept.
 */
const INITIAL_SWEEP_DELAY_MS = 10 * 60 * 1000;

/** Outcome counters for one sweep, logged as a single summary line. */
interface SweepSummary {
  scanned: number;
  skippedLive: number;
  pruned: number;
  purgedOrphans: number;
  evictedDormant: number;
  failed: number;
  reclaimedBytes: number;
}

@Injectable()
export class BrowserProfileGcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BrowserProfileGcService.name);
  private sweepTimer: NodeJS.Timeout | null = null;
  private bootTimer: NodeJS.Timeout | null = null;
  /** Guards against a slow sweep overlapping the next tick. */
  private sweeping = false;

  constructor(
    private readonly browserState: BrowserStateManager,
    private readonly rateLimiter: AmazonRateLimiter,
    private readonly databaseService: DatabaseService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  onModuleInit(): void {
    this.bootTimer = setTimeout(() => {
      void this.sweep();
    }, INITIAL_SWEEP_DELAY_MS);
    this.sweepTimer = setInterval(() => {
      void this.sweep();
    }, SWEEP_INTERVAL_MS);
    this.logger.log(
      `Browser profile GC scheduled: first sweep in ${INITIAL_SWEEP_DELAY_MS / 60000}min, then every ${SWEEP_INTERVAL_MS / 3_600_000}h.`,
    );
  }

  onModuleDestroy(): void {
    if (this.bootTimer) {
      clearTimeout(this.bootTimer);
      this.bootTimer = null;
    }
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  /**
   * Run one full sweep over every profile directory.
   *
   * Never throws — this is disk hygiene, and a GC failure must never take down
   * scraping or checkout. Public so an operator script can invoke it directly.
   */
  async sweep(): Promise<SweepSummary> {
    const empty: SweepSummary = {
      scanned: 0,
      skippedLive: 0,
      pruned: 0,
      purgedOrphans: 0,
      evictedDormant: 0,
      failed: 0,
      reclaimedBytes: 0,
    };

    if (this.sweeping) {
      this.logger.warn('Browser profile GC sweep already in progress — skipping this tick.');
      return empty;
    }
    this.sweeping = true;
    try {
      return await this.runSweep(empty);
    } catch (err) {
      this.logger.error(`Browser profile GC sweep failed: ${(err as Error).message}`);
      return empty;
    } finally {
      this.sweeping = false;
    }
  }

  private async runSweep(summary: SweepSummary): Promise<SweepSummary> {
    const config = await this.resolveConfig();
    if (!config.enabled) {
      this.logger.debug('Browser profile GC disabled — skipping sweep.');
      return summary;
    }

    const profilesRoot = this.browserState.getProfilesRoot();
    let entries: string[];
    try {
      entries = await fs.promises.readdir(profilesRoot);
    } catch {
      // Directory does not exist yet (no account has ever been opened).
      return summary;
    }
    if (entries.length === 0) {
      return summary;
    }

    // SAFETY 2: a DB failure must abort. `knownAccountIds` drives the orphan
    // branch, and an empty set from a failed query would purge every profile.
    const knownAccountIds = await this.loadKnownAccountIds();
    if (knownAccountIds === null) {
      this.logger.warn(
        'Browser profile GC: could not read amazon_accounts — aborting sweep rather than risk purging live profiles as orphans.',
      );
      return summary;
    }

    const now = Date.now();
    for (const accountId of entries) {
      const profileDir = path.join(profilesRoot, accountId);
      try {
        const stat = await fs.promises.stat(profileDir);
        if (!stat.isDirectory()) {
          continue;
        }
        summary.scanned += 1;

        // Prefer this process's in-memory last-touch; fall back to the dir
        // mtime so a restart does not make every profile look dormant.
        const lastActiveAtMs = Math.max(
          this.browserState.getLastUsedAt(accountId) ?? 0,
          stat.mtimeMs,
        );

        const action = decideProfileAction({
          isLive: this.browserState.hasLiveContext(accountId),
          isKnownAccount: knownAccountIds.has(accountId),
          lastActiveAtMs,
          nowMs: now,
          config,
        });

        await this.applyAction(action, accountId, profileDir, summary);
      } catch (err) {
        summary.failed += 1;
        this.logger.warn(
          `Browser profile GC skipped ${accountId}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Browser profile GC swept ${summary.scanned} profile(s): ` +
        `${summary.pruned} cache-pruned, ${summary.purgedOrphans} orphan(s) purged, ` +
        `${summary.evictedDormant} dormant evicted, ${summary.skippedLive} live-skipped, ` +
        `${summary.failed} failed. Reclaimed ${formatBytes(summary.reclaimedBytes)} from full removals.`,
    );
    return summary;
  }

  /**
   * Dispatch one decided action. SAFETY 1: every branch that touches disk runs
   * inside the per-account rate-limiter slot, so it is mutually exclusive with
   * `launchPersistentContext` on the same `user_data_dir`.
   */
  private async applyAction(
    action: BrowserProfileGcAction,
    accountId: string,
    profileDir: string,
    summary: SweepSummary,
  ): Promise<void> {
    switch (action) {
      case BrowserProfileGcAction.SKIP_LIVE:
        summary.skippedLive += 1;
        return;

      case BrowserProfileGcAction.PRUNE_CACHE: {
        const removed = await this.rateLimiter.schedule(accountId, () =>
          this.pruneCache(accountId, profileDir),
        );
        if (removed > 0) {
          summary.pruned += 1;
        }
        return;
      }

      case BrowserProfileGcAction.PURGE_ORPHAN:
      case BrowserProfileGcAction.EVICT_DORMANT: {
        const bytes = await this.rateLimiter.schedule(accountId, () =>
          this.removeProfile(accountId, profileDir, action),
        );
        summary.reclaimedBytes += bytes;
        if (action === BrowserProfileGcAction.PURGE_ORPHAN) {
          summary.purgedOrphans += 1;
        } else {
          summary.evictedDormant += 1;
        }
        return;
      }
    }
  }

  /**
   * Delete the disposable caches inside one profile, leaving the session
   * intact. Returns how many cache directories were actually removed.
   *
   * Deliberately does NOT measure reclaimed bytes: that means stat-ing every
   * file in every cache across 500 profiles daily, which costs minutes of IO
   * for a log line. Full removals (rare) are measured instead.
   */
  private async pruneCache(accountId: string, profileDir: string): Promise<number> {
    // Re-check liveness inside the lock: the decision was made before we
    // queued, and a scrape may have launched the context in between.
    if (this.browserState.hasLiveContext(accountId)) {
      return 0;
    }

    let removed = 0;
    for (const relative of CHROMIUM_DISPOSABLE_CACHE_PATHS) {
      const target = path.join(profileDir, ...relative.split('/'));
      try {
        await fs.promises.rm(target, { recursive: true, force: true });
        removed += 1;
      } catch (err) {
        // A single locked/absent cache dir must not abort the rest.
        this.logger.debug(
          `Browser profile GC could not prune ${accountId}/${relative}: ${(err as Error).message}`,
        );
      }
    }
    return removed;
  }

  /**
   * Remove an entire profile directory. This DOES cost a re-login, so it is
   * reached only for an account that no longer exists or has been dormant for
   * months. Also drops the legacy pre-persistent `{accountId}.json` state file.
   */
  private async removeProfile(
    accountId: string,
    profileDir: string,
    action: BrowserProfileGcAction,
  ): Promise<number> {
    if (this.browserState.hasLiveContext(accountId)) {
      return 0;
    }

    const bytes = await this.directorySize(profileDir);
    await fs.promises.rm(profileDir, { recursive: true, force: true });

    // Legacy storageState JSON next to the profiles dir (pre-persistent
    // contexts). Leaving it behind would let a purged orphan resurrect its
    // cookies on the next launch.
    const legacyState = path.join(
      path.dirname(this.browserState.getProfilesRoot()),
      `${accountId}.json`,
    );
    await fs.promises.rm(legacyState, { force: true }).catch(() => undefined);

    this.logger.log(
      `Browser profile GC removed profile ${accountId} (${action}, ${formatBytes(bytes)}). ` +
        'The account will re-authenticate with Amazon on its next use.',
    );
    return bytes;
  }

  /** Recursive size of a directory tree, best-effort (unreadable entries count 0). */
  private async directorySize(dir: string): Promise<number> {
    let total = 0;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return 0;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += await this.directorySize(full);
      } else if (entry.isFile()) {
        try {
          total += (await fs.promises.stat(full)).size;
        } catch {
          // Vanished mid-walk — ignore.
        }
      }
    }
    return total;
  }

  /**
   * Every account id that still exists. Returns `null` on a DB failure so the
   * caller can abort instead of interpreting the outage as "no accounts".
   */
  private async loadKnownAccountIds(): Promise<Set<string> | null> {
    try {
      const rows = await this.databaseService.query<{ id: string }>(
        'SELECT id FROM amazon_accounts',
      );
      return new Set(rows.map((row) => row.id));
    } catch (err) {
      this.logger.error(
        `Browser profile GC could not load amazon_accounts: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /** Effective GC config (DB override → env → code default), fail-soft. */
  private async resolveConfig(): Promise<BrowserProfileGcConfig> {
    try {
      const [enabled, dormantDays, purgeOrphans] = await Promise.all([
        this.platformSettings.getBoolean(PlatformSettingKey.BROWSER_PROFILE_GC_ENABLED),
        this.platformSettings.getNumber(PlatformSettingKey.BROWSER_PROFILE_GC_DORMANT_DAYS),
        this.platformSettings.getBoolean(PlatformSettingKey.BROWSER_PROFILE_GC_PURGE_ORPHANS),
      ]);
      return resolveBrowserProfileGcConfig({ enabled, dormantDays, purgeOrphans });
    } catch (err) {
      this.logger.warn(
        `Browser profile GC settings unavailable (${(err as Error).message}) — using defaults.`,
      );
      return resolveBrowserProfileGcConfig({});
    }
  }
}
