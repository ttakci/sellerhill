import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EBAY_MARKETPLACE_CONFIG,
  EbayApiResource,
  EbayCallPriority,
  type EbayMarketplaceId,
  type ListingCreationData,
} from '@repo/shared';
import axios from 'axios';

import { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';

import { type AspectResolution, type CategoryAspect } from './aspect-builder';
import { AspectResolverService } from './aspect-resolver.service';
import {
  chunkForBulk,
  correlateBulkResponses,
  describeBulkErrors,
  extractExistingOfferId,
  extractMissingAspectName,
  extractRejectedAspect,
  isBulkSystemError,
  type EbayBulkEnvelope,
  type EbayBulkResponseEntry,
} from './ebay-bulk.helpers';
import { withEbayRateLimitRetry } from './ebay-http-retry';
import { buildInventoryItemPayload, buildOfferPayload } from './ebay-listing-payload';
import { ListingPublishExhaustedError } from './ebay.errors';
import { EbayService } from './ebay.service';

/** One listing's desired commerce state, as the fan-out computed it. */
export interface BulkPriceQuantityItem {
  /** Our `listings.id` — the correlation key for the result, not sent to eBay. */
  listingId: string;
  sku: string;
  /** `listings.ebay_offer_id`; null on rows created before migration 067. */
  offerId: string | null;
  price: number;
  quantity: number;
}

export interface BulkPriceQuantityResult {
  listingId: string;
  ok: boolean;
  /** Resolved offer id, so the caller can persist it and stop paying for the lookup. */
  offerId: string | null;
  error?: string;
}

interface OffersLookupResponse {
  offers?: Array<{ offerId?: string; marketplaceId?: string }>;
}

/** One listing, fully prepared and ready to be written to eBay. */
export interface BulkListingDraft {
  /** Correlation key back to the caller's bookkeeping (`listing_job_items.id`). */
  key: string;
  asin: string;
  sku: string;
  data: ListingCreationData;
  policies: { paymentId: string; shippingId: string; returnId: string };
  categoryId: string;
  categoryName: string;
  categoryAspects: CategoryAspect[];
  resolution: AspectResolution;
}

export interface BulkListingOutcome {
  key: string;
  ok: boolean;
  listingId?: string;
  offerId?: string;
  categoryId: string;
  categoryName: string;
  /** Final aspect resolution, including anything the self-heal loop forced. */
  resolution: AspectResolution;
  error?: string;
  /**
   * `name` of the typed error behind this failure, when there is one.
   *
   * The failure classifier keys on `Error.name`, but a per-entry bulk failure
   * is a JSON object rather than a thrown error, so the type would be lost on
   * the way to `classifyListingFailure` and every exhausted item would report
   * the generic "could not be created". The caller reattaches it.
   */
  errorName?: string;
}

/**
 * Attempts allowed per item in the staged create.
 *
 * Matches the single-item path. With the terminal aspect fallback in place a
 * required aspect is never left empty, so a third publish cannot succeed where
 * the second failed — it would only multiply call volume for a listing that is
 * already broken.
 */
const MAX_CREATE_ATTEMPTS = 3;

/** Mutable per-item state carried through the staged pipeline. */
interface DraftState {
  draft: BulkListingDraft;
  offerId?: string;
  forcedAspectNames: string[];
  attempts: number;
}

/**
 * Batched writes against the eBay Inventory API.
 *
 * eBay meters calls PER APPLICATION (2M/day for Inventory, shared by every one
 * of our sellers), not per user, so call count — not seller count — is the
 * scaling limit. The per-listing path this replaces spent four HTTP calls to
 * change one price; `bulk_update_price_quantity` carries 25 listings in one,
 * which is the difference between ~80% and ~1% of the daily quota at a million
 * listings.
 *
 * Every method here is scoped to a single eBay account because a bulk call
 * carries exactly one seller token.
 */
@Injectable()
export class EbayBulkService {
  private readonly logger = new Logger(EbayBulkService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly ebayService: EbayService,
    private readonly budget: EbayCallBudgetService,
    private readonly aspectResolver: AspectResolverService
  ) {}

  /** Charge one Inventory-API call against the shared daily quota. */
  private chargeInventory(priority: EbayCallPriority): () => Promise<void> {
    return () => this.budget.acquire(EbayApiResource.INVENTORY, priority);
  }

  /**
   * Push price + quantity for many listings on one store.
   *
   * Returns one result per input item. A bulk call answers 200 (or 207
   * Multi-Status) with per-entry statuses, so partial failure is the normal
   * case and is reported per listing rather than failing the batch.
   */
  async updatePriceQuantity(
    accountId: string,
    items: BulkPriceQuantityItem[]
  ): Promise<BulkPriceQuantityResult[]> {
    if (items.length === 0) {
      return [];
    }

    const context = await this.ebayService.getAccountApiContext(accountId);
    const url = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/bulk_update_price_quantity`;
    const results: BulkPriceQuantityResult[] = [];

    for (const batch of chunkForBulk(items)) {
      // Rows predating migration 067 have no offer id. Recover it once here so
      // the column can be persisted by the caller; after that the lookup never
      // runs again for this listing.
      const resolved = await Promise.all(
        batch.map(async (item) => ({
          ...item,
          offerId: item.offerId ?? (await this.lookupOfferId(context, item.sku)),
        }))
      );

      const requests = resolved.map((item) => ({
        sku: item.sku,
        // `shipToLocationAvailability` is the total across marketplaces and
        // `offers[].availableQuantity` the per-marketplace slice; eBay publishes
        // the MINIMUM of the two, so both must carry the same number. eBay also
        // wipes the ship-to-home quantity if the container is omitted on an
        // update, so it is always sent.
        shipToLocationAvailability: { quantity: item.quantity },
        ...(item.offerId
          ? {
              offers: [
                {
                  offerId: item.offerId,
                  availableQuantity: item.quantity,
                  price: { currency: context.currency, value: item.price.toFixed(2) },
                },
              ],
            }
          : {}),
      }));

      try {
        const response = await withEbayRateLimitRetry(
          () =>
            axios.post<EbayBulkEnvelope>(
              url,
              { requests },
              {
                headers: {
                  Authorization: `Bearer ${context.accessToken}`,
                  'Content-Type': 'application/json',
                  'Content-Language': context.contentLanguage,
                },
              }
            ),
          { logger: this.logger, acquireBudget: this.chargeInventory(EbayCallPriority.BACKGROUND) }
        );

        for (const outcome of correlateBulkResponses(resolved, response.data?.responses, (item) => item.sku)) {
          results.push({
            listingId: outcome.item.listingId,
            offerId: outcome.item.offerId,
            ok: outcome.ok,
            ...(outcome.ok ? {} : { error: describeBulkErrors(outcome.entry) }),
          });
        }
      } catch (error: unknown) {
        // Transport-level failure fails the whole batch — nothing in it landed.
        // Reported per listing so the caller keeps its per-row bookkeeping and
        // does NOT write the new price to rows eBay never accepted.
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`bulk_update_price_quantity failed for account ${accountId}: ${message}`);
        for (const item of resolved) {
          results.push({ listingId: item.listingId, offerId: item.offerId, ok: false, error: message });
        }
      }
    }

    return results;
  }

  /**
   * Create and publish up to 25 listings on one store with three calls.
   *
   * Staged, with the failure set shrinking at each step: items that fail to
   * become inventory items never reach the offer call, and items with no offer
   * never reach publish. That is what keeps a single bad ASIN from costing the
   * other 24 their listings — the per-item isolation the one-at-a-time path got
   * for free has to be rebuilt explicitly here.
   *
   * The aspect self-heal loop is preserved: when eBay names a missing item
   * specific, ONLY the affected items are re-resolved and replayed, and the
   * retry costs three calls for the whole retry set rather than three per item.
   * Re-resolution makes no eBay call — category aspect metadata is cached.
   */
  async createListings(
    accountId: string,
    merchantLocationKey: string,
    drafts: BulkListingDraft[],
    priority: EbayCallPriority = EbayCallPriority.BACKGROUND
  ): Promise<BulkListingOutcome[]> {
    if (drafts.length === 0) {
      return [];
    }

    // A seller waiting on a publish gets the full daily ceiling; queue-driven
    // bulk adds acquire against the reserved-off limit. That reserve exists
    // precisely so a night of background work cannot leave a seller unable to
    // publish, which only holds if the interactive path says so.
    const context = { ...(await this.ebayService.getAccountApiContext(accountId)), priority };
    const outcomes: BulkListingOutcome[] = [];

    for (const batch of chunkForBulk(drafts)) {
      let pending: DraftState[] = batch.map((draft) => ({ draft, forcedAspectNames: [], attempts: 0 }));

      while (pending.length > 0) {
        for (const state of pending) {
          state.attempts += 1;
        }

        const staged = await this.runCreateStages(context, merchantLocationKey, pending);
        outcomes.push(...staged.settled);

        // Only items eBay told us how to fix, and only while attempts remain.
        pending = staged.retry.filter((state) => {
          if (state.attempts < MAX_CREATE_ATTEMPTS) {
            return true;
          }
          // Same condition the single-item path raised as a typed error, and the
          // failure classifier still keys on that type — so it is built here
          // rather than hand-written, and its name travels on the outcome.
          const exhausted = new ListingPublishExhaustedError(
            state.draft.categoryId,
            state.forcedAspectNames,
            state.attempts
          );
          outcomes.push(this.failure(state, exhausted.message, exhausted.name));
          return false;
        });
      }
    }

    return outcomes;
  }

  /** One pass of inventory item -> offer -> publish over the given items. */
  private async runCreateStages(
    context: {
      accessToken: string;
      marketplaceId: EbayMarketplaceId;
      contentLanguage: string;
      priority: EbayCallPriority;
    },
    merchantLocationKey: string,
    states: DraftState[]
  ): Promise<{ settled: BulkListingOutcome[]; retry: DraftState[] }> {
    const settled: BulkListingOutcome[] = [];
    const retry: DraftState[] = [];
    const config = EBAY_MARKETPLACE_CONFIG[context.marketplaceId] || EBAY_MARKETPLACE_CONFIG.EBAY_US;

    // --- Stage A: inventory items -------------------------------------------
    // The single-item `PUT /inventory_item/{sku}` path only needs the
    // Content-Language header, but the bulk endpoint validates a `locale`
    // field on every request entry and rejects the whole batch with "Valid
    // SKU and locale information are required for all the InventoryItems in
    // the request" when it's missing. eBay's LocaleEnum uses underscores
    // (`en_US`), unlike the header's hyphenated form (`en-US`).
    const locale = context.contentLanguage.replace('-', '_');
    const itemRequests = states.map((state) => {
      const { payload, usedPlaceholderImage } = buildInventoryItemPayload(state.draft.data, state.draft.resolution);
      if (usedPlaceholderImage) {
        this.logger.warn(`No valid images for SKU ${state.draft.sku}, using placeholder`);
      }
      return { sku: state.draft.sku, locale, ...payload };
    });

    const itemResponses = await this.postBulk(context, 'bulk_create_or_replace_inventory_item', {
      requests: itemRequests,
    });
    const withItems: DraftState[] = [];
    for (const outcome of correlateBulkResponses(states, itemResponses, (state) => state.draft.sku)) {
      if (outcome.ok) {
        withItems.push(outcome.item);
      } else {
        settled.push(this.failure(outcome.item, describeBulkErrors(outcome.entry)));
      }
    }
    if (withItems.length === 0) {
      return { settled, retry };
    }

    // --- Stage B: offers -----------------------------------------------------
    const offerResponses = await this.postBulk(context, 'bulk_create_offer', {
      requests: withItems.map((state) =>
        buildOfferPayload({
          sku: state.draft.sku,
          data: state.draft.data,
          policies: state.draft.policies,
          config,
          marketplaceId: context.marketplaceId,
          categoryId: state.draft.categoryId,
          merchantLocationKey,
        })
      ),
    });

    const withOffers: DraftState[] = [];
    for (const outcome of correlateBulkResponses(withItems, offerResponses, (state) => state.draft.sku)) {
      if (outcome.ok && outcome.entry?.offerId) {
        outcome.item.offerId = outcome.entry.offerId;
        withOffers.push(outcome.item);
        continue;
      }
      // A self-heal replay always collides with the offer its first pass
      // created; eBay returns the existing id. Refresh it before publishing —
      // the existing offer may carry the price/quantity of the earlier attempt,
      // and publishing it unchanged would put a stale price on a live listing.
      const existing = extractExistingOfferId(outcome.entry?.errors);
      if (existing) {
        outcome.item.offerId = existing;
        await this.refreshOffer(context, existing, config, merchantLocationKey, outcome.item.draft);
        withOffers.push(outcome.item);
        continue;
      }
      settled.push(this.failure(outcome.item, describeBulkErrors(outcome.entry)));
    }
    if (withOffers.length === 0) {
      return { settled, retry };
    }

    // --- Stage C: publish ----------------------------------------------------
    const publishResponses = await this.postBulk(context, 'bulk_publish_offer', {
      requests: withOffers.map((state) => ({ offerId: state.offerId })),
    });

    for (const outcome of correlateBulkResponses(
      withOffers,
      publishResponses,
      (state) => state.offerId ?? '',
      (entry) => entry.offerId
    )) {
      const state = outcome.item;

      if (outcome.ok && outcome.entry?.listingId) {
        settled.push({
          key: state.draft.key,
          ok: true,
          listingId: outcome.entry.listingId,
          offerId: state.offerId,
          categoryId: state.draft.categoryId,
          categoryName: state.draft.categoryName,
          resolution: state.draft.resolution,
        });
        this.aspectResolver.recordPublishSuccess(
          context.marketplaceId,
          state.draft.categoryId,
          state.draft.resolution
        );
        continue;
      }

      // eBay refused a value we sent — demote it so the next listing in this
      // category stops repeating it.
      const rejected = extractRejectedAspect(outcome.entry?.errors);
      if (rejected) {
        this.aspectResolver.recordAspectRejection(
          context.marketplaceId,
          state.draft.categoryId,
          rejected.name,
          rejected.value
        );
      }

      const missing = extractMissingAspectName(outcome.entry?.errors);
      if (missing && !state.forcedAspectNames.includes(missing)) {
        state.forcedAspectNames.push(missing);
        state.draft.resolution = await this.aspectResolver.resolve({
          marketplaceId: context.marketplaceId,
          categoryId: state.draft.categoryId,
          categoryAspects: state.draft.categoryAspects,
          forcedAspectNames: state.forcedAspectNames,
          product: {
            title: state.draft.data.title,
            brand: state.draft.data.brand,
            specs: state.draft.data.specs,
            features: state.draft.data.features,
            identifiers: state.draft.data.identifiers,
          },
        });
        retry.push(state);
        continue;
      }

      if (isBulkSystemError(outcome.entry?.errors)) {
        // Transient eBay fault; the offer is orphaned and must go before a replay.
        await this.deleteOffer(context, state.offerId);
        state.offerId = undefined;
        retry.push(state);
        continue;
      }

      settled.push(this.failure(state, describeBulkErrors(outcome.entry)));
    }

    return { settled, retry };
  }

  private failure(state: DraftState, error: string, errorName?: string): BulkListingOutcome {
    return {
      key: state.draft.key,
      ok: false,
      categoryId: state.draft.categoryId,
      categoryName: state.draft.categoryName,
      resolution: state.draft.resolution,
      error,
      ...(errorName ? { errorName } : {}),
    };
  }

  /** POST a bulk Inventory-API body and return its `responses[]`. */
  private async postBulk(
    context: { accessToken: string; contentLanguage: string; priority: EbayCallPriority },
    path: string,
    body: Record<string, unknown>
  ): Promise<EbayBulkResponseEntry[]> {
    const url = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/${path}`;
    const response = await withEbayRateLimitRetry(
      () =>
        axios.post<EbayBulkEnvelope>(url, body, {
          headers: {
            Authorization: `Bearer ${context.accessToken}`,
            'Content-Type': 'application/json',
            'Content-Language': context.contentLanguage,
          },
        }),
      { logger: this.logger, acquireBudget: this.chargeInventory(context.priority) }
    );
    return response.data?.responses ?? [];
  }

  /**
   * Overwrite an offer that already existed for this SKU.
   *
   * eBay has no bulk update-offer endpoint (`bulkUpdatePriceQuantity` only
   * carries price and quantity, not category or policies), so this is a single
   * call. It is rare by construction — it only fires when a previous attempt
   * left an offer behind — so it does not affect the batch's call economics.
   */
  private async refreshOffer(
    context: {
      accessToken: string;
      contentLanguage: string;
      marketplaceId: EbayMarketplaceId;
      priority: EbayCallPriority;
    },
    offerId: string,
    config: (typeof EBAY_MARKETPLACE_CONFIG)['EBAY_US'],
    merchantLocationKey: string,
    draft: BulkListingDraft
  ): Promise<void> {
    const payload = buildOfferPayload({
      sku: draft.sku,
      data: draft.data,
      policies: draft.policies,
      config,
      marketplaceId: context.marketplaceId,
      categoryId: draft.categoryId,
      merchantLocationKey,
    });

    try {
      await withEbayRateLimitRetry(
        () =>
          axios.put(`${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/offer/${offerId}`, payload, {
            headers: {
              Authorization: `Bearer ${context.accessToken}`,
              'Content-Type': 'application/json',
              'Content-Language': context.contentLanguage,
            },
          }),
        { logger: this.logger, acquireBudget: this.chargeInventory(context.priority) }
      );
    } catch (error: unknown) {
      // Publishing a possibly-stale offer still beats failing the listing; the
      // next refresh cycle corrects price and quantity either way.
      this.logger.warn(
        `Could not refresh pre-existing offer ${offerId} for ${draft.sku}: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /** Remove an offer eBay orphaned on a system error, so a replay can recreate it. */
  private async deleteOffer(
    context: { accessToken: string; priority: EbayCallPriority },
    offerId: string | undefined
  ): Promise<void> {
    if (!offerId) {
      return;
    }
    try {
      await withEbayRateLimitRetry(
        () =>
          axios.delete(`${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/offer/${offerId}`, {
            headers: { Authorization: `Bearer ${context.accessToken}` },
          }),
        { logger: this.logger, acquireBudget: this.chargeInventory(context.priority) }
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Could not delete orphaned offer ${offerId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Legacy fallback: recover an offer id from its SKU.
   *
   * This is the call migration 067 exists to eliminate. It survives only for
   * listings created before the column existed (and for sandbox rows whose
   * timestamped SKU could not be backfilled); a null answer degrades the update
   * to quantity-only rather than failing it.
   */
  private async lookupOfferId(
    context: { accessToken: string; marketplaceId: string },
    sku: string
  ): Promise<string | null> {
    const url = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`;
    try {
      const response = await withEbayRateLimitRetry(
        () =>
          axios.get<OffersLookupResponse>(url, {
            headers: { Authorization: `Bearer ${context.accessToken}` },
          }),
        { logger: this.logger, acquireBudget: this.chargeInventory(EbayCallPriority.BACKGROUND) }
      );
      const offer = response.data?.offers?.find((candidate) => candidate.marketplaceId === context.marketplaceId);
      return offer?.offerId ?? null;
    } catch (error: unknown) {
      this.logger.warn(
        `Could not resolve an offer id for SKU ${sku}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }
}
