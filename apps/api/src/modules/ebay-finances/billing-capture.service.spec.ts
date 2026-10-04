import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { EBAY_FINANCES_SCOPE, EbayApiResource } from '@repo/shared';

import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';

import { BillingCaptureService } from './billing-capture.service';
import { BILLING_KEEP_SWEEPS, BILLING_MAX_PAGES, BILLING_PAGE_LIMIT } from './ebay-finances.constants';

type Query = jest.Mock<Promise<unknown[]>, [string, unknown[]?]>;

const activities = (n: number) => Array.from({ length: n }, (_, i) => ({ feeType: i % 2 ? 'A' : 'B' }));

function build(options: {
  enabled?: boolean;
  accounts?: Array<{ id: string; user_id: string }>;
  suspended?: boolean;
  pages?: (accountId: string, offset: number) => Promise<unknown>;
}) {
  const db = {
    query: jest.fn((_sql: string, _params?: unknown[]) =>
      Promise.resolve<unknown[]>(options.accounts ?? [{ id: 'acc-1', user_id: 'user-1' }])
    ) as Query,
  };
  const settings = {
    getBoolean: jest.fn().mockResolvedValue(options.enabled ?? true),
    getNumber: jest.fn((key: string) => Promise.resolve(key.endsWith('windowDays') ? 30 : key.endsWith('intervalHours') ? 4 : 10)),
  };
  const quota = { isSuspended: jest.fn().mockResolvedValue(options.suspended ?? false) };
  const ebay = { getAccountAccessToken: jest.fn((id: string) => Promise.resolve(`token-${id}`)) };
  const client = {
    getBillingActivities: jest.fn((token: string, params: { filter: string; offset: number }) =>
      (options.pages ?? (() => Promise.resolve({ billingActivities: [], total: 0 })))(token.replace('token-', ''), params.offset)
    ),
  };
  const service = new BillingCaptureService(
    db as never,
    settings as never,
    quota as never,
    ebay as never,
    client as never
  );
  return { service, db, client, quota };
}

describe('BillingCaptureService', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-'));
    process.env.EBAY_FINANCES_CAPTURE_DIR = dir;
  });

  afterEach(() => {
    delete process.env.EBAY_FINANCES_CAPTURE_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const filesOf = (accountId: string): string[] => {
    const accountDir = path.join(dir, accountId);
    return fs.existsSync(accountDir) ? fs.readdirSync(accountDir) : [];
  };

  it('does nothing while switched off', async () => {
    const { service, db } = build({ enabled: false });
    await service.runSweep();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('claims only stores that granted sell.finances', async () => {
    const { service, db } = build({ accounts: [] });
    await service.runSweep();
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/granted_scopes @> ARRAY\[\$3\]::text\[\]/);
    expect(sql).toMatch(/last_billing_sync_at/);
    expect(params?.[2]).toBe(EBAY_FINANCES_SCOPE);
  });

  it('never reads a store whose owner is suspended', async () => {
    const { service, client } = build({ suspended: true });
    await service.runSweep();
    expect(client.getBillingActivities).not.toHaveBeenCalled();
  });

  it('follows offset across pages and writes each page verbatim', async () => {
    const sizes = [BILLING_PAGE_LIMIT, BILLING_PAGE_LIMIT, 50];
    const { service, client } = build({
      pages: (_account, offset) => {
        const index = offset / BILLING_PAGE_LIMIT;
        return Promise.resolve({
          billingActivities: activities(sizes[index]),
          total: 450,
          next: index < 2 ? 'https://next' : undefined,
        });
      },
    });
    await service.runSweep();
    expect(client.getBillingActivities.mock.calls.map((call) => call[1].offset)).toEqual([0, 200, 400]);
    const pageFiles = filesOf('acc-1').filter((file) => /-p\d+\.json$/.test(file)).sort();
    expect(pageFiles).toHaveLength(3);
    const first = JSON.parse(fs.readFileSync(path.join(dir, 'acc-1', pageFiles[0]), 'utf8')) as { total: number };
    expect(first.total).toBe(450);
  });

  it('keeps an undocumented body as evidence and stops reading', async () => {
    const { service, client } = build({ pages: () => Promise.resolve(['not', 'an', 'object']) });
    await service.runSweep();
    expect(client.getBillingActivities).toHaveBeenCalledTimes(1);
    expect(filesOf('acc-1')).toHaveLength(1);
  });

  it('stops at the page cap even when eBay keeps saying there is more', async () => {
    const { service, client } = build({
      pages: () => Promise.resolve({ billingActivities: activities(BILLING_PAGE_LIMIT), next: 'https://next' }),
    });
    await service.runSweep();
    expect(client.getBillingActivities).toHaveBeenCalledTimes(BILLING_MAX_PAGES);
  });

  it('names every page of one sweep after the sweep, and marks a clean finish', async () => {
    const { service } = build({
      pages: (_account, offset) =>
        Promise.resolve({
          billingActivities: activities(offset === 0 ? BILLING_PAGE_LIMIT : 10),
          total: BILLING_PAGE_LIMIT + 10,
          next: offset === 0 ? 'https://next' : undefined,
        }),
    });
    await service.runSweep();
    const files = filesOf('acc-1').sort();
    expect(files).toHaveLength(3);
    const prefixes = new Set(files.map((file) => file.split('-')[0]));
    expect(prefixes.size).toBe(1);
    const done = files.find((file) => file.endsWith('-done.json'));
    expect(done).toBeDefined();
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'acc-1', done as string), 'utf8'))).toMatchObject({
      pages: 2,
      lines: BILLING_PAGE_LIMIT + 10,
      total: BILLING_PAGE_LIMIT + 10,
      reachedCap: false,
    });
  });

  it('a read that fails part-way leaves no done marker', async () => {
    const { service } = build({
      pages: (_account, offset) =>
        offset === 0
          ? Promise.resolve({ billingActivities: activities(BILLING_PAGE_LIMIT), total: 1000, next: 'https://next' })
          : Promise.reject(new Error('connection reset')),
    });
    await service.runSweep();
    const files = filesOf('acc-1');
    expect(files).toHaveLength(1);
    expect(files.some((file) => file.endsWith('-done.json'))).toBe(false);
  });

  it('keeps only the newest sweeps of a store on disk', async () => {
    const now = jest.spyOn(Date, 'now');
    try {
      const { service } = build({ pages: () => Promise.resolve({ billingActivities: activities(1), total: 1 }) });
      for (let i = 0; i < BILLING_KEEP_SWEEPS + 3; i += 1) {
        now.mockReturnValue(1_700_000_000_000 + i * 1000);
        await service.runSweep();
      }
      const prefixes = [...new Set(filesOf('acc-1').map((file) => file.split('-')[0]))].sort();
      expect(prefixes).toHaveLength(BILLING_KEEP_SWEEPS);
      expect(prefixes[0]).toBe(String(1_700_000_000_000 + 3 * 1000));
    } finally {
      now.mockRestore();
    }
  });

  it('a spent daily budget stops the tick', async () => {
    const { service, client } = build({
      accounts: [
        { id: 'acc-1', user_id: 'user-1' },
        { id: 'acc-2', user_id: 'user-2' },
      ],
      pages: () => Promise.reject(new EbayBudgetExhaustedError(EbayApiResource.FINANCES, new Date(), 86_400)),
    });
    await service.runSweep();
    expect(client.getBillingActivities).toHaveBeenCalledTimes(1);
  });

  it('one store failing never stops the next', async () => {
    const { service, client } = build({
      accounts: [
        { id: 'acc-1', user_id: 'user-1' },
        { id: 'acc-2', user_id: 'user-2' },
      ],
      pages: (account) =>
        account === 'acc-1'
          ? Promise.reject(new Error('connection reset'))
          : Promise.resolve({ billingActivities: activities(1), total: 1 }),
    });
    await service.runSweep();
    expect(client.getBillingActivities).toHaveBeenCalledTimes(2);
    expect(filesOf('acc-2').filter((file) => file.endsWith('-p0.json'))).toHaveLength(1);
  });
});
