import {
  UsageCostKind,
  UsageEventSource,
  UsageMetric,
  type UsageEventParams,
} from '@repo/shared';

import { UsageEventsService } from './usage-events.service';

type QueryResult = { rows: unknown[] } | void;

interface MockDb {
  query: jest.Mock<Promise<QueryResult>, [string, unknown[]]>;
  transaction: jest.Mock<Promise<unknown[]>, [(client: { query: jest.Mock }) => Promise<unknown[]>]>;
}

function makeMockDb(impl: { query?: jest.Mock; transaction?: jest.Mock } = {}): MockDb {
  const queryImpl = impl.query ?? jest.fn().mockResolvedValue({ rows: [] });
  const transactionImpl =
    impl.transaction ??
    jest.fn().mockImplementation(async (cb: (client: { query: jest.Mock }) => Promise<unknown[]>) => {
      const client = { query: queryImpl };
      return cb(client);
    });
  return { query: queryImpl, transaction: transactionImpl } as unknown as MockDb;
}

function validEvent(overrides: Partial<UsageEventParams> = {}): UsageEventParams {
  return {
    source: UsageEventSource.KEEPA,
    metric: UsageMetric.KEEPA_TOKENS,
    providerRefId: 'ref-1',
    userId: 'user-1',
    quantity: 5,
    estimatedCostMicros: null,
    currency: null,
    ...overrides,
  };
}

describe('UsageEventsService.append', () => {
  it('inserts a valid event and reports inserted=true', async () => {
    const db = makeMockDb();
    const service = new UsageEventsService(db as never);
    const result = await service.append(validEvent());
    expect(result).toEqual({ inserted: true, idempotentSkip: false, failed: false });
    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO usage_events');
    expect(params[0]).toBe(UsageEventSource.KEEPA);
    expect(params[1]).toBe(UsageMetric.KEEPA_TOKENS);
    expect(params[2]).toBe('ref-1');
    expect(params[3]).toBe('user-1');
    expect(params[4]).toBe(5); // quantity (rounded)
  });

  it('reports idempotentSkip when DB raises a unique violation (23505)', async () => {
    const db = makeMockDb({
      query: jest.fn().mockRejectedValue(Object.assign(new Error('unique'), { code: '23505' })),
    });
    const service = new UsageEventsService(db as never);
    const result = await service.append(validEvent());
    expect(result).toEqual({ inserted: false, idempotentSkip: true, failed: false });
  });

  it('reports failed on a non-unique DB error and does not throw', async () => {
    const db = makeMockDb({
      query: jest.fn().mockRejectedValue(Object.assign(new Error('boom'), { code: '42P01' })),
    });
    const service = new UsageEventsService(db as never);
    const result = await service.append(validEvent());
    expect(result.failed).toBe(true);
    expect(result.idempotentSkip).toBe(false);
    expect(result.error).toBe('boom');
  });

  it('rejects a mismatched cost/currency pair before touching the DB', async () => {
    const db = makeMockDb();
    const service = new UsageEventsService(db as never);
    const result = await service.append(validEvent({ estimatedCostMicros: 100, currency: null }));
    expect(result.failed).toBe(true);
    expect(result.error).toContain('cost and currency');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects a negative quantity', async () => {
    const db = makeMockDb();
    const service = new UsageEventsService(db as never);
    const result = await service.append(validEvent({ quantity: -1 }));
    expect(result.failed).toBe(true);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('accepts a paired cost + currency and rounds the cost', async () => {
    const db = makeMockDb();
    const service = new UsageEventsService(db as never);
    const result = await service.append(
      validEvent({ estimatedCostMicros: 150.4, currency: 'USD', costKind: UsageCostKind.ESTIMATED }),
    );
    expect(result.inserted).toBe(true);
    const params = db.query.mock.calls[0][1];
    expect(params[5]).toBe(150); // estimated_cost_micros (rounded)
    expect(params[6]).toBe('USD');
  });

  it('serializes recordedAt Date to an ISO string', async () => {
    const db = makeMockDb();
    const service = new UsageEventsService(db as never);
    const when = new Date('2026-07-27T10:00:00.000Z');
    await service.append(validEvent({ recordedAt: when }));
    const params = db.query.mock.calls[0][1];
    expect(params[7]).toBe(when.toISOString()); // recorded_at is the last param
  });
});

describe('UsageEventsService.appendBatch', () => {
  it('returns [] for an empty input', async () => {
    const db = makeMockDb();
    const service = new UsageEventsService(db as never);
    expect(await service.appendBatch([])).toEqual([]);
  });

  it('inserts all valid events, preserving order', async () => {
    const queryMock = jest.fn().mockResolvedValue({ rows: [] });
    const db = makeMockDb({ query: queryMock });
    const service = new UsageEventsService(db as never);
    const results = await service.appendBatch([
      validEvent({ providerRefId: 'r1' }),
      validEvent({ providerRefId: 'r2' }),
    ]);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.inserted)).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it('reports idempotentSkip for unique-violation rows and inserted for the rest', async () => {
    const queryMock = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }))
      .mockResolvedValueOnce({ rows: [] });
    const db = makeMockDb({ query: queryMock });
    const service = new UsageEventsService(db as never);
    const results = await service.appendBatch([
      validEvent({ providerRefId: 'r1' }),
      validEvent({ providerRefId: 'r2' }),
      validEvent({ providerRefId: 'r3' }),
    ]);
    expect(results[0].inserted).toBe(true);
    expect(results[1].idempotentSkip).toBe(true);
    expect(results[2].inserted).toBe(true);
  });

  it('marks all valid events as failed when the transaction aborts', async () => {
    const queryMock = jest.fn().mockRejectedValue(Object.assign(new Error('boom'), { code: '42P01' }));
    const db = makeMockDb({ query: queryMock });
    const service = new UsageEventsService(db as never);
    const results = await service.appendBatch([
      validEvent({ providerRefId: 'r1' }),
      validEvent({ providerRefId: 'r2' }),
    ]);
    expect(results.every((r) => r.failed)).toBe(true);
    expect(results.every((r) => r.error === 'boom')).toBe(true);
  });

  it('short-circuits invalid events without DB contact, processes valid ones', async () => {
    const queryMock = jest.fn().mockResolvedValue({ rows: [] });
    const db = makeMockDb({ query: queryMock });
    const service = new UsageEventsService(db as never);
    const results = await service.appendBatch([
      validEvent({ providerRefId: 'r1' }),
      validEvent({ providerRefId: '', quantity: 5 }),
      validEvent({ providerRefId: 'r3' }),
    ]);
    expect(results[0].inserted).toBe(true);
    expect(results[1].failed).toBe(true);
    expect(results[2].inserted).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(2);
  });
});
