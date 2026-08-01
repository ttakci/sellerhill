import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EbayListingApiModel,
  ListingJobKind,
  ListingJobStatus,
  ListingStatus,
  ListingTrackingState,
  type EbayListingSyncResult,
  type ExistingListingImportQueueData,
  type ListingImportDefaults,
  type ListingImportResult,
} from '@repo/shared';
import { Queue } from 'bullmq';
import ExcelJS from 'exceljs';

import { DatabaseService } from '../../common/database/database.service';
import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';
import { EbayService } from '../ebay/ebay.service';

import { ListingProcessorService } from './listing-processor.service';

interface ImportRow { row: number; asin: string; ebayItemId: string }

@Injectable()
export class ListingImportService {
  constructor(
    private readonly database: DatabaseService,
    private readonly ebay: EbayService,
    @Inject(forwardRef(() => ListingProcessorService))
    private readonly listingProcessor: ListingProcessorService,
    @InjectQueue('listings') private readonly listingQueue: Queue
  ) {}

  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Listings');
    sheet.columns = [
      { header: 'Amazon ASIN', key: 'asin', width: 18 },
      { header: 'eBay Item ID', key: 'ebayItemId', width: 24 },
    ];
    sheet.addRow({ asin: 'B0DCW25WP1', ebayItemId: '317337000000' });
    sheet.getColumn('ebayItemId').numFmt = '@';
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async syncStore(userId: string, ebayAccountId: string): Promise<EbayListingSyncResult> {
    await this.assertAccountOwner(userId, ebayAccountId);
    const remote = await this.ebay.discoverActiveListings(ebayAccountId);
    const seen = remote.map((item) => item.ebayItemId);
    for (const item of remote) {
      await this.database.query(
        `INSERT INTO ebay_listing_discoveries
          (user_id, ebay_account_id, ebay_item_id, sku, title, price, quantity, quantity_sold,
           image_url, marketplace_id, api_model, tracking_state, last_seen_at, ended_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NULL)
         ON CONFLICT (ebay_account_id, ebay_item_id) DO UPDATE SET
           sku=EXCLUDED.sku, title=EXCLUDED.title, price=EXCLUDED.price,
           quantity=EXCLUDED.quantity, quantity_sold=EXCLUDED.quantity_sold,
           image_url=EXCLUDED.image_url, marketplace_id=EXCLUDED.marketplace_id,
           api_model=EXCLUDED.api_model, last_seen_at=NOW(), ended_at=NULL`,
        [userId, ebayAccountId, item.ebayItemId, item.sku ?? null, item.title, item.price,
          item.quantity, item.quantitySold, item.imageUrl ?? null, item.marketplaceId,
          item.apiModel, ListingTrackingState.UNTRACKED]
      );
    }
    const common = [userId, ebayAccountId, ListingTrackingState.UNTRACKED];
    const ended = seen.length
      ? await this.database.query<{ id: string }>(
          `UPDATE ebay_listing_discoveries SET ended_at=NOW()
           WHERE user_id=$1 AND ebay_account_id=$2 AND tracking_state=$3 AND ended_at IS NULL
             AND ebay_item_id NOT IN (SELECT jsonb_array_elements_text($4::jsonb)) RETURNING id`,
          [...common, JSON.stringify(seen)]
        )
      : await this.database.query<{ id: string }>(
          `UPDATE ebay_listing_discoveries SET ended_at=NOW()
           WHERE user_id=$1 AND ebay_account_id=$2 AND tracking_state=$3 AND ended_at IS NULL RETURNING id`, common);
    const untracked = await this.database.query<{ count: string }>(
      `SELECT COUNT(*)::text count FROM ebay_listing_discoveries
       WHERE user_id=$1 AND ebay_account_id=$2 AND tracking_state=$3 AND ended_at IS NULL`, common);
    return { discovered: remote.length, untracked: Number(untracked[0]?.count ?? 0), ended: ended.length };
  }

  async importWorkbook(userId: string, ebayAccountId: string, file: Buffer, defaults: ListingImportDefaults): Promise<ListingImportResult> {
    await this.assertAccountOwner(userId, ebayAccountId);
    const rows = await this.parseWorkbook(file);
    const job = await this.database.transaction(async (client) => {
      const jobs = await client.query<{ id: string }>(
        `INSERT INTO listing_jobs
          (user_id,total_asins,status,kind,ebay_account_id,listing_settings_group_id,payment_policy_id,shipping_policy_id,return_policy_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [userId, rows.length, ListingJobStatus.PENDING, ListingJobKind.EXISTING_IMPORT, ebayAccountId,
          defaults.listingSettingsGroupId, defaults.paymentPolicyId, defaults.shippingPolicyId, defaults.returnPolicyId]);
      const items: Array<{ id: string; asin: string; ebayItemId: string }> = [];
      for (const row of rows) {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO listing_job_items (job_id,asin,status,source_row,source_ebay_item_id)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [jobs.rows[0].id, row.asin, ListingStatus.RETRYING, row.row, row.ebayItemId]);
        items.push({ id: inserted.rows[0].id, asin: row.asin, ebayItemId: row.ebayItemId });
      }
      return { id: jobs.rows[0].id, items };
    });
    await this.listingQueue.addBulk(job.items.map((item) => ({
      name: 'import-existing-listing',
      data: stampCurrentCorrelation({
        kind: ListingJobKind.EXISTING_IMPORT, jobId: job.id, listingJobItemId: item.id,
        userId, asin: item.asin, ebayItemId: item.ebayItemId, ebayAccountId, ...defaults,
      } as ExistingListingImportQueueData),
      opts: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: false },
    })));
    return { jobId: job.id, total: rows.length };
  }

  async processImport(data: ExistingListingImportQueueData): Promise<void> {
    const discovery = (await this.database.query<{
      id: string; title: string; price: string; quantity: number; quantity_sold: number; api_model: EbayListingApiModel;
    }>(`SELECT * FROM ebay_listing_discoveries WHERE user_id=$1 AND ebay_account_id=$2 AND ebay_item_id=$3 AND ended_at IS NULL`,
      [data.userId, data.ebayAccountId, data.ebayItemId]))[0];
    if (!discovery) {throw new NotFoundException('eBay listing was not found in the latest store sync');}
    if ((await this.database.query<{ id: string }>(`SELECT id FROM listings WHERE user_id=$1 AND ebay_item_id=$2`, [data.userId, data.ebayItemId]))[0]) {
      throw new BadRequestException('eBay listing is already tracked');
    }
    const { productData, productId } = await this.listingProcessor.resolveProductData(data.asin, data.userId);
    if (discovery.api_model === EbayListingApiModel.LEGACY) {
      await this.ebay.migrateLegacyListing(data.ebayAccountId, data.ebayItemId);
    }
    const strategy = await this.listingProcessor.prepareImportedListingData(
      data.userId, productData, data.listingSettingsGroupId, data.ebayAccountId);
    await this.database.transaction(async (client) => {
      const listing = await client.query<{ id: string }>(
        `INSERT INTO listings
          (user_id,asin,product_id,listing_settings_group_id,ebay_item_id,payment_policy_id,shipping_policy_id,
           return_policy_id,title,price,purchase_price,estimated_profit,profit_margin,roi,sold_count,quantity,status,
           ebay_account_id,imported_from_ebay)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,TRUE) RETURNING id`,
        [data.userId, data.asin, productId, data.listingSettingsGroupId, data.ebayItemId, data.paymentPolicyId,
          data.shippingPolicyId, data.returnPolicyId, discovery.title, Number(discovery.price), strategy.purchasePrice,
          strategy.estimatedProfit, strategy.profitMargin, strategy.roi, discovery.quantity_sold, discovery.quantity,
          ListingStatus.ACTIVE, data.ebayAccountId]);
      await client.query(`UPDATE ebay_listing_discoveries SET tracking_state=$1,api_model=$2 WHERE id=$3`,
        [ListingTrackingState.TRACKED, EbayListingApiModel.INVENTORY, discovery.id]);
      await client.query(
        `UPDATE listing_job_items SET product_id=$1,listing_id=$2,status=$3,ebay_item_id=$4,updated_at=NOW() WHERE id=$5`,
        [productId, listing.rows[0].id, ListingStatus.ACTIVE, data.ebayItemId, data.listingJobItemId]);
    });
    await this.updateJobCounts(data.jobId);
  }

  async markFailure(data: ExistingListingImportQueueData, message: string, terminal: boolean): Promise<void> {
    await this.database.query(
      `UPDATE listing_job_items SET status=$1,error_message=$2,updated_at=NOW() WHERE id=$3`,
      [terminal ? ListingStatus.ERROR : ListingStatus.RETRYING, message, data.listingJobItemId]);
    await this.updateJobCounts(data.jobId);
  }

  private async updateJobCounts(jobId: string): Promise<void> {
    await this.database.query(
      `UPDATE listing_jobs SET
         processed_count=(SELECT COUNT(*) FROM listing_job_items WHERE job_id=$1 AND status IN ($2,$3)),
         success_count=(SELECT COUNT(*) FROM listing_job_items WHERE job_id=$1 AND status=$2),
         failed_count=(SELECT COUNT(*) FROM listing_job_items WHERE job_id=$1 AND status=$3),
         status=CASE
           WHEN NOT EXISTS (SELECT 1 FROM listing_job_items WHERE job_id=$1 AND status NOT IN ($2,$3))
             THEN CASE WHEN EXISTS (SELECT 1 FROM listing_job_items WHERE job_id=$1 AND status=$3) THEN $4 ELSE $5 END
           ELSE $6 END,
         updated_at=NOW()
       WHERE id=$1`,
      [jobId, ListingStatus.ACTIVE, ListingStatus.ERROR, ListingJobStatus.FAILED,
        ListingJobStatus.COMPLETED, ListingJobStatus.PROCESSING]
    );
  }

  private async parseWorkbook(file: Buffer): Promise<ImportRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file);
    const sheet = workbook.worksheets[0];
    if (!sheet) {throw new BadRequestException('Workbook has no worksheet');}
    const header = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, column) => header.set(cell.text.trim().toLowerCase(), column));
    const asinColumn = header.get('amazon asin') ?? header.get('source product id');
    const itemColumn = header.get('ebay item id') ?? header.get('target product id') ?? header.get('target original id');
    if (!asinColumn || !itemColumn) {throw new BadRequestException('Required columns: Amazon ASIN and eBay Item ID');}
    const rows: ImportRow[] = [];
    for (let index = 2; index <= sheet.rowCount; index++) {
      const asin = sheet.getRow(index).getCell(asinColumn).text.trim().toUpperCase();
      const ebayItemId = sheet.getRow(index).getCell(itemColumn).text.trim().replace(/[, .]/g, '');
      if (!asin && !ebayItemId) {continue;}
      if (!/^B[A-Z0-9]{9}$/.test(asin)) {throw new BadRequestException(`Row ${index}: invalid ASIN`);}
      if (!/^\d{9,20}$/.test(ebayItemId)) {throw new BadRequestException(`Row ${index}: eBay Item ID must be exact text, not scientific notation`);}
      rows.push({ row: index, asin, ebayItemId });
    }
    if (!rows.length) {throw new BadRequestException('Workbook contains no listing rows');}
    return rows;
  }

  private async assertAccountOwner(userId: string, accountId: string): Promise<void> {
    if (!(await this.database.query<{ id: string }>(`SELECT id FROM ebay_accounts WHERE id=$1 AND user_id=$2`, [accountId, userId]))[0]) {
      throw new NotFoundException('eBay account not found');
    }
  }
}
