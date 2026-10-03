import { Injectable, Logger } from '@nestjs/common';
import { normalizeListingRules } from '@repo/shared';

import { EbayPromotedListingsService } from '../ebay/ebay-promoted-listings.service';
import { StoreSettingsService } from '../store-settings/store-settings.service';

/**
 * The one step both publish paths (a bulk create and a draft publish) call
 * once listings are live: if the store's listing rules carry an ad rate, put
 * the new listings into the store's Promoted Listings campaign.
 *
 * Never throws and never changes a publish outcome — the listings exist on
 * eBay whatever happens here.
 */
@Injectable()
export class ListingPromotionService {
  private readonly logger = new Logger(ListingPromotionService.name);

  constructor(
    private readonly storeSettings: StoreSettingsService,
    private readonly promoted: EbayPromotedListingsService
  ) {}

  async promoteNewListings(userId: string, ebayAccountId: string, ebayItemIds: readonly string[]): Promise<void> {
    if (ebayItemIds.length === 0) {
      return;
    }
    try {
      const rules = normalizeListingRules(
        (await this.storeSettings.getResolvedSettings(userId, ebayAccountId)).listingRules
      );
      if (rules.promotedAdRate === null) {
        return;
      }
      const result = await this.promoted.promoteListings(ebayAccountId, ebayItemIds, rules.promotedAdRate);
      if (result.skippedReason) {
        this.logger.log(
          `Promoted Listings skipped for store ${ebayAccountId}: eBay does not let this seller advertise (${result.skippedReason})`
        );
      } else {
        this.logger.log(
          `Promoted Listings for store ${ebayAccountId}: ${result.promoted} promoted, ${result.failed} not`
        );
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Promoted Listings step failed for store ${ebayAccountId}: ${error instanceof Error ? error.message : 'unknown'}`
      );
    }
  }
}
