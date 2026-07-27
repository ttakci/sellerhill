// apps/api/src/modules/admin/queue-events-collector.service.spec.ts
//
// Collector lifecycle tests. Mocks the BullMQ QueueEvents constructor so the
// `on('completed'|'failed', cb)` callbacks are captured and invoked directly,
// verifying that:
//   - record() is called with the right (queueName, jobId, event, correlationId, payloadHash).
//   - a record() throw is swallowed (fail-soft — observability never breaks the listener).
//   - QUEUE_OBSERVABILITY_ENABLED=false skips collector startup.
//   - redaction is applied: only the allowlisted correlation id reaches record() verbatim,
//     everything else is hashed (never the raw payload).

import { ConfigService } from '@nestjs/config';
import { QueueEventType, type QueueObservationParams, type QueueObservationRecordResult } from '@repo/shared';

import { QueueEventsCollectorService } from './queue-events-collector.service';
import { QueueObservabilityService } from './queue-observability.service';

// Capture the QueueEvents callbacks per queue name.
interface CapturedCallbacks {
  completed: Array<(job: Record<string, unknown>) => void>;
  failed: Array<(job: Record<string, unknown>) => void>;
  error: Array<(err: unknown) => void>;
  close: jest.Mock;
}

interface BullmqMock {
  __callbacks: Map<string, CapturedCallbacks>;
  QueueEvents: jest.Mock & { mock: { results: Array<{ value: { close: jest.Mock } }> } };
}

jest.mock('bullmq', () => {
  const callbacks = new Map<string, CapturedCallbacks>();
  const QueueEvents = jest.fn().mockImplementation((queueName: string) => {
    const close = jest.fn().mockResolvedValue(undefined);
    const captured: CapturedCallbacks = { completed: [], failed: [], error: [], close };
    callbacks.set(queueName, captured);
    return {
      on: jest.fn((event: string, cb: (arg: unknown) => void) => {
        if (event === 'completed') {
          captured.completed.push(cb as (job: Record<string, unknown>) => void);
        } else if (event === 'failed') {
          captured.failed.push(cb as (job: Record<string, unknown>) => void);
        } else if (event === 'error') {
          captured.error.push(cb as (err: unknown) => void);
        }
      }),
      close,
    };
  });
  return {
    QueueEvents,
    __callbacks: callbacks,
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const bullmqMock = require('bullmq') as BullmqMock;

function makeConfigService(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    QUEUE_OBSERVABILITY_ENABLED: 'true',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function makeObservabilityService(): {
  service: QueueObservabilityService;
  record: jest.Mock<Promise<QueueObservationRecordResult>, [QueueObservationParams]>;
} {
  const record = jest.fn<
    Promise<QueueObservationRecordResult>,
    [QueueObservationParams]
  >().mockResolvedValue({ inserted: true, idempotentSkip: false, failed: false });
  const service = { record } as unknown as QueueObservabilityService;
  return { service, record };
}

describe('QueueEventsCollectorService', () => {
  beforeEach(() => {
    bullmqMock.__callbacks.clear();
    jest.clearAllMocks();
  });

  it('attaches a QueueEvents collector to each observed queue on init', async () => {
    const { service } = makeObservabilityService();
    const collector = new QueueEventsCollectorService(
      makeConfigService(),
      service,
    );
    collector.onModuleInit();
    // At least one callback registered per queue.
    expect(bullmqMock.__callbacks.size).toBeGreaterThan(0);
    for (const cbs of bullmqMock.__callbacks.values()) {
      expect(cbs.completed.length).toBe(1);
      expect(cbs.failed.length).toBe(1);
    }
    await collector.onModuleDestroy();
  });

  it('does not attach collectors when QUEUE_OBSERVABILITY_ENABLED=false', async () => {
    const { service } = makeObservabilityService();
    const collector = new QueueEventsCollectorService(
      makeConfigService({ QUEUE_OBSERVABILITY_ENABLED: 'false' }),
      service,
    );
    collector.onModuleInit();
    expect(bullmqMock.__callbacks.size).toBe(0);
    await collector.onModuleDestroy();
  });

  it('calls record() with the allowlisted correlation id + a payload hash when a completed event fires', async () => {
    const { service, record } = makeObservabilityService();
    const collector = new QueueEventsCollectorService(
      makeConfigService(),
      service,
    );
    collector.onModuleInit();
    const cbs = bullmqMock.__callbacks.get('order-sync')!;
    // Fire a completed event with a payload containing an allowlisted + a non-allowlisted field.
    cbs.completed[0]({
      jobId: 'job-123',
      attemptsMade: 1,
      timestamp: Date.now() - 50,
      data: { correlationId: 'corr-xyz', asin: 'B0ABC', secret: 'leak-me-not' },
    });
    // Allow the async handleEvent to settle.
    await Promise.resolve();
    await Promise.resolve();
    expect(record).toHaveBeenCalledTimes(1);
    const params = record.mock.calls[0][0];
    expect(params.queueName).toBe('order-sync');
    expect(params.jobId).toBe('job-123');
    expect(params.event).toBe(QueueEventType.COMPLETED);
    expect(params.correlationId).toBe('corr-xyz'); // allowlisted, stored verbatim
    expect(params.errorMessage).toBeNull(); // completed → no error
    // payloadHash is a 64-char hex (the raw payload is NOT stored).
    expect(params.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    await collector.onModuleDestroy();
  });

  it('calls record() with the error message when a failed event fires', async () => {
    const { service, record } = makeObservabilityService();
    const collector = new QueueEventsCollectorService(
      makeConfigService(),
      service,
    );
    collector.onModuleInit();
    const cbs = bullmqMock.__callbacks.get('auto-fulfill')!;
    cbs.failed[0]({
      jobId: 'job-fail-1',
      attemptsMade: 3,
      failedReason: 'proxy_required',
      data: { correlationId: 'c-fail', ebayOrderId: 'o-1' },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(record).toHaveBeenCalledTimes(1);
    const params = record.mock.calls[0][0];
    expect(params.queueName).toBe('auto-fulfill');
    expect(params.event).toBe(QueueEventType.FAILED);
    expect(params.attempts).toBe(3);
    expect(params.errorMessage).toBe('proxy_required');
    await collector.onModuleDestroy();
  });

  it('swallows a record() throw (fail-soft — never breaks the BullMQ listener)', async () => {
    const record = jest.fn().mockRejectedValue(new Error('db down'));
    const service = { record } as unknown as QueueObservabilityService;
    const collector = new QueueEventsCollectorService(
      makeConfigService(),
      service,
    );
    collector.onModuleInit();
    const cbs = bullmqMock.__callbacks.get('listings')!;
    // Should not throw.
    await expect(
      Promise.resolve(cbs.completed[0]({ jobId: 'j-1', data: { correlationId: 'c-1' } })),
    ).resolves.toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();
    expect(record).toHaveBeenCalledTimes(1);
    await collector.onModuleDestroy();
  });

  it('ignores events with no jobId', async () => {
    const { service, record } = makeObservabilityService();
    const collector = new QueueEventsCollectorService(
      makeConfigService(),
      service,
    );
    collector.onModuleInit();
    const cbs = bullmqMock.__callbacks.get('keepa-refresh')!;
    cbs.completed[0]({ data: { correlationId: 'c-1' } });
    await Promise.resolve();
    await Promise.resolve();
    expect(record).not.toHaveBeenCalled();
    await collector.onModuleDestroy();
  });

  it('closes all QueueEvents instances on destroy', async () => {
    const { service } = makeObservabilityService();
    const collector = new QueueEventsCollectorService(
      makeConfigService(),
      service,
    );
    collector.onModuleInit();
    const closeSpies = Array.from(bullmqMock.__callbacks.values()).map((cbs) => cbs.close);
    await collector.onModuleDestroy();
    // Every close() was invoked.
    expect(closeSpies.length).toBe(bullmqMock.__callbacks.size);
    for (const spy of closeSpies) {
      expect(spy).toHaveBeenCalled();
    }
  });
});
