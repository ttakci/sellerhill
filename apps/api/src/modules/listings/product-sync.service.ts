import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { EbayService } from '../ebay/ebay.service';
import { KeepaService } from './keepa.service';
import { ListingStrategyService } from './listing-strategy.service';
import { ListingsService } from './listings.service';
import { ScraperApiService } from './scraper-api.service';

@Injectable()
export class ProductSyncService implements OnModuleInit {
  private readonly logger = new Logger(ProductSyncService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly keepaService: KeepaService,
    private readonly scraperApiService: ScraperApiService,
    private readonly strategyService: ListingStrategyService,
    private readonly ebayService: EbayService,
    private readonly listingsService: ListingsService
  ) {}

  onModuleInit() {
    // Sync logic triggered via BullMQ SyncProcessor
  }

  /**
   * Main sync task. Scans for products needing updates.
   */
  async runSyncCycle(type: 'prices' | 'metadata') {
    this.logger.log(`Starting background sync task: ${type}`);

    if (type === 'prices') {
      await this.syncPricesAndStock();
    } else if (type === 'metadata') {
      await this.syncMetadata();
    }

    this.logger.log(`Sync task ${type} completed.`);
  }

  /**
   * Sync prices and stock using Keepa API
   * Frequency: Every 12 hours (Configured via Cron at 09:00 and 21:00)
   */
  private async syncPricesAndStock() {
    // Fetch ALL active products that need syncing
    const products = await this.databaseService.query(`
      SELECT DISTINCT p.id, p.asin 
      FROM products p
      INNER JOIN listings l ON p.id = l.product_id
      WHERE l.status = 'active'
    `);

    if (products.length === 0) {
      this.logger.log('No active products found for sync.');
      return;
    }

    this.logger.log(`Found ${products.length} products needing Price/Stock sync via Keepa API.`);

    // Process in chunks of 100 (Keepa bulk limit)
    const chunkSize = 100;
    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      const asins = chunk.map((p) => p.asin);

      this.logger.log(`Processing chunk ${i / chunkSize + 1} (${chunk.length} ASINs)`);
      const keepaResults = await this.keepaService.getProducts(asins);

      for (const product of chunk) {
        try {
          const data = keepaResults.find((k) => k.asin === product.asin);
          if (!data) {
            this.logger.warn(`No Keepa data found for ASIN ${product.asin} during sync`);
            continue;
          }

          await this.databaseService.query(
            `
            UPDATE products 
            SET price = jsonb_set(price, '{current}', $1),
                stock = $2,
                raw_keepa_data = $3,
                last_repriced_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
          `,
            [data.price, data.stock, JSON.stringify(data.raw), product.id]
          );

          await this.updateAllListingsForProduct(product.id, product.asin);
        } catch (error: any) {
          this.logger.error(`Keepa sync failed for ASIN ${product.asin}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Sync metadata using ScraperAPI
   * Frequency: Every 30 days
   */
  private async syncMetadata() {
    const products = await this.databaseService.query(`
      SELECT DISTINCT p.id, p.asin 
      FROM products p
      INNER JOIN listings l ON p.id = l.product_id
      WHERE l.status = 'active'
      AND (p.last_sync_at < NOW() - INTERVAL '30 days' OR p.last_sync_at IS NULL)
      LIMIT 50
    `);

    this.logger.log(`Found ${products.length} products needing metadata refresh via ScraperAPI.`);

    for (const product of products) {
      try {
        const data = await this.scraperApiService.getProductDetails(product.asin);
        if (!data) continue;

        await this.listingsService.findOrCreateProduct(product.asin, data);
      } catch (error: any) {
        this.logger.error(`Metadata sync failed for ASIN ${product.asin}: ${error.message}`);
      }
    }
  }

  /**
   * Recalculate and push updates to eBay for all listings linked to a product
   */
  private async updateAllListingsForProduct(productId: string, asin: string) {
    const listings = await this.databaseService.query(
      `
      SELECT id, user_id, listing_settings_group_id, ebay_item_id FROM listings 
      WHERE product_id = $1 AND status = 'active'
    `,
      [productId]
    );

    if (listings.length === 0) return;

    const productInfo = await this.listingsService.getProductByAsin(asin);
    if (!productInfo) return;

    for (const listing of listings) {
      try {
        const strategyResult = await this.strategyService.prepareListingData(
          listing.user_id,
          productInfo.data,
          listing.listing_settings_group_id
        );

        const sku = `${asin}-NEW`;
        await this.ebayService.updatePriceAndStock(
          listing.user_id,
          sku,
          strategyResult.price,
          strategyResult.quantity,
          listing.ebay_item_id
        );

        await this.databaseService.query(
          `
          UPDATE listings 
          SET price = $1, 
              quantity = $2,
              purchase_price = $3,
              estimated_profit = $4,
              profit_margin = $5,
              roi = $6,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $7
        `,
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
          `Repriced listing ${listing.ebay_item_id} for user ${listing.user_id} (New Price: ${strategyResult.price}, New Stock: ${strategyResult.quantity})`
        );
      } catch (error: any) {
        this.logger.error(`Failed to reprice listing ${listing.id}: ${error.message}`);
      }
    }
  }
}
