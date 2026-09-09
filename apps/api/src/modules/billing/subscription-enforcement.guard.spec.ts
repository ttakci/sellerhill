import * as fs from 'fs';
import * as path from 'path';

const read = (rel: string): string =>
  fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

describe('order sync suspension guard', () => {
  const source = read('../orders/order-sync.service.ts');

  it('checks suspension inside syncOrdersForAccount', () => {
    expect(source).toContain('quotaEnforcement.isSuspended');
  });

  it('returns BEFORE the watermark is advanced', () => {
    // last_ebay_sync_at is written unconditionally at the end of a run and the
    // next run's start date is read from it. A suspended path that still
    // advanced it would PERMANENTLY lose every order that arrived during the
    // suspension — nothing ever looks at that date range again. This assertion
    // is the whole reason the guard file exists.
    const suspendedReturn = source.indexOf('quotaEnforcement.isSuspended');
    const watermarkWrite = source.indexOf('SET last_ebay_sync_at');
    expect(suspendedReturn).toBeGreaterThan(-1);
    expect(watermarkWrite).toBeGreaterThan(-1);
    expect(suspendedReturn).toBeLessThan(watermarkWrite);
  });
});

describe('amazon tracking suspension guard', () => {
  const source = read('../amazon/amazon-tracking-processor.service.ts');

  it('skips the scrape when suspended', () => {
    expect(source).toContain('quotaEnforcement.isSuspended');
  });

  it('does not remove the scheduler on the suspended path', () => {
    // Keeping the scheduler is what makes resume automatic: the expensive part
    // is the Playwright scrape, and the scheduler costs one lookup per tick.
    // Tearing it down would need reconcileSchedulers(), which runs only at API
    // startup — an unacceptable recovery path for a paying customer.
    // The teardown call in this file is `trackingQueueService.removeOrderTracking`
    // (it removes the per-order job scheduler). The window starts AT the
    // suspension check, so the legitimate terminal/not-found calls above it are
    // out of range.
    const idx = source.indexOf('isSuspended');
    expect(idx).toBeGreaterThan(-1);
    const suspendedBlock = source.slice(idx, idx + 600);
    expect(suspendedBlock).not.toContain('removeOrderTracking');
  });
});

describe('quota window invariants', () => {
  const repo = read('./billing-repository.service.ts');
  const helpers = read('./quota-helpers.ts');

  it('no repository method resolves the calendar month directly', () => {
    // The defect class this whole change addresses is "one rule, implemented at
    // only some of its call sites". There are seven here.
    expect(repo).not.toContain('utcMonthBounds(');
  });

  it('the conversion count is bounded at both ends', () => {
    expect(repo).toContain('tracking_converted_at >=');
    expect(repo).toContain('tracking_converted_at <');
  });

  it('resolveQuotaWindow never advances periodStart', () => {
    // Guards against a future reintroduction of the rejected roll-forward: the
    // grace must extend the END only.
    expect(helpers).not.toMatch(/addUtcMonths|rollForward/);
  });
});

describe('summary reports the EFFECTIVE entitlement (stale-window guard)', () => {
  const service = read('./billing.service.ts');
  const dto = read('../../../../../packages/shared/src/domain/billing/billing.wire.ts');
  const appLayout = read(
    '../../../../../apps/web/src/layouts/AppLayout/AppLayout.container.tsx',
  );

  it('BillingSummaryDto carries an `entitlement` field', () => {
    // Without it, a lost renewal webhook halts every backend gate while
    // GET /billing/summary still reports status:'active' and the shell never
    // redirects — the exact failure the /billing redirect exists to prevent,
    // for the account most likely to be paying.
    expect(dto).toMatch(/\bentitlement:\s*EntitlementState\b/);
  });

  it('getSummary folds resolveEffectiveEntitlement into the DTO', () => {
    expect(service).toContain('resolveEffectiveEntitlement(subscription');
    expect(service).toMatch(/BILLING_WEBHOOK_GRACE_HOURS/);
    // The value goes on the wire.
    expect(service).toMatch(/entitlement,/);
  });

  it('getSummary does NOT overwrite subscription.status in the DTO', () => {
    // The plan-change / checkout routing (hasProviderSubscription,
    // hasLiveSubscriptionStatus) needs Stripe's real state.
    expect(service).not.toMatch(/subscription\.status\s*=\s*BillingSubscriptionStatus/);
  });

  it('a stale window still drives the billing-page copy onto the past_due branch', () => {
    expect(service).toMatch(/staleWindowSuspension[\s\S]*deriveSummaryTransition/);
    expect(service).toContain('BillingSubscriptionStatus.PAST_DUE');
  });

  it('AppLayout reads summary.entitlement, not the raw subscription status', () => {
    expect(appLayout).toMatch(/billingSummary\?\.entitlement === EntitlementState\.SUSPENDED/);
    expect(appLayout).not.toMatch(/resolveEntitlementState\(billingSummary/);
    // The enforcement gate is kept — nothing redirects with enforcement off.
    expect(appLayout).toMatch(/Boolean\(billingSummary\?\.enforcementEnabled\)/);
  });
});

describe('billing:reconcile cannot leave a paying account suspended', () => {
  const cli = read('../../scripts/billing-reconcile.ts');

  it('writes the subscription BEFORE closing local trial rows', () => {
    // The reverse order (webhook applier's order) is unsafe here: a trial-close
    // that lands before a failing upsert leaves an ENDED trial and no
    // subscription -> SUSPENDED, from the one tool meant to un-suspend.
    const upsert = cli.indexOf('upsertSubscriptionByProvider(');
    const endTrials = cli.indexOf('endTrialSubscriptionsForUser(userId)');
    expect(upsert).toBeGreaterThan(-1);
    expect(endTrials).toBeGreaterThan(-1);
    expect(upsert).toBeLessThan(endTrials);
  });

  it('passes allowPeriodRewind=true — it is the ONE caller that may write an earlier start', () => {
    // Repairs a row whose start the now()/+30d fallback stamped with
    // webhook-receipt time; the webhook path must never pass this.
    expect(cli).toMatch(/upsertSubscriptionByProvider\(\s*customer\.id,\s*planId,\s*fields,\s*true/);
  });
});

describe('the webhook upsert is monotonic on current_period_start', () => {
  const helpers = read('./quota-helpers.ts');
  const billingHelpers = read('./billing-helpers.ts');
  const applier = read('./stripe-event-applier.ts');
  void helpers;

  it('buildSubscriptionUpsertSql guards the UPDATE unless rewind is explicitly allowed', () => {
    expect(billingHelpers).toContain(
      'EXCLUDED.current_period_start >= billing_subscriptions.current_period_start',
    );
  });

  it('the applier logs at error before synthesising a window from a missing period', () => {
    expect(applier).toMatch(/logger\.error\([\s\S]*SYNTHESIS/i);
    // The 30-day arithmetic is untouched (a test pins it).
    expect(applier).toContain('30 * 24 * 60 * 60 * 1000');
  });
});
