import { AutoFulfillStatus } from '@repo/shared';
import type { Job } from 'bullmq';

import { AutoFulfillProcessor } from './auto-fulfill-processor.service';

/**
 * A transport failure (Playwright crash, network, DB) is rethrown so BullMQ
 * retries the job. Before the rethrow the row must leave RUNNING: the
 * checkout reads RUNNING-at-start as "the previous PROCESS died mid-flight"
 * and blocks the order instead of buying (`decideFulfillStart`). An
 * in-process retry is safe to re-enter (nothing is bought before the review
 * step and no error escapes after the click), so it is handed back as PENDING.
 */
describe('AutoFulfillProcessor.process — transport failure', () => {
  function build(opts: { attemptsMade: number; attempts: number }) {
    const statusWrites: Array<{ status: string; ebayOrderId: string }> = [];
    const db = {
      query: jest.fn((sql: string, params: unknown[] = []): Promise<unknown[]> => {
        if (/UPDATE orders SET auto_fulfill_status/.test(sql)) {
          statusWrites.push({ status: params[0] as string, ebayOrderId: params[1] as string });
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
    };
    const quotaEnforcement = { releaseAmazonOrder: jest.fn((): Promise<void> => Promise.resolve()) };
    const processor = new AutoFulfillProcessor(checkout as never, db as never, quotaEnforcement as never);
    const job = {
      id: 'fulfill-eb-1',
      data: { ebayOrderId: 'eb-1', amazonAccountId: 'acc-1' },
      attemptsMade: opts.attemptsMade,
      opts: { attempts: opts.attempts },
    } as unknown as Job<{ ebayOrderId: string; amazonAccountId: string }>;
    return { processor, job, statusWrites, quotaEnforcement };
  }

  it('resets the row to PENDING before rethrowing when attempts remain', async () => {
    const { processor, job, statusWrites, quotaEnforcement } = build({ attemptsMade: 0, attempts: 3 });

    await expect(processor.process(job)).rejects.toThrow('ECONNRESET');

    expect(statusWrites).toEqual([{ status: AutoFulfillStatus.PENDING, ebayOrderId: 'eb-1' }]);
    expect(quotaEnforcement.releaseAmazonOrder).not.toHaveBeenCalled();
  });

  it('marks the row FAILED and releases the slot on the final attempt', async () => {
    const { processor, job, statusWrites, quotaEnforcement } = build({ attemptsMade: 2, attempts: 3 });

    await expect(processor.process(job)).rejects.toThrow('ECONNRESET');

    expect(statusWrites).toEqual([{ status: AutoFulfillStatus.FAILED, ebayOrderId: 'eb-1' }]);
    expect(quotaEnforcement.releaseAmazonOrder).toHaveBeenCalledWith('u1', 'eb-1');
  });
});
