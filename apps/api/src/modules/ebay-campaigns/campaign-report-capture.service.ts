import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { PlatformSettingKey } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { EbayService } from '../ebay/ebay.service';

import { CampaignReportRequest, CampaignReportTask, EbayMarketingClient } from './ebay-marketing.client';

const POLL_ATTEMPTS = 6;
const POLL_INTERVAL_MS = 10_000;
const CAPTURES_PER_STORE = 3;
const OWNED_FILE = /^\d+\.tsv\.gz$/;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Capture eBay's campaign report bytes before any parser or metrics writes exist. */
@Injectable()
export class CampaignReportCaptureService {
  private readonly logger = new Logger(CampaignReportCaptureService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly settings: PlatformSettingsService,
    private readonly ebay: EbayService,
    private readonly marketing: EbayMarketingClient
  ) {}

  async runSweep(): Promise<void> {
    if (!(await this.settings.getBoolean(PlatformSettingKey.EBAY_CAMPAIGN_REPORTS_ENABLED))) {
      return;
    }
    // The captureOnly flag is deliberately informational in this phase: even
    // when an operator turns it off, there is no parser or metrics write path.
    await this.settings.getBoolean(PlatformSettingKey.EBAY_CAMPAIGN_REPORTS_CAPTURE_ONLY);
    const accounts = await this.database.query<{ id: string; user_id: string }>(
      `WITH due AS (
         SELECT id FROM ebay_accounts
          WHERE status = 'active'
            AND (last_campaign_report_at IS NULL OR last_campaign_report_at < NOW() - INTERVAL '24 hours')
            AND EXISTS (SELECT 1 FROM ebay_campaigns c WHERE c.ebay_account_id = ebay_accounts.id)
          ORDER BY last_campaign_report_at ASC NULLS FIRST, id ASC
          LIMIT 5 FOR UPDATE SKIP LOCKED
       ) UPDATE ebay_accounts a SET last_campaign_report_at = NOW()
          FROM due WHERE a.id = due.id RETURNING a.id, a.user_id`,
      []
    );
    for (const account of accounts) {
      try {
        await this.captureAccount(account);
      } catch (error: unknown) {
        this.logger.warn(`Campaign report capture failed for ${account.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async captureAccount(account: { id: string; user_id: string }): Promise<void> {
    const campaigns = await this.database.query<{ campaign_id: string }>(
      `SELECT campaign_id FROM ebay_campaigns WHERE ebay_account_id = $1 AND funding_model = 'COST_PER_SALE' ORDER BY campaign_id`,
      [account.id]
    );
    if (campaigns.length === 0) {
      return;
    }
    const ctx = await this.ebay.getAccountApiContext(account.id);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 31);
    const request: CampaignReportRequest = {
      reportType: 'CAMPAIGN_PERFORMANCE_REPORT',
      reportFormat: 'TSV_GZIP',
      marketplaceId: ctx.marketplaceId,
      dateFrom: from.toISOString(),
      dateTo: today.toISOString(),
      fundingModels: ['COST_PER_SALE'],
      campaignIds: campaigns.map((campaign) => campaign.campaign_id),
      dimensions: [{ dimensionKey: 'campaign_id', annotationKeys: ['campaign_name'] }],
      metricKeys: ['impressions', 'clicks', 'ad_fees', 'sales', 'sale_amount', 'ctr', 'avg_cost_per_sale'],
    };
    const taskId = await this.marketing.createReportTask(ctx, request);
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        await sleep(POLL_INTERVAL_MS);
      }
      const task: CampaignReportTask = await this.marketing.getReportTask(ctx, taskId);
      if (task.reportTaskStatus === 'FAILED') {
        this.logger.warn(`Campaign report task ${taskId} failed for ${account.id}: ${task.reportTaskStatusMessage ?? 'unknown'}`);
        return;
      }
      if (task.reportTaskStatus === 'SUCCESS') {
        if (!task.reportId) {
          this.logger.warn(`Campaign report task ${taskId} has no reportId for ${account.id}`);
          return;
        }
        const body = await this.marketing.downloadReport(ctx, task.reportId);
        await this.captureBytes(account.id, body);
        return;
      }
    }
    this.logger.warn(`Campaign report task ${taskId} did not complete for ${account.id}`);
  }

  private async captureBytes(accountId: string, body: Buffer): Promise<void> {
    // Database IDs are UUIDs, but validate again at this filesystem boundary.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId)) {
      throw new Error('Invalid eBay account id for report capture');
    }
    const root = path.resolve(process.env.EBAY_CAMPAIGN_REPORT_CAPTURE_DIR || path.join(process.cwd(), 'logs', 'ebay-campaign-reports'));
    const dir = path.resolve(root, accountId);
    if (path.relative(root, dir) !== accountId) {
      throw new Error('Campaign report capture path escaped its root');
    }
    await fs.mkdir(root, { recursive: true });
    await fs.mkdir(dir, { recursive: true });
    if ((await fs.lstat(dir)).isSymbolicLink()) {
      throw new Error('Campaign report capture store directory is a symlink');
    }
    const file = path.resolve(dir, `${Date.now()}.tsv.gz`);
    if (path.dirname(file) !== dir) {
      throw new Error('Campaign report capture file escaped its store directory');
    }
    await fs.writeFile(file, body, { flag: 'wx' });
    this.logger.log(`Captured campaign report for ${accountId}: ${body.length} bytes at ${file}`);
    await this.pruneCaptures(root, dir);
  }

  private async pruneCaptures(root: string, dir: string): Promise<void> {
    const names = (await fs.readdir(dir)).filter((name) => OWNED_FILE.test(name)).sort((a, b) => Number(b.slice(0, -7)) - Number(a.slice(0, -7)));
    for (const name of names.slice(CAPTURES_PER_STORE)) {
      const file = path.resolve(dir, name);
      if (path.relative(root, file).startsWith('..') || path.dirname(file) !== dir) {
        throw new Error('Campaign report retention path escaped its root');
      }
      if ((await fs.lstat(file)).isFile()) {
        await fs.unlink(file);
      }
    }
  }
}
