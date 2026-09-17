// apps/api/src/modules/billing/price-migration.processor.spec.ts
//
// The automatic price migration moves real customers onto a new price, so its
// side effects — what it schedules, what it records, what it e-mails — are
// asserted here against fakes, not only its pure decision.

import type { Job, Queue } from 'bullmq';

import type { DatabaseService } from '../../common/database/database.service';

import type { BillingProviderPort, PriceMigrationInspection } from './billing-provider';
import type { BillingRepositoryService } from './billing-repository.service';
import { ScheduleSource } from './price-migration';
import { PriceMigrationProcessor } from './price-migration.processor';

const JOB = { name: 'migrate-prices' } as Job;

const candidate = {
  subscriptionId: 'sub-row-1',
  providerSubscriptionId: 'sub_123',
  planId: 'plan-growth',
  planName: 'Growth',
  targetPriceId: 'price_new',
  targetAmountMicros: 124_990_000,
  targetCurrency: 'USD',
  scheduledPriceId: null as string | null,
  notifiedPriceId: null as string | null,
  userId: 'user-1',
  email: 'seller@example.com',
  firstName: 'Ada',
  locale: 'en',
};

const liveOnOldPrice: PriceMigrationInspection = {
  status: 'active',
  priceId: 'price_old',
  unitAmount: 10_499,
  currency: 'usd',
  cancelAtPeriodEnd: false,
  currentPeriodEnd: new Date('2026-10-15T00:00:00Z'),
  pendingChange: null,
};

function build(options: {
  candidates?: Array<typeof candidate>;
  live?: PriceMigrationInspection;
  emailFails?: boolean;
}) {
  const repository = {
    listPriceMigrationCandidates: jest.fn().mockResolvedValue(options.candidates ?? [candidate]),
    markPriceMigration: jest.fn().mockResolvedValue(undefined),
  };
  const provider = {
    isConfigured: () => true,
    syncCatalog: jest.fn().mockResolvedValue({ created: [], mismatches: [] }),
    inspectForPriceMigration: jest.fn().mockResolvedValue(options.live ?? liveOnOldPrice),
    scheduleDowngrade: jest.fn().mockResolvedValue(undefined),
  };
  const email = {
    sendPriceChangeEmail: options.emailFails
      ? jest.fn().mockRejectedValue(new Error('smtp down'))
      : jest.fn().mockResolvedValue(undefined),
  };
  const processor = new PriceMigrationProcessor(
    {} as Queue,
    repository as unknown as BillingRepositoryService,
    { query: jest.fn() } as unknown as DatabaseService,
    provider as unknown as BillingProviderPort,
    email,
  );
  return { processor, repository, provider, email };
}

describe('PriceMigrationProcessor', () => {
  it('schedules the new price from the next renewal, labelled as a price migration, then notifies', async () => {
    const { processor, provider, repository, email } = build({});
    const result = await processor.process(JOB);

    expect(provider.scheduleDowngrade).toHaveBeenCalledWith(
      expect.objectContaining({
        providerSubscriptionId: 'sub_123',
        providerPriceId: 'price_new',
        // The renewal webhook resolves the plan from this — never blank.
        planId: 'plan-growth',
        scheduleSource: ScheduleSource.PRICE_MIGRATION,
      }),
    );
    expect(repository.markPriceMigration).toHaveBeenCalledWith('sub-row-1', {
      evaluatedFor: 'price_new',
      scheduledTo: 'price_new',
    });
    expect(email.sendPriceChangeEmail).toHaveBeenCalledWith(
      'seller@example.com',
      'Ada',
      expect.objectContaining({ planName: 'Growth', oldPrice: '$104.99', newPrice: '$124.99' }),
      'en',
    );
    expect(repository.markPriceMigration).toHaveBeenCalledWith('sub-row-1', { notifiedFor: 'price_new' });
    expect(result).toEqual({ scheduled: 1, notified: 1 });
  });

  it('never notifies before the schedule exists', async () => {
    const { processor, provider, email } = build({});
    provider.scheduleDowngrade.mockRejectedValueOnce(new Error('stripe down'));
    await processor.process(JOB);
    expect(email.sendPriceChangeEmail).not.toHaveBeenCalled();
  });

  it('keeps a failed notice unrecorded so the next run retries it', async () => {
    const { processor, repository } = build({ emailFails: true });
    const result = await processor.process(JOB);
    expect(repository.markPriceMigration).not.toHaveBeenCalledWith('sub-row-1', {
      notifiedFor: 'price_new',
    });
    expect(result).toEqual({ scheduled: 1, notified: 0 });
  });

  it('does not re-schedule its own schedule; only sends an outstanding notice', async () => {
    const { processor, provider, email } = build({
      candidates: [{ ...candidate, scheduledPriceId: 'price_new' }],
      live: {
        ...liveOnOldPrice,
        pendingChange: { source: ScheduleSource.PRICE_MIGRATION, priceId: 'price_new' },
      },
    });
    await processor.process(JOB);
    expect(provider.scheduleDowngrade).not.toHaveBeenCalled();
    expect(email.sendPriceChangeEmail).toHaveBeenCalledTimes(1);
  });

  it('never touches a subscription whose seller has their own change pending', async () => {
    const { processor, provider, repository, email } = build({
      live: {
        ...liveOnOldPrice,
        pendingChange: { source: ScheduleSource.PLAN_CHANGE, priceId: 'price_other' },
      },
    });
    await processor.process(JOB);
    expect(provider.scheduleDowngrade).not.toHaveBeenCalled();
    expect(repository.markPriceMigration).not.toHaveBeenCalled();
    expect(email.sendPriceChangeEmail).not.toHaveBeenCalled();
  });

  it('records a subscription already on the plan price, with no Stripe write or e-mail', async () => {
    const { processor, provider, repository, email } = build({
      live: { ...liveOnOldPrice, priceId: 'price_new' },
    });
    await processor.process(JOB);
    expect(provider.scheduleDowngrade).not.toHaveBeenCalled();
    expect(email.sendPriceChangeEmail).not.toHaveBeenCalled();
    expect(repository.markPriceMigration).toHaveBeenCalledWith('sub-row-1', {
      evaluatedFor: 'price_new',
      notifiedFor: undefined,
    });
  });

  it('skips the whole run when Stripe is not configured', async () => {
    const { processor, repository, provider } = build({});
    (provider as { isConfigured: () => boolean }).isConfigured = () => false;
    await processor.process(JOB);
    expect(repository.listPriceMigrationCandidates).not.toHaveBeenCalled();
  });
});
