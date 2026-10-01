import { Injectable, Logger } from '@nestjs/common';
import { AmazonMarketplace, ListingStatus, type ListingSettingsGroup, type ProductData } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EbayBulkService, type BulkPriceQuantityItem } from '../ebay/ebay-bulk.service';
import { EbayService } from '../ebay/ebay.service';
import { StoreSettingsService } from '../store-settings/store-settings.service';

import { isEndedListingFailure } from './ended-listing';
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
  /**
   * The product's stored Amazon price is not > 0: only the quantity is pushed
   * (the offer goes out with no price, so eBay keeps its own), and only the
   * quantity is persisted — the listing's price and profit figures stay as
   * they are. `price` then carries the listing's current price, for the
   * revision log only.
   */
  quantityOnly: boolean;
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
       WHERE product_id = $1 AND status = $2
         -- Listings past the owner's plan limit get no price/stock sync; eBay
         -- keeps whatever they last had. The flag is only ever set while
         -- billing enforcement is on (ListingPlanLimitProcessor clears it
         -- otherwise), so this predicate needs no enforcement check of its own.
         AND over_plan_limit = FALSE`,
      [productId, ListingStatus.ACTIVE]
    );

    if (listings.length === 0) {
      return [];
    }

    const productInfo = await this.listingsService.getProductByAsin(asin, marketplace);
    if (!productInfo) {
      return [];
    }

    // A stored price of 0 means "no usable Amazon price" (an out-of-stock page
    // imported without one, a legacy Keepa `?? 0`), never "free". Pricing from
    // it hands back fees + fixed profit or the price floor, so no price is ever
    // sent for such a product — but its QUANTITY still is, exactly as for any
    // other product: skipping it entirely would leave a listing live at its old
    // quantity after Amazon ran out, and oversell. Logged once per product.
    const priceUnknown = !(Number(productInfo.data.price?.current) > 0);
    if (priceUnknown) {
      this.logger.warn(
        `Product ${asin}: price unknown — quantity synced, price left as is (${listings.length} active listing(s))`
      );
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
          taxRateCache,
          priceUnknown
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
          // Quantity-only: no price in the offer, so eBay keeps its own.
          price: update.quantityOnly ? null : update.price,
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

        // eBay answering "there is no such offer" is proof the listing ended,
        // and it costs nothing extra: this is the reply to a write we were
        // making anyway. Retiring the row stops the Keepa refresh claim from
        // buying tokens for a product with no eBay surface left to update.
        // Best-effort and last, so a bookkeeping failure cannot affect the
        // pushes that succeeded.
        const ended = failures.filter((failure) => isEndedListingFailure(failure.errorIds ?? []));
        if (ended.length > 0) {
          await this.markListingsEnded(ended.map((failure) => failure.listingId)).catch(
            (err: unknown) => {
              this.logger.warn(
                `Failed to mark ended listings: ${err instanceof Error ? err.message : String(err)}`
              );
            }
          );
        }

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
    taxRateCache: Map<string, number>,
    priceUnknown = false
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
    const overridden = applyListingOverrides(strategy, listing);
    // Price unknown: only the quantity is ours to change. The price (and every
    // figure derived from it) stays exactly what the listing already holds, so
    // the delta check compares quantity alone.
    const currentPrice = Number(listing.price) || 0;
    const resolved = priceUnknown ? { ...overridden, price: currentPrice } : overridden;

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
      previousPrice: currentPrice,
      previousQuantity: Number(listing.quantity) || 0,
      quantityOnly: priceUnknown,
    };
  }

  /** One round trip for the whole batch instead of one UPDATE per listing. */
  private async persistApplied(
    all: Array<{ result: { offerId: string | null }; update: PendingListingUpdate }>
  ): Promise<void> {
    await this.persistQuantityOnly(all.filter((entry) => entry.update.quantityOnly));
    const applied = all.filter((entry) => !entry.update.quantityOnly);
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
   * Quantity-only updates (source price unknown): write the quantity and the
   * identifiers eBay confirmed, and NOTHING priced — `price`, `purchase_price`,
   * `estimated_profit`, `profit_margin` and `roi` stay what the listing held,
   * because any recomputed figure would be derived from a price of 0.
   */
  private async persistQuantityOnly(
    applied: Array<{ result: { offerId: string | null }; update: PendingListingUpdate }>
  ): Promise<void> {
    if (applied.length === 0) {
      return;
    }

    await this.databaseService.query(
      `UPDATE listings AS l
       SET quantity = v.quantity,
           sku = CASE WHEN v.offer_id IS NOT NULL THEN COALESCE(l.sku, v.sku) ELSE l.sku END,
           ebay_offer_id = COALESCE(v.offer_id, l.ebay_offer_id),
           updated_at = CURRENT_TIMESTAMP
       FROM (
         SELECT * FROM unnest($1::uuid[], $2::int[], $3::text[], $4::text[]) AS t(id, quantity, sku, offer_id)
       ) AS v
       WHERE l.id = v.id`,
      [
        applied.map((entry) => entry.update.listingId),
        applied.map((entry) => entry.update.quantity),
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
   * Retire listings eBay says no longer exist.
   *
   * INACTIVE, not a new "ended" status: the enum already has a state for "we
   * hold this listing but it is not live on eBay", the listings filter already
   * offers it, and the Keepa refresh claim already requires an ACTIVE listing —
   * so this one write stops the token spend with nothing else to change. A
   * separate ENDED value would have to be threaded through the filter, the
   * badge, both locales and the claim query to buy a distinction the seller
   * does not act on differently.
   *
   * Scoped to `status = ACTIVE` so it can only ever move a row one way. The
   * fan-out only selects active listings, so that predicate is about what this
   * statement is ALLOWED to do rather than what it currently does — it means a
   * future caller cannot use it to resurrect-then-retire a draft.
   */
  private async markListingsEnded(listingIds: string[]): Promise<void> {
    if (listingIds.length === 0) {
      return;
    }

    const result = await this.databaseService.query(
      `UPDATE listings
          SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($2::uuid[]) AND status = $3
        RETURNING id`,
      [ListingStatus.INACTIVE, listingIds, ListingStatus.ACTIVE]
    );

    if (result.length > 0) {
      this.logger.log(
        `Marked ${result.length} listing(s) inactive — eBay reports the offer no longer exists`
      );
    }
  }

  /**
   * "Checked, nothing moved" rows — one per active listing of a product whose
   * refresh just succeeded, so the Revisions drawer shows that the check RAN
   * instead of leaving a silent gap between two real changes (a 6-hourly
   * refresh with no change used to look skipped).
   *
   * The row is an ordinary `listing_revisions` row with previous = new, taken
   * from the listing's own stored price/quantity (what eBay last confirmed).
   * `excludeListingIds` are the listings this cycle already pushed (or tried
   * to): a confirmed push has its real from→to row, and a FAILED push must not
   * read as "unchanged" when Amazon and eBay actually disagree. Listings past
   * the plan limit are not refreshed, so they get no row either.
   */
  async recordUnchangedChecks(productIds: string[], excludeListingIds: string[]): Promise<void> {
    if (productIds.length === 0) {
      return;
    }

    // The Amazon stock at this check (products.stock is already updated by
    // the time the fan-out runs) and what the listing's latest revision
    // recorded as its Amazon stock — "previous" — so the drawer can show the
    // source stock moving even when the eBay quantity did not.
    await this.databaseService.query(
      `INSERT INTO listing_revisions (
         listing_id, previous_price, new_price, previous_quantity, new_quantity,
         previous_source_stock, previous_source_stock_status, new_source_stock, new_source_stock_status
       )
       SELECT l.id, l.price, l.price, l.quantity, l.quantity,
              prev.new_source_stock, prev.new_source_stock_status, p.stock, p.stock_status
       FROM listings l
       JOIN products p ON p.id = l.product_id
       LEFT JOIN LATERAL (
         SELECT r.new_source_stock, r.new_source_stock_status
         FROM listing_revisions r
         WHERE r.listing_id = l.id
         ORDER BY r.recorded_at DESC, r.id DESC
         LIMIT 1
       ) prev ON TRUE
       WHERE l.product_id = ANY($1::uuid[])
         AND l.status = $2
         AND l.over_plan_limit = FALSE
         AND l.price IS NOT NULL
         AND l.quantity IS NOT NULL
         AND NOT (l.id = ANY($3::uuid[]))`,
      [productIds, ListingStatus.ACTIVE, excludeListingIds]
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
         listing_id, previous_price, new_price, previous_quantity, new_quantity,
         previous_source_stock, previous_source_stock_status, new_source_stock, new_source_stock_status
       )
       SELECT t.listing_id, t.previous_price, t.new_price, t.previous_quantity, t.new_quantity,
              prev.new_source_stock, prev.new_source_stock_status, p.stock, p.stock_status
       FROM unnest(
         $1::uuid[], $2::numeric[], $3::numeric[], $4::int[], $5::int[]
       ) AS t(listing_id, previous_price, new_price, previous_quantity, new_quantity)
       JOIN listings l ON l.id = t.listing_id
       JOIN products p ON p.id = l.product_id
       LEFT JOIN LATERAL (
         SELECT r.new_source_stock, r.new_source_stock_status
         FROM listing_revisions r
         WHERE r.listing_id = l.id
         ORDER BY r.recorded_at DESC, r.id DESC
         LIMIT 1
       ) prev ON TRUE`,
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
