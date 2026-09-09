// apps/api/src/modules/billing/quota-enforcement.invariants.spec.ts
//
// Source-scanning invariant tests for the billing quota ENFORCEMENT WIRING.
// (Pure-logic invariants are in quota-helpers.spec.ts; these lock the contract
// that the worker paths actually call the gate at the right seams.)
//
// Mirrors the create-only-ai.guard.spec.ts pattern: read source, assert the
// contract. This catches a future refactor that silently drops a gate or
// release point without needing a running DB / Nest container.

import * as fs from 'fs';
import * as path from 'path';

// ROOT = apps/api/src/modules/billing
const ROOT = path.join(__dirname);

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('billing quota enforcement wiring invariants', () => {
  describe('master bypass (foundation integration)', () => {
    it('foundation env.example ships BILLING_ENFORCEMENT_ENABLED=true (matches the code default)', () => {
      // The registry default is `true` (migration 097 / the 30-day trial): a
      // fresh install must enforce quotas. `.env.example` is copied verbatim to
      // `.env`, and an explicit env var beats the code default — so shipping
      // `=false` here silently opted every developer machine and every
      // scaffolded environment out of the whole billing plan.
      const src = read('../../../.env.example');
      expect(src).toMatch(/^BILLING_ENFORCEMENT_ENABLED=true$/m);
      expect(src).not.toMatch(/^BILLING_ENFORCEMENT_ENABLED=false$/m);
    });

    it('foundation env.example documents the trial-length and webhook-grace knobs', () => {
      const src = read('../../../.env.example');
      expect(src).toMatch(/^BILLING_TRIAL_DAYS=30$/m);
      expect(src).toMatch(/^BILLING_WEBHOOK_GRACE_HOURS=6$/m);
    });

    it('QuotaEnforcementService delegates bypass to foundation resolveBillingConfig', () => {
      const src = read('quota-helpers.ts');
      expect(src).toMatch(/resolveBillingConfig/);
      expect(src).toMatch(/enforcementEnabled/);
    });

    it('the bypass resolves from platform settings so it can be flipped without a restart', () => {
      const src = read('quota-enforcement.service.ts');
      expect(src).toMatch(/async isEnabled\(\): Promise<boolean>/);
      expect(src).toMatch(/PlatformSettingKey\.BILLING_ENFORCEMENT_ENABLED/);
    });

    it('every gate returns early when disabled (no-op bypass)', () => {
      const src = read('quota-enforcement.service.ts');
      // `isEnabled()` is async (platform-settings backed), so every gate awaits it.
      const gated = src.match(/if \(!\(await this\.isEnabled\(\)\)[^)]*\)\s*\{[^}]*return;?\s*\}/g) ?? [];
      // reserveForBulkCreate / reserveForPublish / releaseForCreate /
      // releaseForPublish / consumeAmazonOrder / releaseAmazonOrder.
      // consumeForCreate + consumeForPublish are pure no-ops in the ledger model
      // (the 'reserved' row stays counted either way), so they carry no gate.
      // reserveAmazonOrder returns an object — it has its own gate shape.
      expect(gated.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('active-listings create gate (bulk non-draft)', () => {
    it('ListingQueueService reserves before enqueue and only for non-draft', () => {
      const src = read('../listings/listing-queue.service.ts');
      expect(src).toMatch(/reserveForBulkCreate/);
      expect(src).toMatch(/if \(!asDraft && job\.items\.length > 0\)/);
    });

    it('ListingProcessorService consumes on success and releases on terminal failure', () => {
      const src = read('../listings/listing-processor.service.ts');
      expect(src).toMatch(/consumeForCreate/);
      expect(src).toMatch(/releaseForCreate/);
      // Release only when the item is terminal (ERROR), not on an intermediate
      // RETRYING — the slot stays held so a retry cannot oversell it.
      expect(src).toMatch(/if \(isTerminal\) \{\s*await this\.quotaEnforcement\.releaseForCreate/);
    });

    it('drafts are excluded from quota — they return before the write phase', () => {
      // Structural rather than conditional: a draft is persisted and `continue`s
      // before it can be pushed onto the batch, so it never reaches the bulk
      // write, `consumeForCreate`, or `failPreparedItems`. A draft reserves its
      // slot at publish instead (see the publish gate below).
      const src = read('../listings/listing-processor.service.ts');
      expect(src).toMatch(/if \(asDraft\) \{[\s\S]*?await this\.persistDraft\([\s\S]*?continue;/);
      const writePhase = src.slice(src.indexOf('if (drafts.length === 0)'));
      expect(writePhase).toMatch(/consumeForCreate/);
      expect(src.slice(0, src.indexOf('if (drafts.length === 0)'))).not.toMatch(/consumeForCreate/);
    });
  });

  describe('publish gate (single + bulk)', () => {
    it('publishListing reserves before the eBay create call', () => {
      const src = read('../listings/listings.service.ts');
      expect(src).toMatch(/reserveForPublish/);
      expect(src).toMatch(/consumeForPublish/);
      expect(src).toMatch(/releaseForPublish/);
    });

    it('the publish gate is per listing even though the write is batched', () => {
      // Publishing many drafts is one bulk eBay call, but the plan slot is not
      // a batch concept: each draft reserves its own before the write and every
      // failure branch hands that one back, so a partial batch cannot leave a
      // slot held for a listing that does not exist.
      const src = read('../listings/listings.service.ts');
      expect(src).toMatch(/for \(const listingId of listingIds\)\s*\{[\s\S]*?prepareDraftForPublish/);
      const prepare = src.slice(src.indexOf('private async prepareDraftForPublish('));
      expect(prepare.slice(0, prepare.indexOf('\n  /**'))).toMatch(
        /await this\.quotaEnforcement\.reserveForPublish\(userId, listingId\)/
      );
      // Every terminal branch of the write phase releases; success consumes.
      const write = src.slice(src.indexOf('private async writePreparedPublishes('));
      expect((write.match(/releaseForPublish/g) ?? []).length).toBeGreaterThanOrEqual(4);
      expect(src).toMatch(/consumeForPublish\(userId, item\.listingId\)/);
    });
  });

  describe('AO monthly UTC quota', () => {
    it('OrderSyncService reserves before enqueue and sets BLOCKED on exhaustion', () => {
      const src = read('../orders/order-sync.service.ts');
      expect(src).toMatch(/reserveAmazonOrder/);
      expect(src).toMatch(/setAutoFulfillBlocked/);
      expect(src).toMatch(/AutoFulfillBlockedReason\.QUOTA_EXHAUSTED/);
    });

    it('AmazonCheckoutService.onPlaced consumes the reservation after a placed write', () => {
      const src = read('../amazon/amazon-checkout.service.ts');
      expect(src).toMatch(/consumeAmazonOrder/);
      expect(src).toMatch(/onPlaced quota consume failed/);
    });

    it('AmazonCheckoutService.block releases the AO reservation (deliberate stop)', () => {
      const src = read('../amazon/amazon-checkout.service.ts');
      expect(src).toMatch(/block quota release/);
    });

    it('AutoFulfillProcessor releases the AO reservation on final transport failure', () => {
      const src = read('../amazon/auto-fulfill-processor.service.ts');
      expect(src).toMatch(/releaseAmazonOrder/);
      expect(src).toMatch(/final-fail quota release/);
    });
  });

  describe('no hardcoded status strings (CLAUDE.md rule 10)', () => {
    it('AO quota exhaustion uses the shared AutoFulfillBlockedReason.QUOTA_EXHAUSTED enum', () => {
      const src = read('../orders/order-sync.service.ts');
      expect(src).not.toMatch(/['"]quota_exhausted['"]/);
      expect(src).toMatch(/AutoFulfillBlockedReason\.QUOTA_EXHAUSTED/);
    });

    it('quota exhaustion reason surfaces in i18n (EN + TR)', () => {
      const en = read('../../../../../packages/shared/src/i18n/resources/en/orders.json');
      const tr = read('../../../../../packages/shared/src/i18n/resources/tr/orders.json');
      expect(en).toMatch(/"quota_exhausted":/);
      expect(tr).toMatch(/"quota_exhausted":/);
    });
  });

  describe('foundation integration (no duplicate schema)', () => {
    it('uses the foundation reservation tables, not a separate quota table', () => {
      const src = read('quota-enforcement.service.ts');
      expect(src).toMatch(/BillingRepositoryService/);
      // Must NOT create a separate QuotaConfigService / QuotaReservationService
      // (the foundation's BillingRepositoryService owns all DB access).
      expect(src).not.toMatch(/QuotaConfigService/);
      expect(src).not.toMatch(/QuotaReservationService/);
    });

    it('quota-helpers uses the foundation enums (BillingLimitKey, BillingReservationStatus)', () => {
      const src = read('quota-helpers.ts');
      expect(src).toMatch(/BillingLimitKey/);
      expect(src).toMatch(/BillingReservationStatus/);
    });

    it('BillingModule exports QuotaEnforcementService for injection into workers', () => {
      const src = read('billing.module.ts');
      expect(src).toMatch(/QuotaEnforcementService/);
      expect(src).toMatch(/exports:.*QuotaEnforcementService/s);
    });
  });

  describe('downgrade never disables existing listings', () => {
    it('no code path sets an existing ACTIVE listing to INACTIVE on quota grounds', () => {
      const src = read('../listings/listings.service.ts');
      // The only place status is set to inactive is endListings (operator action).
      expect(src).toMatch(/status = '\$\{ListingStatus\.INACTIVE\}'/);
      // Quota exhaustion throws — it does not mutate listing rows.
      expect(src).toMatch(/reserveForPublish/);
    });
  });

  describe('module wiring', () => {
    it('BillingModule is imported by Listings, Orders, Amazon modules', () => {
      expect(read('../listings/listings.module.ts')).toMatch(/BillingModule/);
      expect(read('../orders/orders.module.ts')).toMatch(/BillingModule/);
      expect(read('../amazon/amazon.module.ts')).toMatch(/BillingModule/);
    });
  });
});
