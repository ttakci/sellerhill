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
    }
    const listings = await this.databaseService.query<ListingRow>(
      `SELECT id, user_id, listing_settings_group_id, ebay_item_id, price, quantity FROM listings
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

          const priceChanged = String(listing.price) !== String(strategyResult.price);
          const quantityChanged = Number(listing.quantity) !== Number(strategyResult.quantity);

          // No price/quantity delta → nothing to push to eBay, nothing to persist.
          if (!priceChanged && !quantityChanged) {
            this.logger.debug(
              `Listing ${listing.ebay_item_id} unchanged (price=${strategyResult.price}, qty=${strategyResult.quantity}); skipping eBay push`
            );
            continue;
          }

          const sku = `${asin}-NEW`;
          await this.ebayService.updatePriceAndStock(
            userId,
            sku,
            strategyResult.price,
            strategyResult.quantity,
            listing.ebay_item_id
          );

          await this.databaseService.query(
            `UPDATE listings
             SET price = $1, quantity = $2, purchase_price = $3,
                 estimated_profit = $4, profit_margin = $5, roi = $6,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $7`,
            [
              strategyResult.price,
              strategyResult.quantity,
              strategyResult.purchasePrice,
              strategyResult.estimatedProfit,
              strategyResult.profitMargin,
              strategyResult.roi,
              listing.id,
            ]
          );

          this.logger.debug(
            `Repriced listing ${listing.ebay_item_id} (Price: ${strategyResult.price}, Stock: ${strategyResult.quantity})`
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
