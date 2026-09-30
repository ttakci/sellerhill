import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { AutoFulfillBlockedReason, AutoFulfillStatus, OrderStatus } from '@repo/shared';

import { AmazonCheckoutService } from './amazon-checkout.service';

/**
 * A fulfillment job that starts and finds its row still RUNNING must not
 * re-enter the checkout: the previous attempt died mid-flight (SIGKILL on
 * deploy, OOM), and the Place Order click may already have gone out. This
 * spec drives `runForOrder` against a fake DB and a rate limiter that fails
 * the test if the checkout is ever scheduled.
 */
describe('AmazonCheckoutService.runForOrder — interrupted attempt', () => {
  let evidenceDir: string;

  beforeAll(() => {
    evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-evidence-'));
    process.env.FULFILLMENT_EVIDENCE_DIR = evidenceDir;
  });

  afterAll(() => {
    delete process.env.FULFILLMENT_EVIDENCE_DIR;
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  });

  function build(status: AutoFulfillStatus) {
    const writes: Array<{ sql: string; params: unknown[] }> = [];
    const db = {
      query: jest.fn((sql: string, params: unknown[] = []): Promise<unknown[]> => {
        if (/^\s*SELECT auto_fulfill_status/.test(sql)) {
          return Promise.resolve([{ auto_fulfill_status: status, user_id: 'u1', status: OrderStatus.WAITING_SHIPMENT }]);
        }
        if (/^\s*SELECT user_id/.test(sql)) {
          return Promise.resolve([{ user_id: 'u1' }]);
        }
        writes.push({ sql, params });
        return Promise.resolve([]);
      }),
    };
    const rateLimiter = {
      schedule: jest.fn((): Promise<void> => Promise.reject(new Error('checkout must not run for an interrupted attempt'))),
    };
    const quotaEnforcement = {
      isSuspended: jest.fn((): Promise<boolean> => Promise.resolve(false)),
      releaseAmazonOrder: jest.fn((): Promise<void> => Promise.resolve()),
    };
    // The evidence dir is read from the env at construction, so the service
    // is built here, after `beforeAll` pointed it at a temp directory.
    const service = new AmazonCheckoutService(
      db as never,
      {} as never,
      rateLimiter as never,
      {} as never,
      {} as never,
      {} as never,
      quotaEnforcement as never,
      {} as never
    );
    return { service, writes, rateLimiter, quotaEnforcement };
  }

  it('blocks a RUNNING row with INTERRUPTED and never schedules the checkout', async () => {
    const { service, writes, rateLimiter, quotaEnforcement } = build(AutoFulfillStatus.RUNNING);

    await service.runForOrder('eb-1', 'acc-1');

    expect(rateLimiter.schedule).not.toHaveBeenCalled();
    const statusWrite = writes.find((w) => /UPDATE orders SET auto_fulfill_status/.test(w.sql));
    expect(statusWrite?.params.slice(0, 2)).toEqual([AutoFulfillStatus.BLOCKED, AutoFulfillBlockedReason.INTERRUPTED]);
    expect(quotaEnforcement.releaseAmazonOrder).toHaveBeenCalledWith('u1', 'eb-1');
  });

  it('still schedules the checkout from PENDING (the normal path)', async () => {
    const { service, rateLimiter } = build(AutoFulfillStatus.PENDING);

    await expect(service.runForOrder('eb-1', 'acc-1')).rejects.toThrow('checkout must not run');

    expect(rateLimiter.schedule).toHaveBeenCalledTimes(1);
  });
});
