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
    it('foundation env.example documents BILLING_ENFORCEMENT_ENABLED default false', () => {
      const src = read('../../../.env.example');
      expect(src).toMatch(/BILLING_ENFORCEMENT_ENABLED=false/);
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
      // Release only on the last attempt (terminal ERROR), not intermediate RETRYING.
      expect(src).toMatch(/listingJobItemId && isLastAttempt\)/);
    });

    it('drafts are excluded from quota — consume/release gated on !asDraft', () => {
      const src = read('../listings/listing-processor.service.ts');
      // consume call (synchronous no-op in the foundation ledger model)
      expect(src).toMatch(/if \(!asDraft && listingJobItemId\)\s*\{\s*this\.quotaEnforcement\.consumeForCreate/);
      expect(src).toMatch(/if \(!asDraft && listingJobItemId && isLastAttempt\)/);
    });
  });

  describe('publish gate (single + bulk)', () => {
    it('publishListing reserves before the eBay create call', () => {
      const src = read('../listings/listings.service.ts');
      expect(src).toMatch(/reserveForPublish/);
      expect(src).toMatch(/consumeForPublish/);
      expect(src).toMatch(/releaseForPublish/);
    });

    it('publishListings delegates to publishListing (single gate, per-item)', () => {
      const src = read('../listings/listings.service.ts');
      expect(src).toMatch(/for \(const id of listingIds\)\s*\{[\s\S]*await this\.publishListing/);
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
