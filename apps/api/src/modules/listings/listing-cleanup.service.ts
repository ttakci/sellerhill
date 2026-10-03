import { Injectable, Logger } from '@nestjs/common';
import { EbayCallPriority, ListingAutoEndReason, ListingStatus, PlatformSettingKey } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { EbayBulkService } from '../ebay/ebay-bulk.service';

import { isEndedListingFailure } from './ended-listing';
import {
  buildCleanupCandidateSql,
  cleanupSteps,
  hasCleanupWork,
  planListingCleanup,
} from './listing-cleanup.helpers';

/** Listings ended in one tick, across every seller. A burst guard, not a quota. */
const MAX_ENDED_PER_RUN = 200;
/** Listings ended for one store in one tick, so one large catalogue cannot take the whole run. */
const MAX_ENDED_PER_STORE = 50;

interface CleanupStoreRow {
  account_id: string;
  user_id: string;
  store_rules: unknown;
  global_rules: unknown;
}

export interface ListingCleanupSummary {
  stores: number;
  ended: number;
  failed: number;
}

/**
 * Ends the listings a seller's own clean-up rules name: ones that stayed out
 * of stock for N days, and — only with the second switch on — ones that did
 * not sell for N days.
 *
 * Both rules are OFF unless the seller turns them on, and nothing here ever
 * relists: an ended listing frees its plan slot and stops being refreshed,
 * which is the point. Every ending is recorded on the row
 * (`auto_ended_reason` / `auto_ended_at`) so the seller can tell it from one
 * they ended themselves.
 */
@Injectable()
export class ListingCleanupService {
  private readonly logger = new Logger(ListingCleanupService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly ebayBulk: EbayBulkService,
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly platformSettings: PlatformSettingsService
  ) {}

  async runSweep(): Promise<ListingCleanupSummary> {
    const summary: ListingCleanupSummary = { stores: 0, ended: 0, failed: 0 };
    // Re-read every tick: turning it off in the panel stops endings at once.
    if (!(await this.platformSettings.getBoolean(PlatformSettingKey.LISTING_CLEANUP_ENABLED))) {
      return summary;
    }

    const stores = await this.databaseService.query<CleanupStoreRow>(
      `SELECT a.id AS account_id, a.user_id,
              s.listing_rules AS store_rules, g.listing_rules AS global_rules
         FROM ebay_accounts a
         LEFT JOIN store_settings s ON s.user_id = a.user_id AND s.store_id = a.id
         LEFT JOIN store_settings g ON g.user_id = a.user_id AND g.is_global = TRUE
        WHERE a.status = 'active'
          AND (s.listing_rules IS NOT NULL OR g.listing_rules IS NOT NULL)
        ORDER BY a.id`
    );

    const suspended = new Map<string, boolean>();
    for (const store of stores) {
      if (summary.ended >= MAX_ENDED_PER_RUN) {
        break;
      }
      const plan = planListingCleanup(store.store_rules, store.global_rules);
      if (!hasCleanupWork(plan)) {
        continue;
      }
      // An unpaid account's automation is stopped everywhere else; ending its
      // listings while it cannot be refreshed would act on stale quantities.
      if (!suspended.has(store.user_id)) {
        suspended.set(store.user_id, await this.quotaEnforcement.isSuspended(store.user_id));
      }
      if (suspended.get(store.user_id)) {
        continue;
      }

      summary.stores += 1;
      let storeBudget = Math.min(MAX_ENDED_PER_STORE, MAX_ENDED_PER_RUN - summary.ended);
      try {
        for (const step of cleanupSteps(plan)) {
          if (storeBudget <= 0) {
            break;
          }
          const result = await this.endDueListings(store, step.reason, step.days, storeBudget);
          summary.ended += result.ended;
          summary.failed += result.failed;
          storeBudget -= result.ended + result.failed;
        }
      } catch (error: unknown) {
        if (error instanceof EbayBudgetExhaustedError) {
          this.logger.warn(`Listing clean-up stopped for this tick: ${error.message}`);
          break;
        }
        // One store's failure (an unusable token, a DB error) never stops the others.
        this.logger.warn(
          `Listing clean-up failed for store ${store.account_id}: ${error instanceof Error ? error.message : 'unknown'}`
        );
      }
    }

    if (summary.ended > 0 || summary.failed > 0) {
      this.logger.log(
        `Listing clean-up: ended ${summary.ended}, failed ${summary.failed} across ${summary.stores} store(s)`
      );
    }
    return summary;
  }

  private async endDueListings(
    store: CleanupStoreRow,
    reason: ListingAutoEndReason,
    days: number,
    limit: number
  ): Promise<{ ended: number; failed: number }> {
    const candidates = await this.databaseService.query<{ id: string; ebay_offer_id: string }>(
      buildCleanupCandidateSql(reason),
      [store.user_id, store.account_id, days, limit]
    );

    let ended = 0;
    let failed = 0;
    for (const listing of candidates) {
      const outcome = await this.ebayBulk.withdrawOffer(
        store.account_id,
        listing.ebay_offer_id,
        EbayCallPriority.BACKGROUND
      );
      // "No such offer" means eBay already holds nothing live for it — the
      // listing is ended either way, which is all this step wants.
      if (outcome.ok || isEndedListingFailure(outcome.errorIds)) {
        await this.databaseService.query(
          `UPDATE listings
              SET status = $2, auto_ended_reason = $3, auto_ended_at = NOW(),
                  auto_end_failed_at = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND status = 'active'`,
          [listing.id, ListingStatus.INACTIVE, reason]
        );
        ended += 1;
        continue;
      }
      failed += 1;
      this.logger.warn(`Could not end listing ${listing.id} (${reason}): ${outcome.message}`);
      await this.databaseService.query(`UPDATE listings SET auto_end_failed_at = NOW() WHERE id = $1`, [listing.id]);
    }
    return { ended, failed };
  }
}
