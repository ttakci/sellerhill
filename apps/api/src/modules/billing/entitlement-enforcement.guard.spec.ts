// apps/api/src/modules/billing/entitlement-enforcement.guard.spec.ts
//
// Source-greps that keep the entitlement and quota enforcement from silently
// regressing to what it was.
//
// Every gap this guards was of the SAME kind: the behaviour was documented —
// in CLAUDE.md, in a docstring, or in the limit key's own comment — and simply
// not implemented, and nothing failed because BILLING_ENFORCEMENT_ENABLED has
// never been switched on. A unit test cannot catch a call that was never made,
// so this file asserts the calls exist, the way
// `failure-visibility.guard.spec.ts` and `create-only-ai.guard.spec.ts` do for
// their own invariants.

import * as fs from 'fs';
import * as path from 'path';

const API_SRC = path.join(__dirname, '..', '..');

function read(...segments: string[]): string {
  return fs.readFileSync(path.join(API_SRC, ...segments), 'utf8');
}

describe('entitlement enforcement invariants', () => {
  describe('the quota gate consults subscription status', () => {
    const src = read('modules', 'billing', 'quota-enforcement.service.ts');

    it('resolves entitlement from the shared function, not a local status list', () => {
      // A hand-written status check here is how five enforcement points drift
      // apart; resolveEntitlementState is the single definition.
      expect(src).toMatch(/resolveEntitlementState\(/);
      expect(src).toMatch(/EntitlementState\.SUSPENDED/);
    });

    it('reports a suspended account as limit 0 rather than a second refusal path', () => {
      expect(src).toMatch(/limitValue:\s*0,\s*\n\s*suspended:\s*true/);
    });

    it('separates suspension from quota exhaustion for auto-fulfill', () => {
      // The two need different actions from the seller. Collapsing them sends
      // a past-due account to the upgrade page.
      expect(src).toMatch(/AutoFulfillBlockedReason\.SUBSCRIPTION_SUSPENDED/);
    });
  });

  describe('monthly meters are scoped to a usage period', () => {
    const service = read('modules', 'billing', 'quota-enforcement.service.ts');
    const repository = read('modules', 'billing', 'billing-repository.service.ts');

    it('opens the current period on read — nothing else ever created one', () => {
      expect(repository).toMatch(/async ensureOpenUsagePeriod\(/);
      expect(repository).toMatch(/INSERT INTO billing_usage_periods/);
      expect(service).toMatch(/ensureOpenUsagePeriod\(/);
    });

    it('filters the AO count by usage_period_id', () => {
      // Without this the count spans the life of the subscription and the
      // monthly allowance never resets.
      expect(repository).toMatch(/FROM billing_ao_reservations[\s\S]{0,200}usage_period_id = \$2/);
    });

    it('does not open a period for listings, which are a level not a flow', () => {
      expect(service).toMatch(/kind !== BillingLimitKey\.LISTINGS_PER_MONTH/);
    });
  });

  describe('listing slots are a level that a deletion frees', () => {
    const service = read('modules', 'billing', 'quota-enforcement.service.ts');
    const repository = read('modules', 'billing', 'billing-repository.service.ts');

    it('counts ACTIVE listing rows, not just reservations', () => {
      expect(repository).toMatch(/async countActiveListings\(/);
      expect(repository).toMatch(/FROM listings[\s\S]{0,120}status = \$2/);
      expect(service).toMatch(/countListingUsage\(/);
    });

    it('hands the slot from the reservation to the listing on success', () => {
      // This used to be a no-op comment, which made the quota a ratchet: a
      // successful create held its reservation forever, so ending a listing
      // could never free room.
      expect(service).toMatch(/async consumeForCreate\([\s\S]{0,200}releaseForCreate\(/);
      expect(service).toMatch(/async consumeForPublish\([\s\S]{0,200}releaseForPublish\(/);
    });
  });

  describe('cost-bearing pipelines refuse a lapsed account', () => {
    it('the Keepa refresh claim filters on entitled subscription status', () => {
      // The single largest recurring cost. This query had no billing awareness
      // at all, so a non-payer kept burning tokens indefinitely.
      const src = read('modules', 'listings', 'refresh-processor.service.ts');
      expect(src).toMatch(/ENTITLED_SUBSCRIPTION_STATUSES/);
      expect(src).toMatch(/JOIN billing_subscriptions bs/);
      // …and is a no-op with enforcement off, so adopting this changes nothing
      // until the operator turns it on.
      expect(src).toMatch(/BILLING_ENFORCEMENT_ENABLED/);
    });

    it('tracking conversion checks entitlement and quota before paying', () => {
      const src = read('modules', 'amazon', 'tracking-conversion.service.ts');
      expect(src).toMatch(/isSuspended\(order\.user_id\)/);
      expect(src).toMatch(/canConvertTracking\(order\.user_id\)/);
    });

    it('conversion DEGRADES rather than blocks when quota runs out', () => {
      // Unlike listings and orders, exhausting conversions must not stop the
      // shipment — eBay still needs a scannable number. The fallback is the
      // honest pass-through.
      const src = read('modules', 'amazon', 'tracking-conversion.service.ts');
      expect(src).toMatch(
        /quota-conversion|quota exhausted[\s\S]{0,200}this\.local\.convertSync\(request\)/i,
      );
    });
  });

  describe('the manual link path is metered like the automatic one', () => {
    const src = read('modules', 'amazon', 'amazon.controller.ts');

    it('reserves an AO slot before scraping', () => {
      // Without this a seller at their limit could place the order by hand and
      // link it: same cost to us, zero quota consumed.
      expect(src).toMatch(/reserveAmazonOrder\(/);
      expect(src).toMatch(/ConflictException\('billing\.errors\.quotaExhausted'\)/);
    });

    it('releases the slot on every failure path', () => {
      // A reservation held for a link that never happened is a slot the seller
      // can never get back.
      const releases = src.match(/releaseAmazonOrder\(/g) ?? [];
      expect(releases.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('a refused create leaves nothing behind', () => {
    it('rolls the job back when the quota gate refuses it', () => {
      // The reservation keys off the job-item ids, so the rows must exist
      // before the gate can run. Without the rollback a refused create left a
      // job stuck in the import list at "0 / N, waiting" forever — nothing was
      // queued to advance it and nothing was queued to fail it.
      const queue = read('modules', 'listings', 'listing-queue.service.ts');
      expect(queue).toMatch(/reserveForBulkCreate\([\s\S]{0,120}catch/);
      expect(queue).toMatch(/deleteUnstartedJob\(/);
      const service = read('modules', 'listings', 'listings.service.ts');
      expect(service).toMatch(/async deleteUnstartedJob\(/);
      // It must refuse to touch a job that already has non-draft items, so it
      // can never be repurposed into something that discards real work.
      expect(service).toMatch(/NOT EXISTS[\s\S]{0,200}listing_job_items/);
    });

    it('reports the refusal as a reason, not as a 500', () => {
      // The gate throws plain Errors (the worker classifies by name), so
      // nothing translated them at the HTTP boundary — an expired trial
      // surfaced as "Internal server error".
      const controller = read('modules', 'listings', 'listings.controller.ts');
      expect(controller).toMatch(/SubscriptionSuspendedError:\s*'billing\.errors\.subscriptionSuspended'/);
      expect(controller).toMatch(/QuotaExhaustedError:\s*'billing\.errors\.listingQuotaExhausted'/);
      expect(controller).toMatch(/rethrowListingRefusal\(/);
    });

    it('distinguishes suspension from a full quota', () => {
      // Both refuse, but "50 in use (limit 0)" is nonsense for a suspended
      // account and points at the wrong fix.
      const quota = read('modules', 'billing', 'quota-enforcement.service.ts');
      expect(quota).toMatch(/SubscriptionSuspendedError/);
      expect(quota).toMatch(/buildListingRefusal\(/);
    });
  });

  describe('quota top-ups', () => {
    it('the gate enforces the EFFECTIVE limit, not the plan limit', () => {
      // Resolving the plan limit in the gate while the summary added credits
      // would refuse a seller who had just paid for headroom the billing page
      // was showing them — the worst outcome for a purchase.
      const gate = read('modules', 'billing', 'quota-enforcement.service.ts');
      expect(gate).toMatch(/resolveEffectiveLimit\(/);
      expect(gate).not.toMatch(/repository\.resolveLimitValue\(subscription\.id/);
    });

    it('resolves the effective limit in ONE place', () => {
      // Both the gate and the summary must ask the same function.
      const repo = read('modules', 'billing', 'billing-repository.service.ts');
      const service = read('modules', 'billing', 'billing.service.ts');
      expect(repo).toMatch(/async resolveEffectiveLimit\(/);
      expect(service).toMatch(/repository\.resolveEffectiveLimit\(/);
    });

    it('grants credit only for a PAID one-time session', () => {
      // Checkout can complete with payment still settling; granting on the
      // promise rather than the payment gives allowance away for free.
      const applier = read('modules', 'billing', 'stripe-event-applier.ts');
      expect(applier).toMatch(/session\.mode !== 'payment'/);
      expect(applier).toMatch(/session\.payment_status !== 'paid'/);
    });

    it('grants idempotently, keyed on the Stripe event', () => {
      // Stripe redelivers. A second grant is free quota.
      const applier = read('modules', 'billing', 'stripe-event-applier.ts');
      expect(applier).toMatch(/providerEventId/);
      const repo = read('modules', 'billing', 'billing-repository.service.ts');
      expect(repo).toMatch(/ON CONFLICT \(provider_event_id\) DO NOTHING/);
    });

    it('credit lookup failure falls back to the PLAN limit, never to unlimited', () => {
      const repo = read('modules', 'billing', 'billing-repository.service.ts');
      expect(repo).toMatch(/Credit lookup failed[\s\S]{0,200}limitValue: planLimit/);
    });
  });

  describe('an existing subscription is repriced, never re-subscribed', () => {
    it('exposes a change-plan path distinct from checkout', () => {
      // Stripe does not refuse a second subscription for a customer who already
      // has one, so "choose a plan" reaching checkout while subscribed bills
      // them twice. The two operations must stay separately callable.
      const provider = read('modules', 'billing', 'billing-provider.ts');
      expect(provider).toMatch(/changeSubscriptionPlan\(/);
      expect(provider).toMatch(/subscriptions\.update\(/);
      expect(provider).toMatch(/proration_behavior/);
    });

    it('moves plan metadata with the price', () => {
      // The webhook applier reads the local plan from subscription metadata.
      // Repricing without updating it would have the subscription report the
      // OLD plan back on its next update.
      const provider = read('modules', 'billing', 'billing-provider.ts');
      // Wide window on purpose: the call is heavily commented, and this
      // asserts the two appear in the SAME call, not that they are adjacent.
      expect(provider).toMatch(/subscriptions\.update\([\s\S]{0,1500}metadata: \{ plan_id/);
    });

    it('tells the FE which of the two applies', () => {
      const service = read('modules', 'billing', 'billing.service.ts');
      expect(service).toMatch(/hasProviderSubscription: Boolean\(subscription\?\.providerSubscriptionId\)/);
    });
  });

  describe('conversion scope is a seller setting, not an implicit rule', () => {
    it('uses the shared predicate rather than a second TB regex', () => {
      const service = read('modules', 'amazon', 'tracking-conversion.service.ts');
      expect(service).toMatch(/isAmazonLogisticsTracking\(/);
      // A private regex here would let the scope decision and the eBay carrier
      // label drift apart.
      expect(service).not.toMatch(/\/\^TB\[A-Z\]/);
    });

    it('refuses to convert an order that can never be published to eBay', () => {
      // Converting an unlinked order is worse than wasting the fee: the stored
      // number makes `hasWebhookDeliveryCoverage` stop Amazon polling, while
      // `handleShipped` still refuses the push — the order strands in SHIPPED
      // with a tracking number nobody was ever given.
      const service = read('modules', 'amazon', 'tracking-conversion.service.ts');
      expect(service).toMatch(/isPublishableToEbay\(/);
      expect(service).toMatch(/orders\.errors\.orderNotTracked/);
      // …and it must ask the same question handleShipped pushes on.
      expect(service).toMatch(/JOIN listings l ON l\.id = o\.listing_id/);
      const processor = read('modules', 'amazon', 'amazon-tracking-processor.service.ts');
      expect(processor).toMatch(/listing_ebay_item_id/);
    });

    it('honours the manual-order switch without a caller-supplied flag', () => {
      const service = read('modules', 'amazon', 'tracking-conversion.service.ts');
      expect(service).toMatch(/auto_fulfill_status !== AutoFulfillStatus\.PLACED/);
      expect(service).toMatch(/tracking_convert_manual_orders === false/);
    });
  });
});
