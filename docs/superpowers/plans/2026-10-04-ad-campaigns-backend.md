# Ad Campaigns — Backend (Part B data, sync, ad-aware pricing, writes, report capture) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every eBay campaign of a store, and which listing runs which ad at what rate, is mirrored into SellerHill every 6 hours; a promoted listing's price includes its ad rate; the API can create campaigns, add/remove listings, change rates and pause/resume/end — and `sell.finances` becomes a default consent scope.

**Architecture:** One new module `apps/api/src/modules/ebay-campaigns/` holding a thin HTTP client (`EbayMarketingClient`), pure readers/rules (`campaign-readers.ts`, shared `campaign-rules.ts`), a claim-based sweep (`EbayCampaignSyncService` + processor, the feed/billing-sync pattern), the write service (`EbayCampaignActionsService`) behind a controller, and a capture-only report sweep. Pricing reads ONE stored figure, `listings.ad_rate_applied`, which only the sync and the write service set (via the shared pure rule `resolveAppliedAdRate`); any change to it enqueues the product on the existing `stock-sync` queue, so repricing reuses `ProductSyncService.syncListingsForProduct`.

**Tech Stack:** NestJS 10, raw `pg`, BullMQ, axios, Jest (ts-jest), `@repo/shared` (build it before api tests: `pnpm --filter @repo/shared build`).

**Spec:** `docs/superpowers/specs/2026-10-03-ad-campaigns-and-listing-rules-design.md` — Part B (B1–B6), Part D, Part E. B7 (UI) and the B6 parser are the next plan (`2026-10-04-ad-campaigns-ui.md`, written after this one ships), because the UI needs these endpoints and the parser needs a captured report.

## Global Constraints

- eBay facts come from `docs/ebay-reference/sell-marketing-v1-oas3.json` and README "Promoted Listings facts" only; nothing is assumed.
- Quota: campaign/ad calls charge `EbayApiResource.MARKETING_ADS` → eBay resource `sell.marketing.ads.campaign` (100,000/day). Sweep = `EbayCallPriority.BACKGROUND`, a seller action = `INTERACTIVE`. Eligibility stays on `EbayApiResource.ACCOUNT`.
- `bidPercentage`: string, one decimal, 2.0–100.0 (`formatBidPercentage` exists in `ebay-promoted.helpers.ts`).
- `getCampaigns` limit max 500; `getAds` limit max 500 and `listing_ids` takes 500 ids; bulk create/delete/update take ≤ 500 listings per call.
- `adRateStrategy` omitted = `FIXED` (OAS: "The default value for this field is FIXED").
- Applied ad rate = the listing's ad rate ONLY when strategy FIXED + funding `COST_PER_SALE` + campaign `RUNNING`; otherwise 0 (spec B5).
- Fail closed: an ad state is cleared only when EVERY campaign read of that store succeeded (spec B3).
- A listing with `price_override` / `lock_price` / `disable_repricing` is never repriced (existing `applyListingOverrides` rule, unchanged).
- Writes: gates in order — store owned + active → not suspended → eligibility not `INELIGIBLE` → campaign editable (CPS, not rule-based, FIXED). Each write audited as `EBAY_CAMPAIGN_ACTION`.
- Production access is read-only; nothing in this plan calls eBay writes during development. Sandbox has Marketing API; local `.env` stays sandbox.
- Every new platform setting: registry entry + `PlatformSettingKey` + `admin.json` title AND description in `en` and `tr` (`platform-settings-i18n.guard.spec.ts`).
- Every new queue: `ADMIN_QUEUE_NAMES`, `OBSERVED_QUEUE_NAMES`, admin module `registerQueue`, admin controller `@InjectQueue` list.
- Migrations: next number is `143`; never edit an applied one; apply against a stock Postgres before commit.
- Commit by path only (shared working tree, other sessions commit too); never `git add -A`, never stash.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- A store whose `getCampaigns` succeeds but ONE `getAds` read fails (429 after retries, 5xx) → no listing of that store loses its ad state or its applied rate (test in Task 6).
- A campaign that is PAUSED or ENDED on eBay (by the seller, outside SellerHill) → its listings' applied rate drops to 0 on the next sync and they are repriced down (test in Task 6).
- Adding a listing that eBay answers 35036 ("ad already exists", it is in another campaign) → reported back as `already_in_campaign`, its ad state NOT written to this campaign (test in Task 7).
- A rate outside 2.0–100.0 or with two decimals in any write request → refused with `campaigns.errors.invalidRate` before any eBay call (test in Task 7).
- A listing of the store whose product is shared with another seller → repricing recomputes only via its own row's `ad_rate_applied`; the other seller's listing price does not move (test in Task 4: rate is per listing row, not per product).

---

### Task 1: `sell.finances` becomes a default scope; the switch is removed

**Files:**
- Modify: `packages/shared/src/domain/ebay/ebay.constants.ts` (DEFAULT_SCOPES, `EBAY_FINANCES_SCOPE` doc)
- Modify: `apps/api/src/modules/ebay/ebay-oauth.service.ts` (`getScopes`, `generateConsentUrl`, `generateState`, `validateState`)
- Modify: `apps/api/src/modules/ebay/ebay.service.ts:255-415` (`createConnectUrl`, `handleCallback`)
- Modify: `apps/api/src/common/settings/platform-settings.registry.ts:60-72` (delete entry)
- Modify: `packages/shared/src/domain/admin/platform-settings.types.ts:122` (delete key)
- Modify: `packages/shared/src/i18n/resources/{en,tr}/admin.json` (delete `ebay.oauth.financesScopeEnabled` under `keys` and `descriptions`)
- Rewrite: `apps/api/src/modules/ebay/ebay-oauth-finances-scope.spec.ts`
- Modify: `apps/api/src/modules/ebay/ebay-messaging-lifecycle.guard.spec.ts` (only if it matches `getScopes(includeFinances)`; make it match `getScopes()`)

**Interfaces:**
- Produces: `EbayOAuthService.getScopes(): readonly string[]` (no parameter); `generateConsentUrl(marketplaceId, userId)`; `validateState(state): { userId; marketplaceId }`.

- [ ] **Step 1: Rewrite the spec (failing)**

```ts
// apps/api/src/modules/ebay/ebay-oauth-finances-scope.spec.ts
import { readFileSync } from 'fs';
import { join } from 'path';

import { ConfigService } from '@nestjs/config';
import { EBAY_FINANCES_SCOPE, EBAY_MARKETPLACE, EBAY_OAUTH_CONSTANTS, hasFinancesScope } from '@repo/shared';

import { EbayOAuthService } from './ebay-oauth.service';

const config = new ConfigService({
  EBAY_CLIENT_ID: 'id',
  EBAY_CLIENT_SECRET: 'secret',
  EBAY_RUNAME: 'runame',
  EBAY_ENVIRONMENT: 'production',
  EBAY_AUTH_URL: 'https://auth.ebay.com/oauth2/authorize',
  EBAY_TOKEN_URL: 'https://api.ebay.com/identity/v1/oauth2/token',
  EBAY_REST_API_URL: 'https://api.ebay.com',
});

const scopesIn = (url: string): string[] => (new URL(url).searchParams.get('scope') ?? '').split(' ');

describe('sell.finances is part of every consent', () => {
  const oauth = new EbayOAuthService(config);

  it('is a default scope', () => {
    expect(EBAY_OAUTH_CONSTANTS.DEFAULT_SCOPES).toContain(EBAY_FINANCES_SCOPE);
    expect(oauth.getScopes()).toContain(EBAY_FINANCES_SCOPE);
  });

  it('is in the consent URL', () => {
    const { url } = oauth.generateConsentUrl(EBAY_MARKETPLACE.US, 'user-1');
    expect(scopesIn(url)).toContain(EBAY_FINANCES_SCOPE);
  });

  it('a state minted before this change (with or without `fin`) still validates', () => {
    for (const extra of [{}, { fin: false }, { fin: true }]) {
      const legacy = Buffer.from(
        JSON.stringify({ userId: 'user-1', marketplaceId: EBAY_MARKETPLACE.US, random: 'r', timestamp: Date.now(), ...extra })
      ).toString('base64url');
      expect(oauth.validateState(legacy)).toEqual({ userId: 'user-1', marketplaceId: EBAY_MARKETPLACE.US });
    }
  });

  it('hasFinancesScope reads granted_scopes', () => {
    expect(hasFinancesScope(null)).toBe(false);
    expect(hasFinancesScope([...EBAY_OAUTH_CONSTANTS.DEFAULT_SCOPES])).toBe(true);
  });

  it('no switch is read anywhere any more', () => {
    for (const file of ['ebay.service.ts', 'ebay-oauth.service.ts']) {
      const src = readFileSync(join(__dirname, file), 'utf8');
      expect(src).not.toMatch(/FINANCES_SCOPE_ENABLED|includeFinances/);
    }
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`DEFAULT_SCOPES` lacks the scope; `includeFinances` still present)

Run: `pnpm --filter @repo/shared build && pnpm --filter api exec jest src/modules/ebay/ebay-oauth-finances-scope.spec.ts`

- [ ] **Step 3: Implement**

In `ebay.constants.ts`: move `EBAY_FINANCES_SCOPE` above `EBAY_OAUTH_CONSTANTS` and append it to `DEFAULT_SCOPES` (after `...EBAY_MESSAGING_SCOPES`). Replace its doc comment with: `/** eBay Finances API scope (billing activity: the fees eBay actually charged, incl. Promoted Listings). Part of every consent since 2026-10-04 — eBay accepted it on both production stores; a store connected before that gains it on its next consent. */`

In `ebay-oauth.service.ts`: `getScopes(): readonly string[] { return EBAY_OAUTH_CONSTANTS.DEFAULT_SCOPES; }`; drop the `includeFinances` parameter from `generateConsentUrl` and `generateState` and the `fin` field; `validateState` returns `{ userId, marketplaceId }` (an old `fin` field is simply ignored).

In `ebay.service.ts`: `createConnectUrl` calls `generateConsentUrl(marketplace, userId)` (delete the setting read and, if now unused, the `@Optional() platformSettings` injection only if nothing else in the class uses it — grep first); `handleCallback` destructures `{ userId, marketplaceId }` and both writes use `[...this.oauthService.getScopes()]`.

Delete the registry entry, the `PlatformSettingKey.EBAY_OAUTH_FINANCES_SCOPE_ENABLED` member, and the two `admin.json` keys (en, tr). The stored override row in production is harmless: the panel and the service iterate the registry only.

- [ ] **Step 4: Run** `pnpm --filter @repo/shared build && pnpm --filter api exec jest src/modules/ebay src/common/settings` — expect PASS. Fix `ebay-messaging-lifecycle.guard.spec.ts` if its regex referenced `getScopes(includeFinances)`.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/domain/ebay/ebay.constants.ts packages/shared/src/domain/admin/platform-settings.types.ts packages/shared/src/i18n/resources/en/admin.json packages/shared/src/i18n/resources/tr/admin.json apps/api/src/modules/ebay/ebay-oauth.service.ts apps/api/src/modules/ebay/ebay.service.ts apps/api/src/common/settings/platform-settings.registry.ts apps/api/src/modules/ebay/ebay-oauth-finances-scope.spec.ts apps/api/src/modules/ebay/ebay-messaging-lifecycle.guard.spec.ts
git commit -m "feat(api): sell.finances is a default consent scope; the panel switch is gone"
```

---

### Task 2: Migration 143 + the `MARKETING_ADS` budget resource

**Files:**
- Create: `apps/api/migrations/143_ebay_campaigns.sql`
- Modify: `packages/shared/src/domain/ebay/ebay-call-budget.types.ts` (new member)
- Modify: `apps/api/src/common/ebay-budget/ebay-rate-limits.ts:108` (`RESOURCE_SOURCE` row)
- Test: `apps/api/src/common/ebay-budget/ebay-rate-limits.spec.ts` (add one case; create the file if absent)

**Interfaces:**
- Produces: tables/columns `ebay_campaigns`, `listings.promoted_campaign_id TEXT`, `listings.promoted_ad_strategy TEXT`, `listings.promoted_synced_at TIMESTAMPTZ`, `listings.ad_rate_applied NUMERIC(5,1) NOT NULL DEFAULT 0`, `ebay_accounts.last_campaign_sync_at`, `ebay_accounts.last_campaign_report_at`; `EbayApiResource.MARKETING_ADS = 'sell.marketing.ads.campaign'`.

- [ ] **Step 1: Failing test**

```ts
// in ebay-rate-limits.spec.ts
import { EbayApiResource } from '@repo/shared';
import { RESOURCE_SOURCE } from './ebay-rate-limits';

it('campaign and ad calls are governed by sell.marketing.ads.campaign', () => {
  expect(RESOURCE_SOURCE[EbayApiResource.MARKETING_ADS]).toEqual({ trading: false, name: 'sell.marketing.ads.campaign' });
});
```

(If `RESOURCE_SOURCE` is not exported, export it — it is a const map.)

- [ ] **Step 2: Run** `pnpm --filter @repo/shared build; pnpm --filter api exec jest src/common/ebay-budget` — FAIL.

- [ ] **Step 3: Implement**

`ebay-call-budget.types.ts`, after `MARKETING`:

```ts
  /**
   * Campaign and ad calls (`/sell/marketing/v1/ad_campaign/...`): measured
   * 2026-10-03 — getCampaigns / getAds move `sell.marketing.ads.campaign`
   * (100,000/day) and leave `sell.marketing` (10,000/day) untouched.
   */
  MARKETING_ADS = 'sell.marketing.ads.campaign',
```

`ebay-rate-limits.ts`: `[EbayApiResource.MARKETING_ADS]: { trading: false, name: 'sell.marketing.ads.campaign' },`

`143_ebay_campaigns.sql`:

```sql
-- Ad Campaigns (spec 2026-10-03 Part B). One row per eBay campaign of a store,
-- mirrored by the campaign sweep; the listing columns say which ad each
-- listing runs. `ad_rate_applied` is the ONE figure pricing reads: the
-- listing's fixed ad rate while its campaign is a RUNNING cost-per-sale fixed
-- campaign, else 0 (resolveAppliedAdRate, shared). ebay_accounts.promoted_campaign_id
-- (migration 138) is left in place, unread.
CREATE TABLE IF NOT EXISTS ebay_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ebay_account_id UUID NOT NULL REFERENCES ebay_accounts(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  funding_model TEXT NULL,
  ad_rate_strategy TEXT NULL,
  bid_percentage NUMERIC(5,1) NULL,
  rule_based BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_sellerhill BOOLEAN NOT NULL DEFAULT FALSE,
  start_date TIMESTAMPTZ NULL,
  end_date TIMESTAMPTZ NULL,
  ad_count INT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metrics JSONB NULL,
  metrics_from DATE NULL,
  metrics_to DATE NULL,
  metrics_fetched_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ebay_account_id, campaign_id)
);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS promoted_campaign_id TEXT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS promoted_ad_strategy TEXT NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS promoted_synced_at TIMESTAMPTZ NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ad_rate_applied NUMERIC(5,1) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_listings_promoted_campaign
  ON listings (ebay_account_id, promoted_campaign_id)
  WHERE promoted_campaign_id IS NOT NULL;

ALTER TABLE ebay_accounts ADD COLUMN IF NOT EXISTS last_campaign_sync_at TIMESTAMPTZ NULL;
ALTER TABLE ebay_accounts ADD COLUMN IF NOT EXISTS last_campaign_report_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_ebay_accounts_last_campaign_sync_at
  ON ebay_accounts (last_campaign_sync_at NULLS FIRST)
  WHERE status = 'active';
```

- [ ] **Step 4: Run tests — PASS.** Apply the whole migration chain to a stock Postgres (CLAUDE.md "Verify a schema change against a stock image"): `docker run -d --name t143 -e POSTGRES_PASSWORD=x -e POSTGRES_DB=testdb postgres:18-alpine`, `CREATE ROLE sellerhill_user LOGIN;`, pipe `docker/postgres/init.sql` then every `apps/api/migrations/*.sql` in order through `psql -v ON_ERROR_STOP=1`, then `docker rm -f t143`. If the local Docker engine is down, record a ruling and `PREPARE`-check the DDL-free parts later; do not skip silently.

- [ ] **Step 5: Commit** (`git add` the three files + spec) — `feat(api): ebay_campaigns table, listing ad columns, sell.marketing.ads.campaign budget`

---

### Task 3: Shared campaign domain — types, enums, the applied-rate rule

**Files:**
- Create: `packages/shared/src/domain/campaigns/campaigns.types.ts`
- Create: `packages/shared/src/domain/campaigns/campaign-rules.ts`
- Create: `packages/shared/src/domain/campaigns/index.ts`
- Modify: `packages/shared/src/domain/index.ts` (export `./campaigns`) — check how other domains are exported and follow it
- Test: `apps/api/src/modules/ebay-campaigns/campaign-rules.spec.ts`

**Interfaces:**
- Produces (all exported from `@repo/shared`):
  - `enum EbayCampaignStatus { RUNNING='RUNNING', PAUSED='PAUSED', ENDED='ENDED' }` (values named in the OAS; other statuses are stored verbatim as strings)
  - `enum EbayCampaignFundingModel { COST_PER_SALE='COST_PER_SALE', COST_PER_CLICK='COST_PER_CLICK' }`
  - `enum EbayAdRateStrategy { FIXED='FIXED', DYNAMIC='DYNAMIC' }`
  - `enum CampaignReadOnlyReason { RULE_BASED='rule_based', COST_PER_CLICK='cost_per_click', DYNAMIC_RATE='dynamic_rate', ENDED='ended' }`
  - `enum CampaignAction { PAUSE='pause', RESUME='resume', END='end' }`
  - `enum CampaignAddOutcome { ADDED='added', ALREADY_IN_CAMPAIGN='already_in_campaign', FAILED='failed' }`
  - `const CAMPAIGN_BID_MIN = 2`, `CAMPAIGN_BID_MAX = 100`, `CAMPAIGN_NAME_MAX_LENGTH = 80`
  - `resolveAppliedAdRate(input: { rate: number | string | null; strategy: string | null; fundingModel: string | null; campaignStatus: string | null }): number`
  - `campaignReadOnlyReason(c: { status: string; fundingModel: string | null; adRateStrategy: string | null; ruleBased: boolean }): CampaignReadOnlyReason | null`
  - `isValidBidPercentage(value: unknown): value is number` (finite, 2.0–100.0, at most one decimal)
  - DTOs: `EbayCampaignDto`, `CampaignListingDto`, `EbayCampaignDetailDto`, `CampaignCandidatesQuery`, `CreateCampaignRequest`, `CampaignListingsRequest`, `CampaignRateRequest`, `CampaignWriteResultDto` (fields below)

- [ ] **Step 1: Failing spec**

```ts
// apps/api/src/modules/ebay-campaigns/campaign-rules.spec.ts
import {
  CampaignReadOnlyReason,
  EbayAdRateStrategy,
  EbayCampaignFundingModel,
  EbayCampaignStatus,
  campaignReadOnlyReason,
  isValidBidPercentage,
  resolveAppliedAdRate,
} from '@repo/shared';

const base = {
  rate: 5.5,
  strategy: EbayAdRateStrategy.FIXED,
  fundingModel: EbayCampaignFundingModel.COST_PER_SALE,
  campaignStatus: EbayCampaignStatus.RUNNING,
};

describe('resolveAppliedAdRate', () => {
  it('a running fixed cost-per-sale ad applies its rate', () => {
    expect(resolveAppliedAdRate(base)).toBe(5.5);
    expect(resolveAppliedAdRate({ ...base, rate: '7.0' })).toBe(7);
  });
  it('an omitted strategy is eBay’s default, FIXED', () => {
    expect(resolveAppliedAdRate({ ...base, strategy: null })).toBe(5.5);
  });
  it('paused, ended, dynamic, cost-per-click or no ad apply nothing', () => {
    expect(resolveAppliedAdRate({ ...base, campaignStatus: EbayCampaignStatus.PAUSED })).toBe(0);
    expect(resolveAppliedAdRate({ ...base, campaignStatus: EbayCampaignStatus.ENDED })).toBe(0);
    expect(resolveAppliedAdRate({ ...base, strategy: EbayAdRateStrategy.DYNAMIC })).toBe(0);
    expect(resolveAppliedAdRate({ ...base, fundingModel: EbayCampaignFundingModel.COST_PER_CLICK })).toBe(0);
    expect(resolveAppliedAdRate({ ...base, rate: null })).toBe(0);
    expect(resolveAppliedAdRate({ ...base, campaignStatus: null })).toBe(0);
  });
  it('a rate outside eBay’s bounds is never applied', () => {
    expect(resolveAppliedAdRate({ ...base, rate: 1.9 })).toBe(0);
    expect(resolveAppliedAdRate({ ...base, rate: 100.1 })).toBe(0);
    expect(resolveAppliedAdRate({ ...base, rate: 'abc' })).toBe(0);
  });
});

describe('campaignReadOnlyReason', () => {
  const c = { status: 'RUNNING', fundingModel: 'COST_PER_SALE', adRateStrategy: null, ruleBased: false };
  it('a manual fixed cost-per-sale campaign is editable', () => expect(campaignReadOnlyReason(c)).toBeNull());
  it('names why the others are read-only', () => {
    expect(campaignReadOnlyReason({ ...c, ruleBased: true })).toBe(CampaignReadOnlyReason.RULE_BASED);
    expect(campaignReadOnlyReason({ ...c, fundingModel: 'COST_PER_CLICK' })).toBe(CampaignReadOnlyReason.COST_PER_CLICK);
    expect(campaignReadOnlyReason({ ...c, adRateStrategy: 'DYNAMIC' })).toBe(CampaignReadOnlyReason.DYNAMIC_RATE);
    expect(campaignReadOnlyReason({ ...c, status: 'ENDED' })).toBe(CampaignReadOnlyReason.ENDED);
  });
});

describe('isValidBidPercentage', () => {
  it.each([2, 2.0, 5.5, 100])('accepts %p', (v) => expect(isValidBidPercentage(v)).toBe(true));
  it.each([1.9, 100.1, 5.55, NaN, '5', null])('refuses %p', (v) => expect(isValidBidPercentage(v)).toBe(false));
});
```

- [ ] **Step 2: Run** `pnpm --filter @repo/shared build` — FAIL (module missing).

- [ ] **Step 3: Implement**

`campaign-rules.ts`:

```ts
import {
  CAMPAIGN_BID_MAX,
  CAMPAIGN_BID_MIN,
  CampaignReadOnlyReason,
  EbayAdRateStrategy,
  EbayCampaignFundingModel,
  EbayCampaignStatus,
} from './campaigns.types';

/** True for a value eBay accepts as `bidPercentage`: 2.0–100.0, at most one decimal. */
export function isValidBidPercentage(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= CAMPAIGN_BID_MIN &&
    value <= CAMPAIGN_BID_MAX &&
    Math.abs(value * 10 - Math.round(value * 10)) < 1e-9
  );
}

/**
 * The ad rate pricing must include for one listing (spec B5): its own fixed
 * rate while its campaign is a RUNNING cost-per-sale campaign with a fixed
 * strategy (an omitted strategy is eBay's default, FIXED); 0 otherwise.
 */
export function resolveAppliedAdRate(input: {
  rate: number | string | null;
  strategy: string | null;
  fundingModel: string | null;
  campaignStatus: string | null;
}): number {
  const strategy = input.strategy ?? EbayAdRateStrategy.FIXED;
  if (
    strategy !== EbayAdRateStrategy.FIXED ||
    input.fundingModel !== EbayCampaignFundingModel.COST_PER_SALE ||
    input.campaignStatus !== EbayCampaignStatus.RUNNING
  ) {
    return 0;
  }
  const rate = typeof input.rate === 'string' ? Number(input.rate) : input.rate;
  if (rate === null || !Number.isFinite(rate) || rate < CAMPAIGN_BID_MIN || rate > CAMPAIGN_BID_MAX) {
    return 0;
  }
  return Math.round(rate * 10) / 10;
}

/** Why SellerHill may not change a campaign, or null when it may. */
export function campaignReadOnlyReason(c: {
  status: string;
  fundingModel: string | null;
  adRateStrategy: string | null;
  ruleBased: boolean;
}): CampaignReadOnlyReason | null {
  if (c.status === EbayCampaignStatus.ENDED) {return CampaignReadOnlyReason.ENDED;}
  if (c.fundingModel !== EbayCampaignFundingModel.COST_PER_SALE) {return CampaignReadOnlyReason.COST_PER_CLICK;}
  if ((c.adRateStrategy ?? EbayAdRateStrategy.FIXED) !== EbayAdRateStrategy.FIXED) {return CampaignReadOnlyReason.DYNAMIC_RATE;}
  if (c.ruleBased) {return CampaignReadOnlyReason.RULE_BASED;}
  return null;
}
```

`campaigns.types.ts` — the enums and constants from **Interfaces**, plus:

```ts
export interface EbayCampaignDto {
  id: string;                 // our row id
  ebayAccountId: string;
  campaignId: string;         // eBay's
  name: string;
  status: string;             // verbatim
  fundingModel: string | null;
  adRateStrategy: string | null;
  bidPercentage: number | null;
  ruleBased: boolean;
  createdBySellerHill: boolean;
  startDate: string | null;
  endDate: string | null;
  adCount: number | null;     // eBay's total, every listing of the campaign
  sellerHillListingCount: number;
  readOnlyReason: CampaignReadOnlyReason | null;
  syncedAt: string;
  metrics: Record<string, number> | null;
  metricsFrom: string | null;
  metricsTo: string | null;
}

export interface CampaignListingDto {
  listingId: string;          // our listing id
  ebayItemId: string;
  title: string;
  imageUrl: string | null;
  price: number | null;
  adRate: number | null;      // promoted_ad_rate
  appliedAdRate: number;      // ad_rate_applied
  priceLocked: boolean;       // lock_price || disable_repricing: the ad rate is not applied
}

export interface EbayCampaignDetailDto {
  campaign: EbayCampaignDto;
  listings: CampaignListingDto[];
  eligibility: { status: string | null; reason: string | null };
}

export interface CampaignCandidatesQuery {
  ebayAccountId: string;
  listingSettingsGroupId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateCampaignRequest { ebayAccountId: string; name: string; bidPercentage: number }
export interface CampaignListingsRequest { ebayAccountId: string; listingIds: string[] }
export interface CampaignRateRequest { ebayAccountId: string; bidPercentage: number; listingIds?: string[] }

export interface CampaignWriteResultDto {
  campaignId: string;
  results: Array<{ listingId: string; outcome: CampaignAddOutcome }>;
}
```

`index.ts` re-exports both files; add `export * from './campaigns';` wherever sibling domains are exported.

- [ ] **Step 4: Run** `pnpm --filter @repo/shared build && pnpm --filter api exec jest src/modules/ebay-campaigns/campaign-rules.spec.ts` — PASS.

- [ ] **Step 5: Commit** — `feat(shared): campaign domain types and the applied ad-rate rule`

---

### Task 4: Ad-aware pricing

**Files:**
- Modify: `packages/shared/src/utils/listing-pricing.ts` (`applyEbayFees`, `calculateListingPrice`, breakdown)
- Modify: `apps/api/src/modules/listings/listing-strategy.service.ts:247-267,486-494` (`computePricing`, `calculatePrice`)
- Modify: `apps/api/src/modules/listings/product-sync.service.ts:116-139,295-338` (select `ad_rate_applied`, pass it)
- Test: `apps/api/src/modules/listings/listing-pricing.spec.ts` (extend), `apps/api/src/modules/listings/product-sync-ad-rate.spec.ts` (new)

**Interfaces:**
- Consumes: `listings.ad_rate_applied` (Task 2).
- Produces: `applyEbayFees(netTarget, fees, adRatePct = 0)`; `calculateListingPrice(amazonPrice, strategy, fees, amazonTaxRatePct, adRatePct = 0)`; breakdown gains `adRatePercent: number`, `adFeeAmount: number`; `ListingStrategyService.computePricing(userId, product, groupId, group?, amazonTaxRatePct = 0, adRatePct = 0)`.

- [ ] **Step 1: Failing tests**

Add to `listing-pricing.spec.ts`:

```ts
describe('ad rate in the price (spec B5)', () => {
  const strategy = [{ minPrice: 0, maxPrice: 1000, profitMarginPercent: 20, fixedProfitAmount: 0 }];
  const fees = { ebayFeePercent: 13, fixedFeeAmount: 0.3 } as FeeConfig;

  it('adds the ad rate to the reverse-fee divisor', () => {
    const plain = calculateListingPrice(10, strategy, fees, 0);
    const promoted = calculateListingPrice(10, strategy, fees, 0, 5);
    // (12 + 0.3) / (1 - 0.18) = 15.00
    expect(promoted.finalPrice).toBeCloseTo(15.0, 2);
    expect(promoted.finalPrice).toBeGreaterThan(plain.finalPrice);
    expect(promoted.breakdown.adRatePercent).toBe(5);
    expect(promoted.breakdown.adFeeAmount).toBeCloseTo(0.75, 2);
  });

  it('keeps the seller’s profit the same as without an ad', () => {
    expect(calculateListingPrice(10, strategy, fees, 0, 5).estimatedProfit).toBe(
      calculateListingPrice(10, strategy, fees, 0).estimatedProfit
    );
  });

  it('a fee + ad rate of 100% or more falls back like a fee alone does', () => {
    const result = calculateListingPrice(10, strategy, { ebayFeePercent: 60, fixedFeeAmount: 0 } as FeeConfig, 0, 40);
    expect(Number.isFinite(result.finalPrice)).toBe(true);
    expect(result.finalPrice).toBeGreaterThan(0);
  });

  it('no ad rate is the old formula exactly', () => {
    expect(calculateListingPrice(10, strategy, fees, 0, 0)).toEqual(calculateListingPrice(10, strategy, fees, 0));
  });
});
```

Create `product-sync-ad-rate.spec.ts` — a source guard plus a behaviour check against fakes (the service is constructed with fakes the same way the existing `product-sync` specs do; grep `new ProductSyncService(` in `apps/api/src` for the constructor order):

```ts
import { readFileSync } from 'fs';
import { join } from 'path';

describe('the fan-out prices each listing with its OWN applied ad rate', () => {
  const src = readFileSync(join(__dirname, 'product-sync.service.ts'), 'utf8');
  it('selects ad_rate_applied per listing row', () => {
    const select = src.slice(src.indexOf('async computePendingUpdates('), src.indexOf('if (listings.length === 0)'));
    expect(select).toMatch(/ad_rate_applied/);
  });
  it('passes the row’s rate into computePricing', () => {
    const body = src.slice(src.indexOf('private async buildPendingUpdate('));
    expect(body).toMatch(/computePricing\([\s\S]*?Number\(listing\.ad_rate_applied\)/);
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @repo/shared build; pnpm --filter api exec jest src/modules/listings/listing-pricing.spec.ts src/modules/listings/product-sync-ad-rate.spec.ts` — FAIL.

- [ ] **Step 3: Implement**

`listing-pricing.ts`:
- `applyEbayFees(netTarget, fees, adRatePct = 0)`: `const percentageDeduction = (ebayFeePercent + (Number(adRatePct) || 0)) / 100;` — rest unchanged (the `>= 1` guard now covers the sum). Update the doc formula to `SalePrice = (NetTarget + FixedFee) / (1 - (EbayFee% + AdRate%) / 100)`.
- `calculateListingPrice(..., amazonTaxRatePct, adRatePct = 0)`: `const adRatePercent = Math.max(Number(adRatePct) || 0, 0);` call `applyEbayFees(netTarget, fees, adRatePercent)`; compute `const feeBase = priceRoundingApplied ? finalPrice : priceBeforeFloor; const ebayFeeAmount = feeBase * (ebayFeePercent / 100); const adFeeAmount = feeBase * (adRatePercent / 100);`; the rounding profit term uses `Math.max(1 - (ebayFeePercent + adRatePercent) / 100, 0)`; add `adRatePercent` and `adFeeAmount: round2(adFeeAmount)` to the breakdown interface and object (document both fields).
- `ListingStrategyService.calculatePrice(amazonPrice, group, amazonTaxRatePct, adRatePct = 0)` passes it through; `computePricing(userId, product, settingsGroupId, group?, amazonTaxRatePct = 0, adRatePct = 0)` passes it. `prepareListingData` (create path) stays at 0 — a new listing is in no campaign.
- `product-sync.service.ts`: add `ad_rate_applied` to the SELECT list and `ad_rate_applied: string | number | null` to `ListingRow`; in `buildPendingUpdate` call `computePricing(listing.user_id, product, listing.listing_settings_group_id, group, amazonTaxRatePct, Number(listing.ad_rate_applied) || 0)`.

- [ ] **Step 4: Run** the two specs plus `pnpm --filter api exec jest src/modules/listings` — PASS. `pnpm --filter web exec tsc --noEmit -p tsconfig.json` must show only the 3 known SVG errors (the web calculator calls `calculateListingPrice` with 4 args; the new parameter is optional).

- [ ] **Step 5: Commit** — `feat(pricing): a promoted listing's price includes its ad rate`

---

### Task 5: Marketing client + pure readers

**Files:**
- Create: `apps/api/src/modules/ebay-campaigns/campaign-readers.ts` (+ `campaign-readers.spec.ts`)
- Create: `apps/api/src/modules/ebay-campaigns/ebay-marketing.client.ts`
- Create: `apps/api/src/modules/ebay-campaigns/ebay-campaigns.constants.ts`

**Interfaces:**
- Consumes: `withEbayRateLimitRetry` (`../ebay/ebay-http-retry`), `EbayCallBudgetService`, `formatBidPercentage`/`formatCampaignDate`/`parseCampaignIdFromLocation`/`readEbayErrorIds`/`EBAY_ERROR_CAMPAIGN_NAME_EXISTS` (`../ebay/ebay-promoted.helpers`).
- Produces:
  - `interface ParsedCampaign { campaignId: string; name: string; status: string; fundingModel: string | null; adRateStrategy: string | null; bidPercentage: number | null; ruleBased: boolean; startDate: string | null; endDate: string | null }`
  - `readCampaignsPage(body: unknown): { campaigns: ParsedCampaign[]; total: number | null } | null` (null = not the documented object)
  - `readAdsPage(body: unknown): { ads: Array<{ listingId: string; bidPercentage: number | null }>; total: number | null } | null`
  - `readBulkListingResponse(body: unknown, requested: readonly string[]): Array<{ listingId: string; ok: boolean; errorIds: number[] }>` (a listing eBay did not answer for is `ok: false`)
  - `class EbayMarketingClient` with:
    - `getCampaigns(ctx: AccountContext, offset: number, priority): Promise<unknown>`
    - `getCampaign(ctx, campaignId, priority): Promise<unknown>`
    - `getAds(ctx, campaignId, params: { listingIds?: string[]; limit: number; offset?: number }, priority): Promise<unknown>`
    - `createCampaign(ctx, name: string, bid: string): Promise<{ campaignId: string | null; nameTaken: boolean }>`
    - `bulkCreateAds(ctx, campaignId, listingIds: string[], bid: string): Promise<unknown>`
    - `bulkDeleteAds(ctx, campaignId, listingIds: string[]): Promise<unknown>`
    - `bulkUpdateBids(ctx, campaignId, listingIds: string[], bid: string): Promise<unknown>`
    - `updateDefaultRate(ctx, campaignId, bid: string): Promise<void>` (`POST …/update_ad_rate_strategy`, body `{ adRateStrategy: 'FIXED', bidPercentage }`)
    - `campaignAction(ctx, campaignId, action: CampaignAction): Promise<void>` (`POST …/pause|resume|end`)
    - `type AccountContext = { accessToken: string; marketplaceId: string }`
  - Constants: `EBAY_CAMPAIGN_SYNC_QUEUE = 'ebay-campaign-sync'`, `EBAY_CAMPAIGN_SYNC_TICK_JOB_ID = 'ebay-campaign-sync-tick'`, `DEFAULT_EBAY_CAMPAIGN_SYNC_CRON = '*/10 * * * *'`, `CAMPAIGN_PAGE_LIMIT = 500`, `ADS_LISTING_IDS_MAX = 500`, `CAMPAIGN_BULK_MAX = 500`, `CAMPAIGN_MAX_PAGES = 20`.

- [ ] **Step 1: Failing reader spec** — feed the OAS-shaped bodies:

```ts
import { readAdsPage, readBulkListingResponse, readCampaignsPage } from './campaign-readers';

describe('readCampaignsPage', () => {
  it('reads the documented fields', () => {
    const page = readCampaignsPage({
      total: 2,
      campaigns: [
        { campaignId: '111', campaignName: 'A', campaignStatus: 'RUNNING', startDate: '2026-09-01T00:00:00Z',
          fundingStrategy: { fundingModel: 'COST_PER_SALE', adRateStrategy: 'FIXED', bidPercentage: '5.5' } },
        { campaignId: '222', campaignName: 'B', campaignStatus: 'PAUSED',
          fundingStrategy: { fundingModel: 'COST_PER_SALE' }, campaignCriterion: { criterionType: 'INVENTORY_PARTITION' } },
      ],
    });
    expect(page?.total).toBe(2);
    expect(page?.campaigns[0]).toEqual({ campaignId: '111', name: 'A', status: 'RUNNING', fundingModel: 'COST_PER_SALE',
      adRateStrategy: 'FIXED', bidPercentage: 5.5, ruleBased: false, startDate: '2026-09-01T00:00:00Z', endDate: null });
    expect(page?.campaigns[1]).toMatchObject({ ruleBased: true, adRateStrategy: null, bidPercentage: null });
  });
  it('drops a campaign without an id and refuses a non-object', () => {
    expect(readCampaignsPage({ campaigns: [{ campaignName: 'x' }] })?.campaigns).toEqual([]);
    expect(readCampaignsPage(['x'])).toBeNull();
    expect(readCampaignsPage({})).toEqual({ campaigns: [], total: null });
  });
});

describe('readAdsPage', () => {
  it('reads listing id and rate', () => {
    expect(readAdsPage({ total: 1, ads: [{ adId: 'a', listingId: '318', bidPercentage: '7.0' }] }))
      .toEqual({ total: 1, ads: [{ listingId: '318', bidPercentage: 7 }] });
  });
});

describe('readBulkListingResponse', () => {
  it('a 2xx entry with no errors is ok; an unanswered listing is not', () => {
    const out = readBulkListingResponse(
      { responses: [{ listingId: '1', statusCode: 200 }, { listingId: '2', statusCode: 400, errors: [{ errorId: 35036 }] }] },
      ['1', '2', '3']
    );
    expect(out).toEqual([
      { listingId: '1', ok: true, errorIds: [] },
      { listingId: '2', ok: false, errorIds: [35036] },
      { listingId: '3', ok: false, errorIds: [] },
    ]);
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter api exec jest src/modules/ebay-campaigns/campaign-readers.spec.ts` — FAIL.

- [ ] **Step 3: Implement** `campaign-readers.ts` (pure; `num()` = finite number from number or numeric string else null; `str()` = non-empty string or null; `ruleBased = campaignCriterion is a non-null object`; ok in bulk = `statusCode` 200–299 AND no `errors`). Then `ebay-marketing.client.ts`: `@Injectable()`, constructor `(config: ConfigService, budget: EbayCallBudgetService)`; base = `EBAY_REST_API_URL`; every call `withEbayRateLimitRetry(() => axios…, { logger, acquireBudget: () => this.budget.acquire(EbayApiResource.MARKETING_ADS, priority) })`; headers `Authorization: Bearer`, `X-EBAY-C-MARKETPLACE-ID: ctx.marketplaceId`, `Content-Type: application/json` on POST; writes use `EbayCallPriority.INTERACTIVE`. Bulk calls return `response.data` and, on an axios error carrying a body, return that body too (a 207/4xx still carries `responses[]`; `readBulkListingResponse` turns it into failures) — rethrow `EbayBudgetExhaustedError` and transport errors with no body. `createCampaign` posts `{ campaignName, startDate: formatCampaignDate(now + 2 min), marketplaceId, fundingStrategy: { fundingModel: 'COST_PER_SALE', adRateStrategy: 'FIXED', bidPercentage: bid } }`, reads the id from the `Location` header (`parseCampaignIdFromLocation`), else `GET /ad_campaign/get_campaign_by_name`; 35021 → `{ campaignId: null, nameTaken: true }`. The idempotency note: these writes are safe to retry (spec B4) — an existing ad answers 35036, a deleted one is gone.

- [ ] **Step 4: Run** — PASS. `pnpm --filter api exec tsc --noEmit -p tsconfig.json` clean.

- [ ] **Step 5: Commit** — `feat(api): Marketing API client and pure campaign readers`

---

### Task 6: Campaign sweep (`ebay-campaign-sync`)

**Files:**
- Create: `apps/api/src/modules/ebay-campaigns/ebay-campaign-sync.service.ts` (+ `.spec.ts`)
- Create: `apps/api/src/modules/ebay-campaigns/ebay-campaign-sync.processor.ts`
- Create: `apps/api/src/modules/ebay-campaigns/campaign-ad-state.repository.ts` (+ covered by the sync spec)
- Create: `apps/api/src/modules/ebay-campaigns/ebay-campaigns.module.ts`
- Modify: `apps/api/src/app.module.ts` (import the module)
- Modify: `apps/api/src/common/settings/platform-settings.registry.ts`, `packages/shared/src/domain/admin/platform-settings.types.ts`, `packages/shared/src/i18n/resources/{en,tr}/admin.json` (4 settings)
- Modify: `apps/api/src/modules/admin/admin.service.ts` (`ADMIN_QUEUE_NAMES`), `queue-events-collector.service.ts` (`OBSERVED_QUEUE_NAMES`), `admin.module.ts` (`registerQueue`), `admin.controller.ts` (`@InjectQueue` + list)

**Interfaces:**
- Consumes: `EbayMarketingClient`, readers (Task 5), `resolveAppliedAdRate` (Task 3), `EbayService.getAccountApiContext(accountId)`, `QuotaEnforcementService.isSuspended(userId)`, `StockSyncQueueService.enqueueProductStockSync(productId)` (provided in this module, `registerQueue({ name: 'stock-sync' })`).
- Produces:
  - Settings `EBAY_CAMPAIGN_SYNC_ENABLED = 'ebay.campaignSync.enabled'` (bool, true), `EBAY_CAMPAIGN_SYNC_CRON = 'ebay.campaignSync.cron'` (string, `*/10 * * * *`, restart), `EBAY_CAMPAIGN_SYNC_INTERVAL_HOURS = 'ebay.campaignSync.intervalHours'` (number 6, 1–48), `EBAY_CAMPAIGN_SYNC_MAX_ACCOUNTS_PER_RUN = 'ebay.campaignSync.maxAccountsPerRun'` (number 10, 1–100).
  - `EbayCampaignSyncService.runSweep(): Promise<void>`; `syncAccount(account: { id: string; user_id: string }, priority: EbayCallPriority): Promise<SyncOutcome>` where `SyncOutcome = { campaigns: number; complete: boolean; repricedProducts: number }` (public — Task 7 calls it after a write, and for the interactive refresh).
  - `CampaignAdStateRepository`:
    - `upsertCampaigns(accountId, campaigns: Array<ParsedCampaign & { adCount: number | null }>, removeMissing: boolean): Promise<void>`
    - `writeAdState(accountId, ads: Map<string /*ebayItemId*/, { campaignId: string; rate: number | null }>, clearOthers: boolean): Promise<string[] /*productIds whose ad_rate_applied changed*/>`

**Algorithm (`syncAccount`):**
1. `ctx = getAccountApiContext(account.id)`; read campaigns page by page (`offset += 500`) until a page is short, `total` reached, or `CAMPAIGN_MAX_PAGES`. A `null` page (undocumented body) or a thrown read → `complete = false`, stop; upsert what was read with `removeMissing = false`, write NO ad state, return.
2. For each campaign: `adCount` = `readAdsPage(getAds(limit 1)).total` (CPS campaigns only; null otherwise). For each campaign with `fundingModel = COST_PER_SALE`, `!ruleBased`, `status !== ENDED`: chunk this store's ACTIVE listings with an `ebay_item_id` by 500 → `getAds(listingIds)`; every ad found goes in the map with its own `bidPercentage` (fallback: the campaign's). Any failed/undocumented ads read → `complete = false` (keep going for the rest, but nothing will be cleared).
3. `upsertCampaigns(…, removeMissing = complete)`.
4. `writeAdState(account.id, map, clearOthers = complete)`. It runs ONE statement per case:
   - set: for listings of the store named in the map, set `promoted_campaign_id`, `promoted_ad_rate`, `promoted_ad_strategy = campaign.ad_rate_strategy`, `promoted_synced_at = NOW()`, and `ad_rate_applied` computed in TS with `resolveAppliedAdRate` (pass the campaign's status/funding/strategy) — send `ad_rate_applied` as a parameter array; return `product_id` of rows where the OLD `ad_rate_applied` differed (`UPDATE … FROM (SELECT … unnest(...)) v WHERE … RETURNING l.product_id, (old.ad_rate_applied IS DISTINCT FROM v.applied) AS changed` — read the old value via a CTE `old AS (SELECT id, ad_rate_applied FROM listings WHERE …)`).
   - clear (only when `clearOthers`): listings of the store with `promoted_campaign_id IS NOT NULL` and `ebay_item_id <> ALL($ids)` → all four columns cleared, `ad_rate_applied = 0`; return product ids where the old applied rate was > 0.
5. For each changed product id (deduplicated): `enqueueProductStockSync(productId)`.

Claim (`runSweep`): re-read `EBAY_CAMPAIGN_SYNC_ENABLED` every tick; claim like `BillingCaptureService.claimDueAccounts` (`status = 'active'`, `last_campaign_sync_at IS NULL OR < NOW() - interval`, `ORDER BY last_campaign_sync_at ASC NULLS FIRST, id`, `LIMIT`, `FOR UPDATE SKIP LOCKED`, stamp `NOW()`), skip suspended owners, `EbayBudgetExhaustedError` stops the tick, any other error is logged per store and the next store continues. No scope check is needed (`sell.marketing` is in every consent).

- [ ] **Step 1: Failing spec** (`ebay-campaign-sync.service.spec.ts`, fakes like `billing-capture.service.spec.ts`: a `db.query` jest.fn recording SQL+params, a fake client returning canned bodies, a fake repository is NOT used — test the real repository through the fake db, asserting on the SQL it sends):

```ts
// essential cases — write each as its own it():
// 1. switched off → no db call.
// 2. claim SQL contains 'last_campaign_sync_at', 'FOR UPDATE SKIP LOCKED', "status = 'active'".
// 3. full success: campaigns upserted with removeMissing; ad state written for found ads with
//    ad_rate_applied 5.5 for a RUNNING FIXED CPS campaign and 0 for a PAUSED one; clear statement sent.
// 4. FAIL CLOSED: getAds rejects for one campaign → NO statement containing the clear predicate
//    (`<> ALL`) is sent, and the campaign upsert is sent without delete.
// 5. getCampaigns rejects → no ad-state statement at all.
// 6. a product whose applied rate changed is enqueued on stock-sync exactly once even when two of its
//    listings changed; an unchanged one is not enqueued.
// 7. EbayBudgetExhaustedError on store 1 → store 2 not read; a plain error on store 1 → store 2 read.
// 8. rule-based and COST_PER_CLICK campaigns: no listing_ids getAds call is made for them.
```

Write them as real Jest code with the fakes; the fake `db.query` returns rows by matching a substring of the SQL (claim → accounts; `FROM listings` select of item ids → `[{ ebay_item_id: '1' }, { ebay_item_id: '2' }]`; the set/clear statements → `[{ product_id: 'p1', changed: true }]` etc.).

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the repository, service, processor (copy `BillingCaptureProcessor`'s shape: `@Processor(EBAY_CAMPAIGN_SYNC_QUEUE, { concurrency: 1 })`, clear-then-add the repeatable tick on `onModuleInit`), module (`imports: ConfigModule, DatabaseModule, EbayModule, BillingModule, BullModule.registerQueue({ name: EBAY_CAMPAIGN_SYNC_QUEUE }, { name: 'stock-sync' })`; `providers: EbayMarketingClient, CampaignAdStateRepository, EbayCampaignSyncService, EbayCampaignSyncProcessor, StockSyncQueueService` — import the class from `../orders/stock-sync-queue.service`), settings (registry + key + en/tr titles/descriptions — Turkish written natively, e.g. title "Kampanya senkronu açık", description "eBay reklam kampanyalarını ve hangi ilanın hangi oranla reklam verdiğini her 6 saatte bir okur. Kapalıyken fiyatlar son okunan orana göre kalır."), and the admin queue registrations.
- [ ] **Step 4: Run** `pnpm --filter api exec jest src/modules/ebay-campaigns src/modules/admin src/common/settings` — PASS (includes `platform-settings-i18n.guard.spec.ts`).
- [ ] **Step 5: Commit** — `feat(api): campaign sweep mirrors campaigns and ad rates every 6 hours`

---

### Task 7: Campaign writes + read endpoints

**Files:**
- Create: `apps/api/src/modules/ebay-campaigns/ebay-campaigns.service.ts` (reads) (+ spec)
- Create: `apps/api/src/modules/ebay-campaigns/ebay-campaign-actions.service.ts` (writes) (+ spec)
- Create: `apps/api/src/modules/ebay-campaigns/ebay-campaigns.controller.ts`
- Create: `apps/api/src/modules/ebay-campaigns/ebay-campaigns.guard.spec.ts`
- Modify: `ebay-campaigns.module.ts` (controller + providers), the module needs `EbayPromotedListingsService.getEligibility` (exported by `EbayModule` — verify `exports`)

**Interfaces:**
- Consumes: Tasks 3, 5, 6.
- Produces (routes under `@Controller({ path: 'campaigns', version: '1' })`, `@UseGuards(JwtAuthGuard)`, user = `req.user.sub`):
  - `GET /v1/campaigns?ebayAccountId=` → `{ campaigns: EbayCampaignDto[]; eligibility }`
  - `GET /v1/campaigns/candidates?ebayAccountId=&listingSettingsGroupId=&search=&page=&limit=` → `{ items: CampaignListingDto[]; total; page; limit; skippedInCampaign: number }` (ACTIVE listings of the store with an `ebay_item_id` and `promoted_campaign_id IS NULL`; `skippedInCampaign` = the same filter's count of listings that ARE in a campaign). Declared before `:campaignId`.
  - `GET /v1/campaigns/:campaignId?ebayAccountId=` → `EbayCampaignDetailDto` (interactive refresh: `syncAccount` limited to this campaign is NOT required — re-run `syncAccount(account, INTERACTIVE)` at most once per 60 s per store, cached in memory by store id)
  - `POST /v1/campaigns` body `CreateCampaignRequest` → `EbayCampaignDto`
  - `POST /v1/campaigns/:campaignId/listings/add` body `CampaignListingsRequest` → `CampaignWriteResultDto`
  - `POST /v1/campaigns/:campaignId/listings/remove` body `CampaignListingsRequest` → `CampaignWriteResultDto`
  - `POST /v1/campaigns/:campaignId/rate` body `CampaignRateRequest` (no `listingIds` = change the campaign default + every SellerHill listing in it) → `CampaignWriteResultDto`
  - `POST /v1/campaigns/:campaignId/actions/:action` (`CampaignAction`) → `EbayCampaignDto`
  - Errors as i18n keys (new namespace `campaigns` added by the UI plan; here only the keys are fixed): `campaigns.errors.storeUnavailable` (404), `campaigns.errors.suspended` (403), `campaigns.errors.ineligible` (409), `campaigns.errors.readOnly` (409, body carries `reason`), `campaigns.errors.invalidRate` (400), `campaigns.errors.invalidName` (400), `campaigns.errors.nameTaken` (409), `campaigns.errors.notFound` (404), `campaigns.errors.ebayRejected` (409).

**Write rules:**
- Gate order (one private `assertWritable(userId, accountId, campaign?)`): store owned + `status = 'active'` → `!isSuspended(userId)` → `getEligibility(accountId, INTERACTIVE).status !== 'INELIGIBLE'` → `campaignReadOnlyReason(campaign) === null`. Validation (`isValidBidPercentage`, name 1–80 chars trimmed) runs BEFORE any eBay call.
- add: resolve the requested listing ids to `ebay_item_id` with `user_id`, `ebay_account_id`, `status = 'active'`, `promoted_campaign_id IS NULL`; requested ids that do not qualify → `FAILED` without an eBay call. Chunk 500 → `bulkCreateAds(…, formatBidPercentage(campaign.bid_percentage))` → per item: ok → `ADDED` + ad state written (`promoted_campaign_id`, rate, strategy, `ad_rate_applied` via `resolveAppliedAdRate`) + product enqueued for repricing; error 35036 → `ALREADY_IN_CAMPAIGN`, nothing written; else `FAILED`.
- remove: only listings whose `promoted_campaign_id` = this campaign; `bulkDeleteAds`; ok → clear the four columns + `ad_rate_applied = 0` + enqueue.
- rate (with listing ids): `bulkUpdateBids`; ok → `promoted_ad_rate` + recomputed `ad_rate_applied` + enqueue when it changed. Without listing ids: `updateDefaultRate` then the same for every SellerHill listing in the campaign; update `ebay_campaigns.bid_percentage`.
- create: `createCampaign`; `nameTaken` → `campaigns.errors.nameTaken`; insert the row with `created_by_sellerhill = TRUE`, status `RUNNING` is NOT assumed — call `getCampaign` and upsert what eBay says.
- actions: `campaignAction`, then `getCampaign`, upsert, recompute `ad_rate_applied` for its listings (pause/end → 0, resume → their rate), enqueue changed products.
- Every write: `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details) VALUES ($1, 'EBAY_CAMPAIGN_ACTION', 'ebay_campaign', $2, $3)` with `{ ebayAccountId, campaignId, kind, requested, ok, failed, at }` — never the token or the eBay body; failures of the audit write are logged and swallowed.

- [ ] **Step 1: Failing specs**

`ebay-campaign-actions.service.spec.ts` (fakes for db, client, eligibility, quota, stock-sync) — one `it` each:
1. invalid rate (`5.55`, `1`, `101`) → `campaigns.errors.invalidRate`, client never called.
2. suspended → `campaigns.errors.suspended`, client never called.
3. eligibility `INELIGIBLE` → `campaigns.errors.ineligible`, client never called.
4. rule-based / CPC / dynamic / ended campaign → `campaigns.errors.readOnly` with the reason.
5. add: eBay answers ok for `'1'` and 35036 for `'2'` → results `added` / `already_in_campaign`; ad-state UPDATE params contain only `'1'`; product of `'1'` enqueued; audit row written.
6. add: a listing already in a campaign (or of another store) → `failed`, never sent to eBay.
7. remove → clear statement for the removed listing; enqueue.
8. pause → `campaignAction('pause')` then `getCampaign`; listings' `ad_rate_applied` set to 0 and products enqueued.
9. create with a taken name → `campaigns.errors.nameTaken`.

`ebay-campaigns.guard.spec.ts` (source greps):
- every `axios.(get|post)` in `ebay-marketing.client.ts` sits inside `withEbayRateLimitRetry` and charges `EbayApiResource.MARKETING_ADS`;
- `ebay-campaign-actions.service.ts` calls `isValidBidPercentage` and `assertWritable` before the first `this.client.` call in each public method;
- `ad_rate_applied` is written ONLY in `campaign-ad-state.repository.ts` and `ebay-campaign-actions.service.ts` (grep the module + `apps/api/src/modules/listings` — no other writer);
- the clear predicate (`<> ALL`) appears only behind the `clearOthers`/`complete` flag.

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the read service, the action service, the controller (parse/validate `ebayAccountId` with `isUUID`, map the error keys to Nest exceptions the way `ebay-returns.controller.ts` `rethrowReturnAction` does), wire into the module. A store's campaigns list returns `sellerHillListingCount` from `COUNT(*) FILTER` over `listings.promoted_campaign_id` per campaign.
- [ ] **Step 4: Run** `pnpm --filter api exec jest src/modules/ebay-campaigns` and `pnpm --filter api exec tsc --noEmit -p tsconfig.json` — PASS / clean.
- [ ] **Step 5: Commit** — `feat(api): campaign endpoints — create, add/remove listings, rates, pause/resume/end`

---

### Task 8: Campaign report capture (capture-only, B6 step 0)

**Files:**
- Create: `apps/api/src/modules/ebay-campaigns/campaign-report-capture.service.ts` (+ spec)
- Modify: `ebay-marketing.client.ts` (`createReportTask`, `getReportTask`, `downloadReport`)
- Modify: `ebay-campaign-sync.processor.ts` (run the report sweep after the campaign sweep in the same tick)
- Modify: settings files (2 settings) + admin.json en/tr

**Interfaces:**
- Produces: settings `EBAY_CAMPAIGN_REPORTS_ENABLED = 'ebay.campaignReports.enabled'` (bool, true), `EBAY_CAMPAIGN_REPORTS_CAPTURE_ONLY = 'ebay.campaignReports.captureOnly'` (bool, true — nothing is parsed or written to `ebay_campaigns.metrics` in this plan); `CampaignReportCaptureService.runSweep()`.

**Flow:** claim stores (`last_campaign_report_at` older than 24 h, active, owning ≥ 1 row in `ebay_campaigns`, `LIMIT 5`, `FOR UPDATE SKIP LOCKED`, stamp) → `createReportTask({ reportType: 'CAMPAIGN_PERFORMANCE_REPORT', reportFormat: 'TSV_GZIP', marketplaceId, dateFrom: now − 31 d (UTC midnight, ISO), dateTo: today UTC midnight, fundingModels: ['COST_PER_SALE'], campaignIds: <the store's CPS campaign ids>, dimensions: [{ dimensionKey: 'campaign_id', annotationKeys: ['campaign_name'] }], metricKeys: ['impressions','clicks','ad_fees','sales','sale_amount','ctr','avg_cost_per_sale'] })` (metric/dimension keys from `docs/ebay-reference/marketing/ad-report-metadata-campaign-performance.json` — verify each key is listed there before writing it) → task id from the `Location` header → poll `getReportTask` up to 6 times, 10 s apart (`reportTaskStatus`; `SUCCESS` → `reportHref`/`reportId`; `FAILED` → log `reportTaskStatusMessage`, stop) → `downloadReport` as `arraybuffer` → write VERBATIM to `logs/ebay-campaign-reports/<accountId>/<ts>.tsv.gz` (env `EBAY_CAMPAIGN_REPORT_CAPTURE_DIR`), keep the newest 3 per store, log one line with the byte count. Report calls are per-user limits (`sell.marketing.ad_report`) — charge nothing on the shared governor (no `EbayApiResource` exists for them; do not invent one), but keep `withEbayRateLimitRetry` for 429/5xx without `acquireBudget`. A poll that never completes is left; the next day's run creates a new task.

- [ ] **Step 1: Failing spec** — switched off → no db call; claim SQL; a store with no CPS campaign creates no task; `SUCCESS` → one file written with the exact bytes the fake returned; `FAILED` → no file, no throw; the request body carries exactly the documented keys above; no `ebay_campaigns` UPDATE is ever sent (`captureOnly`).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter api exec jest src/modules/ebay-campaigns src/common/settings` — PASS.
- [ ] **Step 5: Commit** — `feat(api): capture-only daily campaign performance report`

---

### Task 9: Retire the old auto-promote code + documentation

**Files:**
- Modify: `apps/api/src/modules/ebay/ebay-promoted-listings.service.ts` (delete `promoteListings`, `ensureCampaign`, `createCampaign`, `findCampaignIdByName`, `bulkCreateAds`, `storeCampaignId`, `PromoteResult`; keep `getEligibility` — first `grep -rn "promoteListings" apps/api/src` must return nothing outside this file)
- Modify: `apps/api/src/modules/ebay/ebay-promoted.helpers.ts` (drop now-unused exports only if nothing imports them — grep each)
- Modify: `CLAUDE.md` (new section "Ad Campaigns (backend, 2026-10-04, migration 143)" under the eBay sections; update the "Promoted Listings" bullet in "Listing rules…"; migrations table rows 143; "eBay Finances" section: the switch is gone, the scope is default; budget section: `sell.marketing.ads.campaign`)
- Modify: `docs/ebay-reference/README.md` ("Promoted Listings facts": governance now on `sell.marketing.ads.campaign`; `update_ad_rate_strategy` changes a campaign's default rate)
- Modify: the spec's Part E line 3 (mark B2–B5 + B6 capture built)

- [ ] **Step 1:** Run `pnpm --filter api exec jest` (whole api suite) and record the result in the ledger; `pnpm lint` (pre-commit runs it) must pass.
- [ ] **Step 2:** Delete the dead code; run the api suite again — PASS.
- [ ] **Step 3:** Write the docs.
- [ ] **Step 4: Commit** — `chore(api): drop auto-promote code; document ad campaigns backend`

---

## Not in this plan (next plan)

- B7 UI (Marketing sidebar group, list page on the ACTIVE store from the top bar — no store selector of its own, campaign page, create/add drawers, listing-detail row, price-calculator what-if, `campaigns` i18n namespace in 16 locales).
- B6 parser into `ebay_campaigns.metrics` (written against the captured `.tsv.gz`).
- Action Center `EBAY_ACCOUNT_FINANCES_SCOPE_MISSING` (needs promoted listings to exist).
- C3/C4 (ad fee into order profit).

## Unverified live, to be called out when this ships

`createCampaign`, `bulk_create_ads_by_listing_id`, `bulk_delete_ads_by_listing_id`, `bulk_update_ads_bid_by_listing_id`, `update_ad_rate_strategy`, pause/resume/end and the report task flow have never run against eBay. Whether `update_ad_rate_strategy` also moves the bids of ads already in the campaign is not documented — the plan updates SellerHill's listings explicitly either way. Whether the SANDBOX keyset grants `sell.finances` (Task 1 makes it part of every consent, including the test stack's) is not known — check one sandbox connect on the test stack after deploy.
