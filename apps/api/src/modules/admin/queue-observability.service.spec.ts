// apps/api/src/modules/admin/queue-observability.service.spec.ts
//
// Service tests mirroring usage-events.service.spec.ts: hand-written Jest DB
// mocks, no Nest testing module. Covers the fail-soft / idempotent contract.

import { QueueEventType, type QueueObservationParams } from '@repo/shared';

import { QueueObservabilityService } from './queue-observability.service';

type QueryResult = { rows: unknown[] } | void;

interface MockDb {
  query: jest.Mock<Promise<QueryResult>, [string, unknown[]]>;
}

function makeMockDb(impl: { query?: jest.Mock } = {}): MockDb {
  const queryImpl = impl.query ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query: queryImpl } as unknown as MockDb;
}

function validParams(overrides: Partial<QueueObservationParams> = {}): QueueObservationParams {
  return {
    queueName: 'order-sync',
    jobId: 'job-1',
    event: QueueEventType.COMPLETED,
    correlationId: 'corr-1',
    jobName: 'sync-user-orders',
    attempts: 0,
    durationMs: 123,
    errorMessage: null,
    payloadHash: 'a'.repeat(64),
    ...overrides,
  };
}

describe('QueueObservabilityService.record', () => {
  it('inserts a valid event and reports inserted=true', async () => {
    const db = makeMockDb();
    const service = new QueueObservabilityService(db as never);
    const result = await service.record(validParams());
    expect(result).toEqual({ inserted: true, idempotentSkip: false, failed: false });
    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO queue_observations');
    expect(params[0]).toBe('order-sync'); // queue_name
    expect(params[1]).toBe('job-1'); // job_id
    expect(params[2]).toBe(QueueEventType.COMPLETED); // event
    expect(params[3]).toBe('corr-1'); // correlation_id
    expect(params[4]).toBe('sync-user-orders'); // job_name
    expect(params[5]).toBe(0); // attempts
    expect(params[6]).toBe(123); // duration_ms
    expect(params[7]).toBeNull(); // error_message (completed)
    expect(params[8]).toBe('a'.repeat(64)); // payload_hash
  });

  it('reports idempotentSkip when DB raises a unique violation (23505)', async () => {
    const db = makeMockDb({
      query: jest.fn().mockRejectedValue(Object.assign(new Error('unique'), { code: '23505' })),
    });
    const service = new QueueObservabilityService(db as never);
    const result = await service.record(validParams());
    expect(result).toEqual({ inserted: false, idempotentSkip: true, failed: false });
  });

  it('reports failed on a non-unique DB error and does not throw', async () => {
    const db = makeMockDb({
      query: jest.fn().mockRejectedValue(Object.assign(new Error('boom'), { code: '42P01' })),
    });
    const service = new QueueObservabilityService(db as never);
    const result = await service.record(validParams());
    expect(result.failed).toBe(true);
    expect(result.idempotentSkip).toBe(false);
    expect(result.error).toBe('boom');
  });

  it('rejects an empty queueName before touching the DB', async () => {
    const db = makeMockDb();
    const service = new QueueObservabilityService(db as never);
    const result = await service.record(validParams({ queueName: '' }));
    expect(result.failed).toBe(true);
    expect(result.error).toContain('queueName');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects an empty jobId before touching the DB', async () => {
    const db = makeMockDb();
    const service = new QueueObservabilityService(db as never);
    const result = await service.record(validParams({ jobId: '' }));
    expect(result.failed).toBe(true);
    expect(result.error).toContain('jobId');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects a negative attempts before touching the DB', async () => {
    const db = makeMockDb();
    const service = new QueueObservabilityService(db as never);
    const result = await service.record(validParams({ attempts: -1 }));
    expect(result.failed).toBe(true);
    expect(result.error).toContain('attempts');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects a negative durationMs when present', async () => {
    const db = makeMockDb();
    const service = new QueueObservabilityService(db as never);
    const result = await service.record(validParams({ durationMs: -5 }));
    expect(result.failed).toBe(true);
    expect(result.error).toContain('durationMs');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('accepts a null durationMs', async () => {
    const db = makeMockDb();
    const service = new QueueObservabilityService(db as never);
    const result = await service.record(validParams({ durationMs: null }));
    expect(result.inserted).toBe(true);
    const params = db.query.mock.calls[0][1];
    expect(params[6]).toBeNull();
  });

  it('accepts a failed event with an error message', async () => {
    const db = makeMockDb();
    const service = new QueueObservabilityService(db as never);
    const result = await service.record(
      validParams({ event: QueueEventType.FAILED, errorMessage: 'something broke', attempts: 3 }),
    );
    expect(result.inserted).toBe(true);
    const params = db.query.mock.calls[0][1];
    expect(params[2]).toBe(QueueEventType.FAILED);
    expect(params[5]).toBe(3);
    expect(params[7]).toBe('something broke');
  });

  it('accepts a null correlationId (no correlation stamped)', async () => {
    const db = makeMockDb();
    const service = new QueueObservabilityService(db as never);
    const result = await service.record(validParams({ correlationId: null }));
    expect(result.inserted).toBe(true);
    const params = db.query.mock.calls[0][1];
    expect(params[3]).toBeNull();
  });

  it('accepts a null payloadHash (no allowlisted signal)', async () => {
    const db = makeMockDb();
    const service = new QueueObservabilityService(db as never);
    const result = await service.record(validParams({ payloadHash: null }));
    expect(result.inserted).toBe(true);
    const params = db.query.mock.calls[0][1];
    expect(params[8]).toBeNull();
  });

  it('serializes recordedAt Date to an ISO string', async () => {
    const db = makeMockDb();
    const service = new QueueObservabilityService(db as never);
    const when = new Date('2026-07-27T10:00:00.000Z');
    await service.record(validParams({ recordedAt: when }));
    const params = db.query.mock.calls[0][1];
    expect(params[9]).toBe(when.toISOString()); // recorded_at is the last param
  });

  it('passes null recordedAt when omitted (SQL COALESCEs to NOW() — an explicit NULL would bypass the column DEFAULT)', async () => {
    const db = makeMockDb();
    const service = new QueueObservabilityService(db as never);
    await service.record(validParams({ recordedAt: undefined }));
    const [sql, params] = db.query.mock.calls[0];
    expect(params[9]).toBeNull();
    expect(sql).toContain('COALESCE($10::timestamptz, NOW())');
  });
});
