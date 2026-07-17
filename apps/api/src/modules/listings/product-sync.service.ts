import { Injectable, Logger } from '@nestjs/common';
import { ListingStatus } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EbayService } from '../ebay/ebay.service';

import { ListingStrategyService } from './listing-strategy.service';
import { ListingsService } from './listings.service';

/**
 * Fan-out helper for product data changes.
 *
 * The stale-driven refresh pipeline (`RefreshProcessorService`) and the
 * sale-driven stock sync both delegate here: given a product whose Amazon
 * data changed, recompute every active listing sharing it (each per its own
 * settings group) and push to eBay — but only when a listing's price or
 * quantity actually changed (eBay rate-limit hygiene).
 */
@Injectable()
export class ProductSyncService {
  private readonly logger = new Logger(ProductSyncService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly strategyService: ListingStrategyService,
    private readonly ebayService: EbayService,
    private readonly listingsService: ListingsService
  ) {}

  /**
   * Public entry point used by the sale-driven stock-sync queue.
   * Resolves the ASIN for a product, then recomputes + pushes every active
   * listing that shares it (each per its own settings group).
   */
  async syncListingsForProduct(productId: string): Promise<void> {
    const rows = await this.databaseService.query<{ asin: string }>(`SELECT asin FROM products WHERE id = $1`, [
      productId,
    ]);
    if (rows.length === 0) {
      this.logger.debug(`syncListingsForProduct: product ${productId} not found`);
      return;
    }
    await this.updateAllListingsForProduct(productId, rows[0].asin);
  }

  /**
   * Recalculate and push updates to eBay for all listings linked to a product.
   * Groups listings by user for batch processing. Skips the eBay push (and the
   * listing row update) when neither price nor quantity changed — this keeps
   * eBay API call volume proportional to real changes, not to refresh frequency.
   */
  async updateAllListingsForProduct(productId: string, asin: string): Promise<void> {
    interface ListingRow {
      id: string;
      user_id: string;
      listing_settings_group_id: string;
      ebay_item_id: string;
      price: string | null;
      quantity: number | null;
      disable_ordering: boolean;
      disable_repricing: boolean;
      lock_price: boolean;
      lock_quantity: boolean;
      price_override: string | null;
      quantity_override: number | null;
      margin_percent_override: string | null;
      margin_fixed_override: string | null;
    }
    const listings = await this.databaseService.query<ListingRow>(
      `SELECT id, user_id, listing_settings_group_id, ebay_item_id, price, quantity,
              COALESCE(disable_ordering, false) as disable_ordering,
              COALESCE(disable_repricing, false) as disable_repricing,
              COALESCE(lock_price, false) as lock_price,
              COALESCE(lock_quantity, false) as lock_quantity,
              price_override, quantity_override, margin_percent_override, margin_fixed_override
       FROM listings
       WHERE product_id = $1 AND status = '${ListingStatus.ACTIVE}'`,
      [productId]
    );

    if (listings.length === 0) {
      return;
    }

    const productInfo = await this.listingsService.getProductByAsin(asin);
    if (!productInfo) {
      return;
    }

    // Group by user for parallel processing
    const byUser = new Map<string, typeof listings>();
    for (const listing of listings) {
      const group = byUser.get(listing.user_id) || [];
      group.push(listing);
      byUser.set(listing.user_id, group);
    }

    // Process each user's listings in parallel
    const userPromises = Array.from(byUser.entries()).map(async ([userId, userListings]) => {
      for (const listing of userListings) {
        try {
          const strategyResult = await this.strategyService.prepareListingData(
            userId,
            productInfo.data,
            listing.listing_settings_group_id
          );

          // Apply per-listing overrides (easync-style locks / disable flags)
          let finalPrice = strategyResult.price;
          let finalQty = strategyResult.quantity;
          let purchasePrice = strategyResult.purchasePrice;
          let estimatedProfit = strategyResult.estimatedProfit;
          let profitMargin = strategyResult.profitMargin;
          let roi = strategyResult.roi;

          if (listing.disable_ordering) {
            finalQty = 0;
          } else if (listing.lock_quantity) {
            finalQty =
              listing.quantity_override !== null && listing.quantity_override !== undefined
                ? Number(listing.quantity_override)
                : Number(listing.quantity ?? 0);
          }

          if (listing.disable_repricing || listing.lock_price) {
            if (listing.price_override !== null && listing.price_override !== undefined) {
              finalPrice = parseFloat(String(listing.price_override));
            } else if (listing.price !== null && listing.price !== undefined) {
              finalPrice = parseFloat(String(listing.price));
            }
            // Recompute profit metrics vs Amazon cost when price is locked/overridden
            purchasePrice = strategyResult.purchasePrice;
            estimatedProfit = finalPrice - purchasePrice;
            profitMargin = finalPrice > 0 ? (estimatedProfit / finalPrice) * 100 : 0;
            roi = purchasePrice > 0 ? (estimatedProfit / purchasePrice) * 100 : 0;
          } else if (
            listing.margin_percent_override !== null ||
            listing.margin_fixed_override !== null
          ) {
            // Optional margin overrides on top of Amazon cost
            const amazon = strategyResult.purchasePrice;
            const pct = listing.margin_percent_override
              ? parseFloat(String(listing.margin_percent_override))
              : 0;
            const fixed = listing.margin_fixed_override
              ? parseFloat(String(listing.margin_fixed_override))
              : 0;
            finalPrice = amazon * (1 + pct / 100) + fixed;
            estimatedProfit = finalPrice - amazon;
            profitMargin = finalPrice > 0 ? (estimatedProfit / finalPrice) * 100 : 0;
            roi = amazon > 0 ? (estimatedProfit / amazon) * 100 : 0;
          }

          const priceChanged = String(listing.price) !== String(finalPrice);
          const quantityChanged = Number(listing.quantity) !== Number(finalQty);

          // No price/quantity delta → nothing to push to eBay, nothing to persist.
          if (!priceChanged && !quantityChanged) {
            this.logger.debug(
              `Listing ${listing.ebay_item_id} unchanged (price=${finalPrice}, qty=${finalQty}); skipping eBay push`
            );
            continue;
          }

          const sku = `${asin}-NEW`;
          await this.ebayService.updatePriceAndStock(
            userId,
            sku,
            finalPrice,
            finalQty,
            listing.ebay_item_id
          );

          await this.databaseService.query(
            `UPDATE listings
             SET price = $1, quantity = $2, purchase_price = $3,
                 estimated_profit = $4, profit_margin = $5, roi = $6,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $7`,
            [
              finalPrice,
              finalQty,
              purchasePrice,
              estimatedProfit,
              profitMargin,
              roi,
              listing.id,
            ]
          );

          this.logger.debug(
            `Repriced listing ${listing.ebay_item_id} (Price: ${finalPrice}, Stock: ${finalQty})`
          );
        } catch (error: unknown) {
          this.logger.error(
            `Failed to reprice listing ${listing.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    });

    await Promise.allSettled(userPromises);
  }
}
