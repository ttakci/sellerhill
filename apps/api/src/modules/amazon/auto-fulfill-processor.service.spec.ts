import { AutoFulfillStatus } from '@repo/shared';
import type { Job } from 'bullmq';

import { AutoFulfillProcessor } from './auto-fulfill-processor.service';

/**
 * A transport failure (Playwright crash, network, DB) is rethrown so BullMQ
 * retries the job. What the processor writes before the rethrow depends on one
 * fact — whether the Place Order click was stamped:
 *
 *  - NOT stamped: nothing was bought. The row is handed back as PENDING (or
 *    FAILED on the last attempt) and the retry is safe to re-enter.
 *  - STAMPED: money may have moved. The row is settled as an unknown outcome
 *    and the job ENDS — no PENDING, no FAILED, no retry.
 */
describe('AutoFulfillProcessor.process — transport failure', () => {
  function build(opts: { attemptsMade: number; attempts: number; clickWasSent?: boolean; settleThrows?: boolean }) {
    const statusWrites: Array<{ status: string; ebayOrderId: string; sql: string }> = [];
    const db = {
      query: jest.fn((sql: string, params: unknown[] = []): Promise<unknown[]> => {
        if (/UPDATE orders SET auto_fulfill_status/.test(sql)) {
          statusWrites.push({ status: params[0] as string, ebayOrderId: params[1] as string, sql });
          return Promise.resolve([]);
        }
        if (/SELECT user_id/.test(sql)) {
          return Promise.resolve([{ user_id: 'u1' }]);
        }
        return Promise.resolve([]);
      }),
    };
    const checkout = {
      runForOrder: jest.fn((): Promise<void> => Promise.reject(new Error('ECONNRESET'))),
      settleIfClickWasSent: jest.fn(
        (): Promise<boolean> =>
          opts.settleThrows ? Promise.reject(new Error('db down')) : Promise.resolve(opts.clickWasSent === true)
      ),
    };
    const quotaEnforcement = { releaseAmazonOrder: jest.fn((): Promise<void> => Promise.resolve()) };
    const events = { record: jest.fn((): Promise<void> => Promise.resolve()) };
    const processor = new AutoFulfillProcessor(
      checkout as never,
      db as never,
      quotaEnforcement as never,
      events as never
    );
    const job = {
      id: 'fulfill-eb-1',
      data: { ebayOrderId: 'eb-1', amazonAccountId: 'acc-1' },
      attemptsMade: opts.attemptsMade,
      opts: { attempts: opts.attempts },
    } as unknown as Job<{ ebayOrderId: string; amazonAccountId: string; manual?: boolean }>;
    return { processor, job, statusWrites, quotaEnforcement, checkout };
  }

  it('resets the row to PENDING before rethrowing when attempts remain', async () => {
    const { processor, job, statusWrites, quotaEnforcement } = build({ attemptsMade: 0, attempts: 3 });

    await expect(processor.process(job)).rejects.toThrow('ECONNRESET');

    expect(statusWrites.map((w) => [w.status, w.ebayOrderId])).toEqual([[AutoFulfillStatus.PENDING, 'eb-1']]);
    expect(quotaEnforcement.releaseAmazonOrder).not.toHaveBeenCalled();
  });

  it('marks the row FAILED and releases the slot on the final attempt', async () => {
    const { processor, job, statusWrites, quotaEnforcement } = build({ attemptsMade: 2, attempts: 3 });

    await expect(processor.process(job)).rejects.toThrow('ECONNRESET');

    expect(statusWrites.map((w) => [w.status, w.ebayOrderId])).toEqual([[AutoFulfillStatus.FAILED, 'eb-1']]);
    expect(quotaEnforcement.releaseAmazonOrder).toHaveBeenCalledWith('u1', 'eb-1');
  });

  it.each([
    ['attempts remain', { attemptsMade: 0, attempts: 3 }],
    ['the final attempt', { attemptsMade: 2, attempts: 3 }],
  ])('after a stamped click it writes neither PENDING nor FAILED and does not retry (%s)', async (_label, attempts) => {
    const { processor, job, statusWrites, checkout } = build({ ...attempts, clickWasSent: true });

    // Resolves: the job ends, BullMQ does not retry.
    await expect(processor.process(job)).resolves.toBeUndefined();

    expect(checkout.settleIfClickWasSent).toHaveBeenCalledWith('eb-1', 'acc-1', expect.stringContaining('ECONNRESET'));
    expect(statusWrites).toEqual([]);
  });

  // The check before the writes can itself fail (DB down). The writes then
  // still must not touch a stamped row — which is why the condition is in SQL.
  it('both status writes carry the click-stamp predicate, so they cannot overwrite a stamped row', async () => {
    const pending = build({ attemptsMade: 0, attempts: 3, settleThrows: true });
    await expect(pending.processor.process(pending.job)).rejects.toThrow('ECONNRESET');
    const failed = build({ attemptsMade: 2, attempts: 3, settleThrows: true });
    await expect(failed.processor.process(failed.job)).rejects.toThrow('ECONNRESET');

    for (const write of [...pending.statusWrites, ...failed.statusWrites]) {
      expect(write.sql).toContain('auto_fulfill_submitted_at IS NULL');
    }
    expect(pending.statusWrites).toHaveLength(1);
    expect(failed.statusWrites).toHaveLength(1);
  });

  it('passes the manual flag of a seller-started job to the checkout', async () => {
    const { processor, job, checkout } = build({ attemptsMade: 0, attempts: 3 });
    (job.data as { manual?: boolean }).manual = true;

    await expect(processor.process(job)).rejects.toThrow('ECONNRESET');

    expect(checkout.runForOrder).toHaveBeenCalledWith('eb-1', 'acc-1', { manual: true });
  });
});
