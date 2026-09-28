import { runWithConcurrency } from './concurrency';

describe('runWithConcurrency', () => {
  it('processes every item exactly once', async () => {
    const seen: number[] = [];
    await runWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      await Promise.resolve();
      seen.push(item);
    });
    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('never runs more than limit workers at once, and does run them in parallel', async () => {
    let inFlight = 0;
    let peak = 0;
    await runWithConcurrency([1, 2, 3, 4, 5, 6], 3, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    });
    expect(peak).toBe(3);
  });

  it('a limit of 1 processes items sequentially in order', async () => {
    const order: number[] = [];
    await runWithConcurrency([3, 1, 2], 1, async (item) => {
      order.push(item);
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
    expect(order).toEqual([3, 1, 2]);
  });

  it('stops starting new items once shouldStop returns true; in-flight items finish', async () => {
    const started: number[] = [];
    await runWithConcurrency(
      [1, 2, 3, 4, 5],
      1,
      async (item) => {
        await Promise.resolve();
        started.push(item);
      },
      () => started.length >= 2
    );
    expect(started).toEqual([1, 2]);
  });

  it('a rejection stops new starts, lets in-flight settle, then rethrows the first error', async () => {
    const started: number[] = [];
    const finished: number[] = [];
    await expect(
      runWithConcurrency([1, 2, 3, 4], 2, async (item) => {
        started.push(item);
        if (item === 2) {
          throw new Error('boom');
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
        finished.push(item);
      })
    ).rejects.toThrow('boom');
    // Item 1 was already in flight when 2 threw — it must have been allowed to
    // finish. Nothing after the failure may have been started.
    expect(finished).toContain(1);
    expect(started).not.toContain(4);
  });

  it('passes the item index to the worker', async () => {
    const indexes: Array<[string, number]> = [];
    await runWithConcurrency(['a', 'b'], 2, async (item, index) => {
      await Promise.resolve();
      indexes.push([item, index]);
    });
    expect(indexes.sort()).toEqual([
      ['a', 0],
      ['b', 1],
    ]);
  });

  it('an empty list resolves without calling the worker', async () => {
    const worker = jest.fn();
    await runWithConcurrency([], 4, worker);
    expect(worker).not.toHaveBeenCalled();
  });

  it('a non-finite or sub-1 limit degrades to sequential, never to zero workers', async () => {
    const seen: number[] = [];
    await runWithConcurrency([1, 2], 0, async (item) => {
      await Promise.resolve();
      seen.push(item);
    });
    await runWithConcurrency([3], Number.NaN, async (item) => {
      await Promise.resolve();
      seen.push(item);
    });
    expect(seen).toEqual([1, 2, 3]);
  });
});
