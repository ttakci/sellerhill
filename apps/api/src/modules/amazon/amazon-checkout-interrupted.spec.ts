import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { AutoFulfillBlockedReason, AutoFulfillStatus, OrderStatus } from '@repo/shared';

import { AmazonCheckoutService } from './amazon-checkout.service';
import type { PrePurchaseDecision } from './auto-fulfill-helpers';

/**
 * `runForOrder` before the checkout starts, driven against a fake DB and a
 * rate limiter that fails the test if the checkout is ever scheduled when it
 * must not be.
 *
 * Two facts decide whether a job may enter the checkout:
 *  - the CLICK STAMP (`orders.auto_fulfill_submitted_at`): once the Place
 *    Order click was sent and the order is not PLACED, nothing re-enters;
 *  - the LIVE eBay sale (`recheckBeforePurchase`): a cancelled, shipped,
 *    multi-item or cancel-requested sale is not bought.
 */
describe('AmazonCheckoutService.runForOrder — gates before the checkout', () => {
  let evidenceDir: string;

  beforeAll(() => {
    evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-evidence-'));
    process.env.FULFILLMENT_EVIDENCE_DIR = evidenceDir;
  });

  afterAll(() => {
    delete process.env.FULFILLMENT_EVIDENCE_DIR;
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  });

  function build(opts: {
    status: AutoFulfillStatus;
    submittedAt?: Date | null;
    amazonOrderId?: string | null;
    prePurchase?: PrePurchaseDecision;
    recheckThrows?: boolean;
  }) {
    const writes: Array<{ sql: string; params: unknown[] }> = [];
    const db = {
      query: jest.fn((sql: string, params: unknown[] = []): Promise<unknown[]> => {
        if (/^\s*SELECT auto_fulfill_status/.test(sql)) {
          return Promise.resolve([
            {
              auto_fulfill_status: opts.status,
              user_id: 'u1',
              status: OrderStatus.WAITING_SHIPMENT,
              auto_fulfill_submitted_at: opts.submittedAt ?? null,
              amazon_order_id: opts.amazonOrderId ?? null,
            },
          ]);
        }
        if (/^\s*SELECT user_id/.test(sql)) {
          return Promise.resolve([{ user_id: 'u1' }]);
        }
        writes.push({ sql, params });
        return Promise.resolve([]);
      }),
    };
    const rateLimiter = {
      schedule: jest.fn((): Promise<void> => Promise.reject(new Error('checkout was scheduled'))),
    };
    const quotaEnforcement = {
      isSuspended: jest.fn((): Promise<boolean> => Promise.resolve(false)),
      releaseAmazonOrder: jest.fn((): Promise<void> => Promise.resolve()),
    };
    const orderSync = {
      recheckBeforePurchase: jest.fn(
        (): Promise<PrePurchaseDecision> =>
          opts.recheckThrows
            ? Promise.reject(new Error('eBay unreachable'))
            : Promise.resolve(opts.prePurchase ?? { proceed: true })
      ),
    };
    const orderSyncQueue = { enqueueAccount: jest.fn((): Promise<void> => Promise.resolve()) };
    const events = { record: jest.fn((): Promise<void> => Promise.resolve()) };
    // The evidence dir is read from the env at construction, so the service
    // is built here, after `beforeAll` pointed it at a temp directory.
    const service = new AmazonCheckoutService(
      db as never,
      {} as never,
      rateLimiter as never,
      {} as never,
      orderSync as never,
      {} as never,
      quotaEnforcement as never,
      {} as never,
      orderSyncQueue as never,
      events as never
    );
    const statusWrites = () => writes.filter((w) => /UPDATE orders SET auto_fulfill_status/.test(w.sql));
    return { service, writes, statusWrites, rateLimiter, quotaEnforcement, orderSync, orderSyncQueue, events };
  }

  const stamp = new Date('2026-10-01T10:00:00Z');

  describe('the click stamp', () => {
    it('never re-enters a RUNNING row whose click was stamped: unknown outcome, reconciliation queued', async () => {
      const h = build({ status: AutoFulfillStatus.RUNNING, submittedAt: stamp });

      await h.service.runForOrder('eb-1', 'acc-1');

      expect(h.rateLimiter.schedule).not.toHaveBeenCalled();
      expect(h.orderSync.recheckBeforePurchase).not.toHaveBeenCalled();
      expect(h.statusWrites()[0]?.params.slice(0, 2)).toEqual([
        AutoFulfillStatus.BLOCKED,
        AutoFulfillBlockedReason.INTERRUPTED,
      ]);
      // A delayed scan of that account's orders (the delay lets Amazon's list catch up).
      const [accountId, options] = h.orderSyncQueue.enqueueAccount.mock.calls[0] as unknown as [
        string,
        { delayMs?: number },
      ];
      expect(accountId).toBe('acc-1');
      expect(typeof options.delayMs).toBe('number');
      expect(options.delayMs).toBeGreaterThan(0);
    });

    it('keeps the reason of a stamped row that is already blocked (no_confirmation) and still reconciles', async () => {
      const h = build({ status: AutoFulfillStatus.BLOCKED, submittedAt: stamp });

      await h.service.runForOrder('eb-1', 'acc-1');

      expect(h.rateLimiter.schedule).not.toHaveBeenCalled();
      expect(h.statusWrites()).toHaveLength(0);
      expect(h.orderSyncQueue.enqueueAccount).toHaveBeenCalledTimes(1);
    });

    it.each([AutoFulfillStatus.PENDING, AutoFulfillStatus.FAILED])(
      'never re-enters a stamped %s row either — the status is not what proves the click',
      async (status) => {
        const h = build({ status, submittedAt: stamp });

        await h.service.runForOrder('eb-1', 'acc-1');

        expect(h.rateLimiter.schedule).not.toHaveBeenCalled();
      }
    );

    it('RE-ENTERS a RUNNING row with no stamp: the previous process died before the click', async () => {
      const h = build({ status: AutoFulfillStatus.RUNNING });

      await expect(h.service.runForOrder('eb-1', 'acc-1')).rejects.toThrow('checkout was scheduled');

      expect(h.rateLimiter.schedule).toHaveBeenCalledTimes(1);
    });

    it('does nothing for a stamped row that is PLACED', async () => {
      const h = build({ status: AutoFulfillStatus.PLACED, submittedAt: stamp });

      await h.service.runForOrder('eb-1', 'acc-1');

      expect(h.rateLimiter.schedule).not.toHaveBeenCalled();
      expect(h.writes).toHaveLength(0);
      expect(h.orderSyncQueue.enqueueAccount).not.toHaveBeenCalled();
    });
  });

  // The manual link never touches `auto_fulfill_status`, so a job that waited
  // in the queue while the seller bought the item by hand still finds PENDING.
  describe('an order somebody already bought', () => {
    it('is not bought again: no eBay re-check, no checkout, settled as SKIPPED', async () => {
      const h = build({ status: AutoFulfillStatus.PENDING, amazonOrderId: '113-1234567-1234567' });

      await h.service.runForOrder('eb-1', 'acc-1');

      expect(h.orderSync.recheckBeforePurchase).not.toHaveBeenCalled();
      expect(h.rateLimiter.schedule).not.toHaveBeenCalled();
      expect(h.statusWrites()[0]?.params[0]).toBe(AutoFulfillStatus.SKIPPED);
      expect(h.quotaEnforcement.releaseAmazonOrder).toHaveBeenCalledWith('u1', 'eb-1');
    });

    it('a dry-run placeholder id is not a purchase — the checkout still runs', async () => {
      const h = build({ status: AutoFulfillStatus.PENDING, amazonOrderId: 'SIM-113-1234567-1234567' });

      await expect(h.service.runForOrder('eb-1', 'acc-1')).rejects.toThrow('checkout was scheduled');
    });
  });

  it('every status write refuses to move a row out of PLACED', async () => {
    const h = build({ status: AutoFulfillStatus.RUNNING, submittedAt: stamp });

    await h.service.runForOrder('eb-1', 'acc-1');

    const write = h.statusWrites()[0];
    expect(write?.sql).toContain('auto_fulfill_status <> $4');
    expect(write?.params[3]).toBe(AutoFulfillStatus.PLACED);
  });

  describe('settleIfClickWasSent', () => {
    it('answers false and writes nothing when no click was stamped', async () => {
      const h = build({ status: AutoFulfillStatus.RUNNING });

      await expect(h.service.settleIfClickWasSent('eb-1', 'acc-1', 'note')).resolves.toBe(false);
      expect(h.writes).toHaveLength(0);
    });

    it('answers true for a stamped PLACED row without downgrading it', async () => {
      const h = build({ status: AutoFulfillStatus.PLACED, submittedAt: stamp });

      await expect(h.service.settleIfClickWasSent('eb-1', 'acc-1', 'note')).resolves.toBe(true);
      expect(h.writes).toHaveLength(0);
    });

    it('blocks a stamped RUNNING row as unknown and answers true', async () => {
      const h = build({ status: AutoFulfillStatus.RUNNING, submittedAt: stamp });

      await expect(h.service.settleIfClickWasSent('eb-1', 'acc-1', 'note')).resolves.toBe(true);
      expect(h.statusWrites()[0]?.params.slice(0, 2)).toEqual([
        AutoFulfillStatus.BLOCKED,
        AutoFulfillBlockedReason.INTERRUPTED,
      ]);
    });
  });

  describe('the live eBay re-check', () => {
    it('runs before the checkout and lets a still-wanted sale through', async () => {
      const h = build({ status: AutoFulfillStatus.PENDING });

      await expect(h.service.runForOrder('eb-1', 'acc-1')).rejects.toThrow('checkout was scheduled');

      expect(h.orderSync.recheckBeforePurchase).toHaveBeenCalledWith('eb-1', false);
      expect(h.rateLimiter.schedule).toHaveBeenCalledTimes(1);
    });

    it('passes the manual flag through, so a seller-started job is not held by a cancel request', async () => {
      const h = build({ status: AutoFulfillStatus.PENDING });

      await expect(h.service.runForOrder('eb-1', 'acc-1', { manual: true })).rejects.toThrow('checkout was scheduled');

      expect(h.orderSync.recheckBeforePurchase).toHaveBeenCalledWith('eb-1', true);
    });

    it('skips a sale eBay now reports cancelled — nothing is bought, the slot is released', async () => {
      const h = build({
        status: AutoFulfillStatus.PENDING,
        prePurchase: {
          proceed: false,
          status: AutoFulfillStatus.SKIPPED,
          reason: AutoFulfillBlockedReason.ORDER_CANCELLED,
        },
      });

      await h.service.runForOrder('eb-1', 'acc-1');

      expect(h.rateLimiter.schedule).not.toHaveBeenCalled();
      expect(h.statusWrites()[0]?.params.slice(0, 2)).toEqual([
        AutoFulfillStatus.SKIPPED,
        AutoFulfillBlockedReason.ORDER_CANCELLED,
      ]);
      expect(h.quotaEnforcement.releaseAmazonOrder).toHaveBeenCalledWith('u1', 'eb-1');
    });

    it('blocks a sale with an open cancel request', async () => {
      const h = build({
        status: AutoFulfillStatus.PENDING,
        prePurchase: {
          proceed: false,
          status: AutoFulfillStatus.BLOCKED,
          reason: AutoFulfillBlockedReason.CANCEL_REQUESTED,
        },
      });

      await h.service.runForOrder('eb-1', 'acc-1');

      expect(h.rateLimiter.schedule).not.toHaveBeenCalled();
      expect(h.statusWrites()[0]?.params.slice(0, 2)).toEqual([
        AutoFulfillStatus.BLOCKED,
        AutoFulfillBlockedReason.CANCEL_REQUESTED,
      ]);
    });

    it('buys nothing when eBay cannot be read: the error propagates and the row is not set RUNNING', async () => {
      const h = build({ status: AutoFulfillStatus.PENDING, recheckThrows: true });

      await expect(h.service.runForOrder('eb-1', 'acc-1')).rejects.toThrow('eBay unreachable');

      expect(h.rateLimiter.schedule).not.toHaveBeenCalled();
      expect(h.statusWrites()).toHaveLength(0);
    });
  });
});
