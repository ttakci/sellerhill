import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { PlatformSettingKey } from '@repo/shared';

import { CampaignReportCaptureService } from './campaign-report-capture.service';

const account = { id: '70a7a1a2-5345-4a52-9066-51b5847b5a34', user_id: 'u1' };
const bytes = Buffer.from([0x1f, 0x8b, 0x00, 0xff, 0x41]);

describe('CampaignReportCaptureService', () => {
  let directory: string;
  let database: { query: jest.Mock };
  let settings: { getBoolean: jest.Mock };
  let ebay: { getAccountApiContext: jest.Mock };
  let marketing: { createReportTask: jest.Mock; getReportTask: jest.Mock; downloadReport: jest.Mock };
  let service: CampaignReportCaptureService;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'campaign-report-'));
    process.env.EBAY_CAMPAIGN_REPORT_CAPTURE_DIR = directory;
    database = { query: jest.fn().mockResolvedValue([account]) };
    settings = { getBoolean: jest.fn().mockResolvedValue(true) };
    ebay = { getAccountApiContext: jest.fn().mockResolvedValue({ accessToken: 'tok', marketplaceId: 'EBAY_US' }) };
    marketing = {
      createReportTask: jest.fn().mockResolvedValue('task1'),
      getReportTask: jest.fn().mockResolvedValue({ reportTaskStatus: 'SUCCESS', reportId: 'report1' }),
      downloadReport: jest.fn().mockResolvedValue(bytes),
    };
    service = new CampaignReportCaptureService(database as never, settings as never, ebay as never, marketing as never);
  });

  afterEach(async () => {
    delete process.env.EBAY_CAMPAIGN_REPORT_CAPTURE_DIR;
    await fs.rm(directory, { recursive: true, force: true });
    jest.useRealTimers();
  });

  it('does not touch the database when disabled', async () => {
    settings.getBoolean.mockResolvedValue(false);
    await service.runSweep();
    expect(settings.getBoolean).toHaveBeenCalledWith(PlatformSettingKey.EBAY_CAMPAIGN_REPORTS_ENABLED);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('claims five due active stores with campaigns, skips locked rows, and stamps the report watermark', async () => {
    database.query.mockResolvedValueOnce([]);
    await service.runSweep();
    expect(database.query).toHaveBeenCalledTimes(1);
    const [sql, params] = database.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/last_campaign_report_at\s+IS NULL/i);
    expect(sql).toMatch(/last_campaign_report_at\s*<\s*NOW\(\)\s*-\s*INTERVAL\s*'24 hours'/i);
    expect(sql).toMatch(/status\s*=\s*'active'/i);
    expect(sql).toMatch(/EXISTS\s*\(\s*SELECT 1 FROM ebay_campaigns/i);
    expect(sql).toMatch(/LIMIT\s+5\s+FOR UPDATE SKIP LOCKED/i);
    expect(sql).toMatch(/SET last_campaign_report_at\s*=\s*NOW\(\)/i);
    expect(params).toEqual([]);
  });

  it('does not create a task for a store without CPS campaigns', async () => {
    database.query.mockResolvedValueOnce([account]).mockResolvedValueOnce([]);
    await service.runSweep();
    const secondCall = database.query.mock.calls[1] as [string, unknown[]];
    expect(secondCall[0]).toMatch(/funding_model\s*=\s*'COST_PER_SALE'/i);
    expect(marketing.createReportTask).not.toHaveBeenCalled();
  });

  it('requests the documented keys, captures exact bytes, and never updates campaign metrics even when captureOnly is false', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-05T13:45:00.000Z'));
    settings.getBoolean.mockImplementation((key: PlatformSettingKey) =>
      Promise.resolve(key !== PlatformSettingKey.EBAY_CAMPAIGN_REPORTS_CAPTURE_ONLY)
    );
    database.query.mockResolvedValueOnce([account]).mockResolvedValueOnce([{ campaign_id: 'c1' }, { campaign_id: 'c2' }]);
    await service.runSweep();
    expect(marketing.createReportTask).toHaveBeenCalledWith(expect.objectContaining({ marketplaceId: 'EBAY_US' }), {
      reportType: 'CAMPAIGN_PERFORMANCE_REPORT',
      reportFormat: 'TSV_GZIP',
      marketplaceId: 'EBAY_US',
      dateFrom: '2026-09-04T00:00:00.000Z',
      dateTo: '2026-10-05T00:00:00.000Z',
      fundingModels: ['COST_PER_SALE'],
      campaignIds: ['c1', 'c2'],
      dimensions: [{ dimensionKey: 'campaign_id', annotationKeys: ['campaign_name'] }],
      metricKeys: ['impressions', 'clicks', 'ad_fees', 'sales', 'sale_amount', 'ctr', 'avg_cost_per_sale'],
    });
    const files = await fs.readdir(path.join(directory, account.id));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.tsv\.gz$/);
    expect(await fs.readFile(path.join(directory, account.id, files[0]))).toEqual(bytes);
    expect(database.query.mock.calls.map(([sql]) => String(sql).toLowerCase()).join('\n')).not.toMatch(/update\s+ebay_campaigns/);
  });

  it('stops a failed task without a download or a file', async () => {
    database.query.mockResolvedValueOnce([account]).mockResolvedValueOnce([{ campaign_id: 'c1' }]);
    marketing.getReportTask.mockResolvedValue({ reportTaskStatus: 'FAILED', reportTaskStatusMessage: 'bad request' });
    await expect(service.runSweep()).resolves.toBeUndefined();
    expect(marketing.downloadReport).not.toHaveBeenCalled();
    await expect(fs.readdir(path.join(directory, account.id))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects an untrusted report href with no report id without downloading or writing', async () => {
    database.query.mockResolvedValueOnce([account]).mockResolvedValueOnce([{ campaign_id: 'c1' }]);
    marketing.getReportTask.mockResolvedValue({ reportTaskStatus: 'SUCCESS', reportHref: 'https://attacker.test/steal' });
    await expect(service.runSweep()).resolves.toBeUndefined();
    expect(marketing.downloadReport).not.toHaveBeenCalled();
    await expect(fs.readdir(path.join(directory, account.id))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps three service-owned captures and leaves unrelated files intact', async () => {
    const storeDir = path.join(directory, account.id);
    await fs.mkdir(storeDir);
    for (const name of ['100.tsv.gz', '200.tsv.gz', '300.tsv.gz', 'notes.txt']) {
      await fs.writeFile(path.join(storeDir, name), name);
    }
    database.query.mockResolvedValueOnce([account]).mockResolvedValueOnce([{ campaign_id: 'c1' }]);
    await service.runSweep();
    const files = await fs.readdir(storeDir);
    expect(files).toContain('notes.txt');
    expect(files).not.toContain('100.tsv.gz');
    expect(files.filter((name) => name.endsWith('.tsv.gz'))).toHaveLength(3);
  });
});
