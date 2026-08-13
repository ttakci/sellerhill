import { Injectable, Logger } from '@nestjs/common';
import { AmazonMarketplace, ListingStatus, type ListingSettingsGroup, type ProductData } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EbayBulkService, type BulkPriceQuantityItem } from '../ebay/ebay-bulk.service';
import { EbayService } from '../ebay/ebay.service';
import { StoreSettingsService } from '../store-settings/store-settings.service';

import {
  applyListingOverrides,
  hasCommerceDelta,
  type ListingOverrideRow,
} from './listing-pricing.helpers';
import { ListingStrategyService } from './listing-strategy.service';
import { ListingsService } from './listings.service';

/** A listing whose price or quantity moved and now has to reach eBay. */
export interface PendingListingUpdate {
  listingId: string;
  userId: string;
  /** The store this listing lives on — the grouping key for a bulk call. */
  ebayAccountId: string;
  sku: string;
  offerId: string | null;
  ebayItemId: string;
  price: number;
  quantity: number;
  purchasePrice: number;
  estimatedProfit: number;
  profitMargin: number;
  roi: number;
  /** What eBay/the row held before this update — carried through only so
   *  `recordRevisions` can log a from→to pair without a second read. */
  previousPrice: number;
  previousQuantity: number;
}

interface ListingRow extends ListingOverrideRow {
  id: string;
  user_id: string;
  listing_settings_group_id: string;
  ebay_item_id: string;
  ebay_account_id: string | null;
  sku: string | null;
  ebay_offer_id: string | null;
}

/**
 * Fan-out for product data changes.
 *
 * The stale-driven Keepa refresh and the sale-driven stock sync both delegate
 * here: given a product whose Amazon data moved, recompute every active listing
 * sharing it (each per its own settings group) and push the ones that actually
 * changed.
 *
 * Split in two on purpose. `computePendingUpdates` touches no eBay API, so a
 * caller holding many products (the 50-product refresh batch) can accumulate
 * across all of them and hand the whole set to `flushUpdates`, which groups by
 * store and sends 25 listings per call. Pushing per product — the old shape —
 * meant two products belonging to the same seller never shared a call, and each
 * listing cost four.
 */
@Injectable()
export class ProductSyncService {
  private readonly logger = new Logger(ProductSyncService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly strategyService: ListingStrategyService,
    private readonly ebayService: EbayService,
    private readonly ebayBulkService: EbayBulkService,
    private readonly listingsService: ListingsService,
    private readonly storeSettingsService: StoreSettingsService
  ) {}

  /**
   * Public entry point used by the sale-driven stock-sync queue.
   * Resolves the ASIN for a product, then recomputes + pushes every active
   * listing that shares it.
   */
  async syncListingsForProduct(productId: string): Promise<void> {
    const rows = await this.databaseService.query<{ asin: string; marketplace: string }>(
      `SELECT asin, marketplace FROM products WHERE id = $1`,
      [productId]
    );
    if (rows.length === 0) {
      this.logger.debug(`syncListingsForProduct: product ${productId} not found`);
      return;
    }
    await this.updateAllListingsForProduct(productId, rows[0].asin, rows[0].marketplace as AmazonMarketplace);
  }

  /** Compute + push for a single product. Callers with many products should batch instead. */
  async updateAllListingsForProduct(
    productId: string,
    asin: string,
    marketplace: AmazonMarketplace = AmazonMarketplace.AMAZON_US
  ): Promise<void> {
    await this.flushUpdates(await this.computePendingUpdates(productId, asin, marketplace));
  }

  /**
   * Work out what each active listing for this product should now cost and
   * stock. Makes no eBay calls; returns only the listings that actually moved.
   */
  async computePendingUpdates(
    productId: string,
    asin: string,
    marketplace: AmazonMarketplace = AmazonMarketplace.AMAZON_US
  ): Promise<PendingListingUpdate[]> {
    const listings = await this.databaseService.query<ListingRow>(
      `SELECT id, user_id, listing_settings_group_id, ebay_item_id, ebay_account_id,
              sku, ebay_offer_id, price, quantity,
              COALESCE(disable_ordering, false) as disable_ordering,
              COALESCE(disable_repricing, false) as disable_repricing,
              COALESCE(lock_price, false) as lock_price,
              COALESCE(lock_quantity, false) as lock_quantity,
              price_override, quantity_override, margin_percent_override, margin_fixed_override
       FROM listings
       WHERE product_id = $1 AND status = $2`,
      [productId, ListingStatus.ACTIVE]
    );

    if (listings.length === 0) {
      return [];
    }

    const productInfo = await this.listingsService.getProductByAsin(asin, marketplace);
    if (!productInfo) {
      return [];
    }

    // One settings-group read per (user, group) instead of one per listing:
    // an ASIN listed by the same seller in several groups, or by many sellers,
    // used to re-fetch the same rows for every listing.
    const groupCache = new Map<string, ListingSettingsGroup>();
    const accountCache = new Map<string, string | null>();
    // One Amazon-tax-rate read per (user, store) instead of per listing — the
    // same reasoning as groupCache: a shared ASIN listed by many sellers, or
    // by one seller across several stores, must not re-resolve store settings
    // for every listing it touches.
    const taxRateCache = new Map<string, number>();
    const pending: PendingListingUpdate[] = [];

    for (const listing of listings) {
      try {
        const update = await this.buildPendingUpdate(
          listing,
          asin,
          productInfo.data,
          groupCache,
          accountCache,
          taxRateCache
        );
        if (update) {
          pending.push(update);
        }
      } catch (error: unknown) {
        this.logger.error(
          `Failed to recompute listing ${listing.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return pending;
  }

  /**
   * Send pending updates to eBay, grouped by store, 25 per call, then persist
   * what eBay accepted.
   *
   * A listing row is only written after eBay confirms its entry — a failed push
   * leaves the old price in place so the next refresh retries it, which is the
   * same contract the per-listing path had.
   */
  async flushUpdates(updates: PendingListingUpdate[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    const byAccount = new Map<string, PendingListingUpdate[]>();
    for (const update of updates) {
      const group = byAccount.get(update.ebayAccountId) ?? [];
      group.push(update);
      byAccount.set(update.ebayAccountId, group);
    }

    const byListingId = new Map(updates.map((update) => [update.listingId, update]));

    await Promise.allSettled(
      Array.from(byAccount.entries()).map(async ([accountId, accountUpdates]) => {
        const items: BulkPriceQuantityItem[] = accountUpdates.map((update) => ({
          listingId: update.listingId,
          sku: update.sku,
          offerId: update.offerId,
          price: update.price,
          quantity: update.quantity,
        }));

        const results = await this.ebayBulkService.updatePriceQuantity(accountId, items);

        const applied = results
          .filter((result) => result.ok)
          .map((result) => ({ result, update: byListingId.get(result.listingId) }))
          .filter((pair): pair is { result: (typeof results)[number]; update: PendingListingUpdate } =>
            Boolean(pair.update)
          );

        await this.persistApplied(applied);
        await this.persistResolvedOfferIds(results.filter((result) => !result.ok && result.offerId));
        // Best-effort — a history row is never worth failing a push eBay already
        // accepted over. Every entry here already passed `hasCommerceDelta`, so
        // this never logs a no-op tick.
        await this.recordRevisions(applied.map((entry) => entry.update)).catch((err: unknown) => {
          this.logger.warn(
            `Failed to record listing revisions: ${err instanceof Error ? err.message : String(err)}`
          );
        });

        const failures = results.filter((result) => !result.ok);
        for (const failure of failures) {
          this.logger.warn(`eBay rejected the update for listing ${failure.listingId}: ${failure.error}`);
        }

        this.logger.log(
          `Pushed ${results.length - failures.length}/${results.length} listing updates ` +
            `to eBay account ${accountId} in ${Math.ceil(items.length / 25)} bulk call(s)`
        );
      })
    );
  }

  // --------------------------------------------------------------- internals

  private async buildPendingUpdate(
    listing: ListingRow,
    asin: string,
    product: ProductData,
    groupCache: Map<string, ListingSettingsGroup>,
    accountCache: Map<string, string | null>,
    taxRateCache: Map<string, number>
  ): Promise<PendingListingUpdate | null> {
    const groupKey = `${listing.user_id}:${listing.listing_settings_group_id}`;
    let group = groupCache.get(groupKey);
    if (!group) {
      group = await this.strategyService.getSettingsGroup(listing.user_id, listing.listing_settings_group_id);
      groupCache.set(groupKey, group);
    }

    const taxRateKey = `${listing.user_id}:${listing.ebay_account_id ?? ''}`;
    let amazonTaxRatePct = taxRateCache.get(taxRateKey);
    if (amazonTaxRatePct === undefined) {
      // Best-effort — a settings hiccup must degrade to "no tax factored in"
      // for this one listing, never abort its price recompute (same rule as
      // OrderSyncService.recomputeProfit's provisional-profit resolve).
      try {
        const settings = await this.storeSettingsService.getResolvedSettings(
          listing.user_id,
          listing.ebay_account_id
        );
        amazonTaxRatePct = Number(settings.amazonTaxRate) || 0;
      } catch (err) {
        this.logger.warn(
          `Store settings resolve failed for tax rate (user ${listing.user_id}): ${err instanceof Error ? err.message : String(err)}`
        );
        amazonTaxRatePct = 0;
      }
      taxRateCache.set(taxRateKey, amazonTaxRatePct);
    }

    const strategy = await this.strategyService.computePricing(
      listing.user_id,
      product,
      listing.listing_settings_group_id,
      group,
      amazonTaxRatePct
    );
    const resolved = applyListingOverrides(strategy, listing);

    if (!hasCommerceDelta(listing, resolved)) {
      this.logger.debug(
        `Listing ${listing.ebay_item_id} unchanged (price=${resolved.price}, qty=${resolved.quantity}); skipping`
      );
      return null;
    }

    // A bulk call is authenticated with ONE seller token, so the account is no
    // longer optional context. The old path asked `getActiveAccount(userId)`,
    // an unordered `LIMIT 1`, which could push a listing through a different
    // store than the one it was published on.
    const accountKey = `${listing.user_id}:${listing.ebay_account_id ?? ''}`;
    let accountId = accountCache.get(accountKey);
    if (accountId === undefined) {
      accountId = await this.ebayService.resolveListingAccountId(listing.user_id, listing.ebay_account_id);
      accountCache.set(accountKey, accountId);
    }
    if (!accountId) {
      this.logger.warn(`Listing ${listing.id} has no active eBay account to push through; skipping`);
      return null;
    }

    return {
      listingId: listing.id,
      userId: listing.user_id,
      ebayAccountId: accountId,
      // Rows created before migration 067 have no stored SKU. Production minted
      // `${asin}-NEW`, so the guess is right there and is the only way to
      // address those rows — but it is only a guess, and `persistApplied` will
      // not write it back unless eBay confirms it by resolving an offer.
      sku: listing.sku ?? `${asin}-NEW`,
      offerId: listing.ebay_offer_id,
      ebayItemId: listing.ebay_item_id,
      price: resolved.price,
      quantity: resolved.quantity,
      purchasePrice: resolved.purchasePrice,
      estimatedProfit: resolved.estimatedProfit,
      profitMargin: resolved.profitMargin,
      roi: resolved.roi,
      previousPrice: Number(listing.price) || 0,
      previousQuantity: Number(listing.quantity) || 0,
    };
  }

  /** One round trip for the whole batch instead of one UPDATE per listing. */
  private async persistApplied(
    applied: Array<{ result: { offerId: string | null }; update: PendingListingUpdate }>
  ): Promise<void> {
    if (applied.length === 0) {
      return;
    }

    await this.databaseService.query(
      `UPDATE listings AS l
       SET price = v.price,
           quantity = v.quantity,
           purchase_price = v.purchase_price,
           estimated_profit = v.estimated_profit,
           profit_margin = v.profit_margin,
           roi = v.roi,
           -- Only adopt the guessed SKU once eBay has confirmed it by resolving
           -- an offer from it. Writing it unconditionally poisoned the column
           -- on sandbox rows, whose real SKU is timestamped and can never match
           -- the guessed one -- and a wrong SKU here is permanent.
           sku = CASE WHEN v.offer_id IS NOT NULL THEN COALESCE(l.sku, v.sku) ELSE l.sku END,
           ebay_offer_id = COALESCE(v.offer_id, l.ebay_offer_id),
           updated_at = CURRENT_TIMESTAMP
       FROM (
         SELECT * FROM unnest(
           $1::uuid[], $2::numeric[], $3::int[], $4::numeric[],
           $5::numeric[], $6::numeric[], $7::numeric[], $8::text[], $9::text[]
         ) AS t(id, price, quantity, purchase_price, estimated_profit, profit_margin, roi, sku, offer_id)
       ) AS v
       WHERE l.id = v.id`,
      [
        applied.map((entry) => entry.update.listingId),
        applied.map((entry) => entry.update.price),
        applied.map((entry) => entry.update.quantity),
        applied.map((entry) => entry.update.purchasePrice),
        applied.map((entry) => entry.update.estimatedProfit),
        applied.map((entry) => entry.update.profitMargin),
        applied.map((entry) => entry.update.roi),
        applied.map((entry) => entry.update.sku),
        applied.map((entry) => entry.result.offerId),
      ]
    );
  }

  /**
   * Keep an offer id we had to look up even when the push itself failed —
   * the id is still correct, and storing it stops the next attempt paying for
   * the same lookup.
   */
  private async persistResolvedOfferIds(
    results: Array<{ listingId: string; offerId: string | null }>
  ): Promise<void> {
    if (results.length === 0) {
      return;
    }

    await this.databaseService.query(
      `UPDATE listings AS l
       SET ebay_offer_id = v.offer_id
       FROM (SELECT * FROM unnest($1::uuid[], $2::text[]) AS t(id, offer_id)) AS v
       WHERE l.id = v.id AND l.ebay_offer_id IS NULL`,
      [results.map((result) => result.listingId), results.map((result) => result.offerId)]
    );
  }

  /**
   * One row per listing whose price or quantity eBay just confirmed — the
   * history behind the detail page's "Revisions" drawer. Same one-round-trip
   * shape as `persistApplied`; `updates` is already filtered to listings eBay
   * accepted (see the `applied` array in `flushUpdates`), so nothing here
   * re-checks `hasCommerceDelta`.
   */
  private async recordRevisions(updates: PendingListingUpdate[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    await this.databaseService.query(
      `INSERT INTO listing_revisions (
         listing_id, previous_price, new_price, previous_quantity, new_quantity
       )
       SELECT * FROM unnest(
         $1::uuid[], $2::numeric[], $3::numeric[], $4::int[], $5::int[]
       ) AS t(listing_id, previous_price, new_price, previous_quantity, new_quantity)`,
      [
        updates.map((update) => update.listingId),
        updates.map((update) => update.previousPrice),
        updates.map((update) => update.price),
        updates.map((update) => update.previousQuantity),
        updates.map((update) => update.quantity),
      ]
    );
  }
}
