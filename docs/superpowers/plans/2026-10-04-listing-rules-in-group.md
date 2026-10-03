# Listing Rules in the Settings Group — Implementation Plan (Part A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Listing rules move from store settings into each Listing Settings Group, as a new "Rules" step of the group drawer.
- Blocked ASINs move into the Blacklist drawer.
- The ad-rate setting and the automatic promotion after publish are removed.

**Architecture:** One migration:
- adds `listing_settings_groups.listing_rules` (normalized JSONB);
- adds `store_settings.blocked_asins` (JSONB, NULL inherits the global row);
- copies each user's global rules into all of their groups.

Every reader then takes rules from the listing's or job's group:
- the create worker;
- `prepareListingData` (`hideBrand`);
- the clean-up sweep;
- the not-selling predicate;
- the Action Center.

The store-settings save path stops writing `listing_rules`; that column stays in the table, unread.

**Tech Stack:** NestJS + raw `pg`, shared TS package, React/RTK Query, Jest (api), Vitest (web), 16-locale i18n.

**Spec:** `docs/superpowers/specs/2026-10-03-ad-campaigns-and-listing-rules-design.md` (Part A, decisions D1–D4).

## Global Constraints

- Migration number **141**. It must apply to a stock `postgres:16-alpine` after 001–140, and an applied migration is never edited.
- `normalizeListingRules` stays total (NULL or garbage → defaults). The defaults stay the same: VeRO **on**, `hideBrand` **on**, everything else off.
- `minRating` is a number the seller types, **1.0–5.0, one decimal**. Anything else is read as "no minimum".
- Blocked ASINs: Store > Global. A store row's NULL inherits the global list; a global NULL means none. An omitted value on save leaves the stored one unchanged.
- **Rules are judged in the create worker only.** Draft publish and the existing-listing import do not judge them (unchanged).
- 4-file split; design-system controls only; every new string in all 16 locales (`en` / `tr` natural). JSON resource files are CRLF, so scripts must round-trip byte-identically.
- **Every SQL statement is `PREPARE`d against a real Postgres** before its task is done; an explicit cast is needed wherever a parameter meets a literal or is used twice.
- Commit by path only: another session may be working in the same tree.

## Review Focus

1. **A listing whose group was deleted or never had rules** (`listing_rules` NULL): readers must get defaults, so VeRO and hideBrand stay **on**. They must never get "everything off" because the column is NULL.
2. **A store row with `blocked_asins = []` (explicitly empty) vs NULL:** the empty list blocks nothing even when the global row has a list; NULL inherits the global list.
3. **A clean-up sweep with two groups on one store, one with clean-up on and one off:** only listings of the "on" group are ended.
4. **`minRating` typed as `4,5` (comma) or `4.55`:** the comma is parsed as 4.5; a second decimal is rounded to one; anything outside 1–5 is refused in the form and normalized to "no minimum" on the server.
5. **An old client still sending `listingRules` to the store-settings endpoint:** the field is ignored (whitelisted out), never 500s, and blocked ASINs are not wiped.

---

### Task 1: Shared shapes

**Files:**
- Modify:
  - `packages/shared/src/domain/store-settings/listing-rules.ts`
  - `packages/shared/src/domain/store-settings/store-settings.types.ts`
  - `packages/shared/src/domain/store-settings/store-settings.dto.ts`
  - `packages/shared/src/domain/listing-settings-groups/listing-settings-group.types.ts`
  - `packages/shared/src/domain/listing-settings-groups/listing-settings-group.dto.ts`
- Test: `apps/api/src/modules/listings/listing-rules.spec.ts`

**Interfaces — Produces:**
- `ListingRulesConfig` **without** `blockedAsins` and `promotedAdRate`.
- `MIN_RATING_MIN = 1`, `MIN_RATING_MAX = 5`.
- `normalizeMinRating(value: unknown): number | null`: accepts a number or a string, where `"4,5"` reads as 4.5; rounds to one decimal; returns `null` outside 1–5.
- `isAsinBlocked(blockedAsins: readonly string[], asin: string): boolean`.
- `evaluateListingRules(rules, input)`: the BLOCKED_ASIN check moves out, since the worker checks the list separately; `ListingRuleKind.BLOCKED_ASIN` stays.
- `resolveBlockedAsins(store: unknown, global: unknown): string[]`: store non-null wins, else global, else `[]`, through `parseBlockedAsins`.
- `ListingSettingsGroup.listingRules: ListingRulesConfig`; `CreateListingSettingsGroupRequest.listingRules?` and `UpdateListingSettingsGroupRequest.listingRules?`.
- `StoreSettings.blockedAsins?: string[] | null` (raw row, NULL = inherit); the resolved settings carry `blockedAsins: string[]`.
- `SaveStoreSettingsRequest.blockedAsins?: string[] | null`, with the `listingRules` field removed.
- `PROMOTED_AD_RATE_*` and `DEFAULT_PROMOTED_AD_RATE` are deleted, after grepping that nothing else uses them.
- `resolveListingRules(store, global)` is deleted; its only users move to group reads in Task 5.

- [ ] **Step 1: Failing tests.** In `listing-rules.spec.ts`:
  - delete the `promotedAdRate` and `blockedAsins` normalize tests;
  - change the BLOCKED_ASIN evaluate test to call `isAsinBlocked(['B0AAAAAAAA'], 'b0aaaaaaaa')` (case-insensitive → true);
  - add:

```ts
describe('normalizeMinRating', () => {
  it.each([
    [4.5, 4.5], ['4,5', 4.5], ['4.55', 4.6], [1, 1], [5, 5],
    [0.9, null], [5.1, null], ['', null], ['abc', null], [null, null],
  ])('%p → %p', (input, expected) => {
    expect(normalizeMinRating(input)).toBe(expected);
  });
  it('normalizeListingRules uses it', () => {
    expect(normalizeListingRules({ minRating: '3,5' }).minRating).toBe(3.5);
  });
});

describe('resolveBlockedAsins', () => {
  it('store list wins, an explicit empty store list blocks nothing', () => {
    expect(resolveBlockedAsins(['B0AAAAAAAA'], ['B0BBBBBBBB'])).toEqual(['B0AAAAAAAA']);
    expect(resolveBlockedAsins([], ['B0BBBBBBBB'])).toEqual([]);
  });
  it('a NULL store list inherits the global one; no list at all is none', () => {
    expect(resolveBlockedAsins(null, ['B0BBBBBBBB'])).toEqual(['B0BBBBBBBB']);
    expect(resolveBlockedAsins(null, null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them** (`pnpm --filter @repo/shared build; pnpm --filter api exec jest src/modules/listings/listing-rules.spec.ts`) and confirm they fail.
- [ ] **Step 3: Implement.** In `isAsinBlocked`, compare uppercased values.
  - `normalizeMinRating`:
    - a string has its comma replaced and is parsed with `Number`;
    - non-finite → `null`;
    - `Math.round(v * 10) / 10`;
    - bounds check → `null` if outside.
  - Remove the dropped fields from `DEFAULT_LISTING_RULES` and from `normalizeListingRules`.
- [ ] **Step 4: Run the tests** and confirm they pass. Then run `pnpm --filter @repo/shared build`, api `tsc`, and web `tsc`. Callers break here as expected (they are fixed in Tasks 3–7): record the failing files in the ledger and continue.
- [ ] **Step 5: Commit** — `feat(shared): listing rules move to the settings group shape; blocked ASINs are their own list`.

---

### Task 2: Migration 141

**Files:**
- Create: `apps/api/migrations/141_listing_rules_in_group.sql`

```sql
-- Listing rules move from store settings into each Listing Settings Group
-- (operator decision 2026-10-03, spec Part A). Blocked ASINs get their own
-- store-settings column (Store > Global, NULL = inherit). The ad-rate setting
-- is dropped from the rules (Ad Campaigns replace it).

ALTER TABLE listing_settings_groups ADD COLUMN IF NOT EXISTS listing_rules JSONB NULL;
COMMENT ON COLUMN listing_settings_groups.listing_rules IS
  'ListingRulesConfig for listings of this group (normalized; NULL = defaults: VeRO on, brand hidden).';

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS blocked_asins JSONB NULL;
COMMENT ON COLUMN store_settings.blocked_asins IS
  'ASINs never listed for this scope. NULL = inherit: a store row follows the global row, a global NULL is none.';

-- Each user's GLOBAL rules (minus the two fields that left them) become every
-- one of their groups' rules. Per-store rule rows are dropped by design
-- (production held only one global row, read 2026-10-03).
UPDATE listing_settings_groups grp
   SET listing_rules = (ss.listing_rules - 'blockedAsins' - 'promotedAdRate')
  FROM store_settings ss
 WHERE ss.user_id = grp.user_id
   AND ss.is_global = TRUE
   AND ss.listing_rules IS NOT NULL
   AND jsonb_typeof(ss.listing_rules) = 'object'
   AND grp.listing_rules IS NULL;

-- Blocked ASINs keep their scope: each row's list moves to its own column.
UPDATE store_settings
   SET blocked_asins = listing_rules->'blockedAsins'
 WHERE listing_rules IS NOT NULL
   AND jsonb_typeof(listing_rules) = 'object'
   AND jsonb_typeof(listing_rules->'blockedAsins') = 'array'
   AND jsonb_array_length(listing_rules->'blockedAsins') > 0
   AND blocked_asins IS NULL;
```

- [ ] **Step 1: Apply to a stock Postgres.** Run `docker run -d --name sh-mig -e POSTGRES_PASSWORD=x -e POSTGRES_DB=testdb pgvector/pgvector:0.8.1-pg16`, run `CREATE ROLE sellerhill_user LOGIN;`, then pipe `docker/postgres/init.sql` and every migration in order through `psql -v ON_ERROR_STOP=1`. Expected: exit 0.
- [ ] **Step 2: Data check in the same container:**
  - insert a user (copy the INSERT used in the 2026-10-03 verification: `users (id, email, password_hash, first_name, last_name)`);
  - insert a global `store_settings` row with `listing_rules = '{"minRating":4,"blockedAsins":["B0AAAAAAAA"],"promotedAdRate":5}'` and a group (`listing_settings_groups` with the NOT NULL columns of migration 004);
  - re-run only 141's two UPDATEs.
  - Expected: the group's `listing_rules` = `{"minRating": 4}`, and the global row's `blocked_asins` = `["B0AAAAAAAA"]`.
- [ ] **Step 3: Commit** — `feat(db): 141 listing rules per settings group, blocked ASINs per store`.

---

### Task 3: API — the settings group stores its rules

**Files:**
- Modify:
  - `apps/api/src/modules/listing-settings-groups/listing-settings-group.service.ts`: entity at 20–34, create at 113–143, update at 148–206, `mapToDto` at 286–326;
  - `dto/create-listing-settings-group.dto.ts`;
  - `dto/update-listing-settings-group.dto.ts`.
- Test: `apps/api/src/modules/listing-settings-groups/listing-settings-group-rules.spec.ts` (new).

**Interfaces — Produces:**
- Every group DTO carries a normalized `listingRules`.
- Create and update accept `listingRules` (`@IsOptional() @IsObject()`). The value is normalized before it is stored. When omitted on update, the column is left unchanged.

- [ ] **Step 1: Failing test.** Build the service with a fake `db.query` that records SQL and parameters.
  - `create(userId, { ...minimal, listingRules: { minRating: '4,5', hideBrand: false } })` must store `JSON.stringify(normalizeListingRules(...))`, so `minRating` 4.5 and `hideBrand` false.
  - `mapToDto` of a row with `listing_rules: null` must give `veroProtectionEnabled: true` and `hideBrand: true`.
  - An update without `listingRules` must not touch the column: no `listing_rules =` in the SQL.
- [ ] **Step 2: Run it** (`pnpm --filter api exec jest src/modules/listing-settings-groups`) and confirm it fails.
- [ ] **Step 3: Implement.**
  - Add `listing_rules?: unknown` to the entity.
  - In create, add the column and `$n` with `JSON.stringify(normalizeListingRules(dto.listingRules))`. This always writes, so a new group starts with the explicit defaults.
  - In update, mirror the `content` block: `if (dto.listingRules !== undefined) { updates.push(\`listing_rules = $${paramIndex++}\`); values.push(JSON.stringify(normalizeListingRules(dto.listingRules))); }`.
  - In `mapToDto`, set `listingRules: normalizeListingRules(entity.listing_rules)`.
  - In the DTOs, add `@ApiPropertyOptional() @IsOptional() @IsObject() listingRules?: ListingRulesConfig;`.
- [ ] **Step 4: Run the tests** and confirm they pass. `PREPARE` the create INSERT against the Task 2 container (`PREPARE p AS INSERT …`).
- [ ] **Step 5: Commit** — `feat(api): listing settings groups store their own listing rules`.

---

### Task 4: API — store settings: blocked ASINs in, listing rules out

**Files:**
- Modify:
  - `apps/api/src/modules/store-settings/store-settings.service.ts`;
  - `apps/api/src/modules/store-settings/dto/save-store-settings.dto.ts` (lines 229–237).
- Test: `apps/api/src/modules/store-settings/store-settings-resolution.spec.ts`.

**Interfaces — Produces:**
- `getResolvedSettings(...).blockedAsins: string[]`, set to `resolveBlockedAsins(store.blockedAsins, global.blockedAsins)`.
- Raw rows: `blockedAsins: string[] | null`.
- Save: `blockedAsins` omitted = unchanged; `null` = inherit; an array is stored after `parseBlockedAsins`.

**Key move:** in both upserts, the `listing_rules` column and its provided-flag CASE are replaced by `blocked_asins` with the **same placeholders**:
- global: `$21::jsonb` and `$22::boolean`;
- store: `$22::jsonb` and `$23::boolean`.

The `$24` / `$25` guards for `allow_cross_store_asins` therefore stay valid.

- A new store row's `blocked_asins` comes from its raw parameter, so NULL means inherit; it is **not** seeded from the global row.
- The `listingRules` DTO field is deleted. The app's `ValidationPipe` uses `whitelist: true`; check `main.ts`. If it does not, strip the field explicitly in the service. Either way, an old client sending it is ignored (Review Focus 5).

- [ ] **Step 1: Failing tests** in `store-settings-resolution.spec.ts`:

```ts
describe('blocked ASINs are Store > Global', () => {
  // build a service whose global row has blocked_asins ['B0GGGGGGGG']
  it('a store NULL inherits the global list', async () => { /* expect ['B0GGGGGGGG'] */ });
  it("a store's explicit [] blocks nothing", async () => { /* expect [] */ });
  it('the raw store row keeps NULL', async () => { /* getSettings → blockedAsins null */ });
});
it('save writes blocked_asins with an omitted-means-unchanged flag and no longer writes listing_rules', () => {
  expect(SOURCE).toMatch(/blocked_asins = CASE\s+WHEN \$22::boolean THEN EXCLUDED\.blocked_asins\s+ELSE store_settings\.blocked_asins/);
  expect(SOURCE).toMatch(/blocked_asins = CASE\s+WHEN \$23::boolean THEN EXCLUDED\.blocked_asins\s+ELSE store_settings\.blocked_asins/);
  expect(SOURCE).not.toMatch(/listing_rules = CASE/);
  expect(SOURCE).not.toMatch(/g\.blocked_asins/);
});
```

  Copy the fake-DB `buildWith` helper already in that spec. Add `blocked_asins: null` to its `row()` fixture.
- [ ] **Step 2: Run** `pnpm --filter api exec jest src/modules/store-settings` and confirm it fails.
- [ ] **Step 3: Implement.**
  - Entity: `blocked_asins: unknown`.
  - `mapToDto`: `blockedAsins: Array.isArray(entity.blocked_asins) ? parseBlockedAsins(entity.blocked_asins) : null`, and remove `listingRules`.
  - `getResolvedSettings`: replace `withRules`' `listingRules` line with `blockedAsins: resolveBlockedAsins(settings.blockedAsins, globalSettings.blockedAsins)`.
  - `saveSettings`:
    - `const blockedAsinsProvided = blockedAsins !== undefined;`
    - `const blockedAsinsJson = Array.isArray(blockedAsins) ? JSON.stringify(parseBlockedAsins(blockedAsins)) : null;`
    - swap the column in both INSERT lists and both UPDATE CASEs.
  - Delete the `listingRules` DTO field and add `@IsOptional() @IsArray() @IsString({ each: true }) blockedAsins?: string[] | null;`. Allow null with `@ValidateIf((_o, v) => v !== null)` on the array checks.
- [ ] **Step 4: Run the tests** and confirm they pass. `PREPARE` both upserts against the Task 2 container. The 2026-10-03 extraction script in the scratchpad (`extract-sql.js`) pulls them out of the source.
- [ ] **Step 5: Commit** — `feat(api): blocked ASINs are their own Store > Global list; store settings stop carrying listing rules`.

---

### Task 5: API — every reader takes rules from the group; auto-promote removed

**Files:**
- Modify:
  - `apps/api/src/modules/listings/listing-processor.service.ts` (298–303, 344, 395–397, 410, 420, 621–627, 641–656, constructor 161, import 50);
  - `listing-strategy.service.ts` (100–125);
  - `listing-cleanup.helpers.ts`;
  - `listing-cleanup.service.ts`;
  - `action-center/action-center.service.ts` (775–797);
  - `listings.service.ts` (61, 262, 2423–2424);
  - `listings.module.ts` (24, 82).
- Delete: `apps/api/src/modules/listings/listing-promotion.service.ts`.
- Test:
  - `listing-cleanup.helpers.spec.ts` (rewrite the plan tests);
  - `listing-strategy-title.spec.ts` (`buildGroup` gets `listingRules`);
  - new `listing-rules-source.guard.spec.ts`.

**Interfaces:**
- Consumes `ListingSettingsGroupResponse.listingRules` (Task 3) and the resolved `blockedAsins` (Task 4).
- Produces:
  - `buildGroupRuleSql(alias: string, field: 'outOfStockEndDays' | 'coldListingDays' | 'coldListingAutoEnd'): string`. It is a SQL expression reading the listing's group rule: `(SELECT (gr.listing_rules->>'<field>')::<int|boolean> FROM listing_settings_groups gr WHERE gr.id = <alias>.listing_settings_group_id)`. The field comes from a literal union only.
  - `buildCleanupCandidateSql(reason)`: parameters become `$1 user, $2 store, $3 limit`, and the day count is read per listing from its group.

**Steps:**
- [ ] **Step 1: Failing guard and SQL tests.**

```ts
// listing-rules-source.guard.spec.ts
const read = (rel: string) => readFileSync(join(__dirname, rel), 'utf8');
it('the create worker reads rules from the job group and blocked ASINs from the store', () => {
  const src = read('listing-processor.service.ts');
  expect(src).not.toMatch(/resolvedStoreSettings\.listingRules/);
  expect(src).toMatch(/normalizeListingRules\(\s*\w+\.listingRules\s*\)/);
  expect(src).toMatch(/isAsinBlocked\(\s*resolvedStoreSettings\.blockedAsins/);
});
it('hideBrand comes from the group', () => {
  expect(read('listing-strategy.service.ts')).toMatch(/group\.listingRules\.hideBrand/);
});
it('clean-up, not-selling and the Action Center read the group, never store_settings.listing_rules', () => {
  for (const f of ['listing-cleanup.helpers.ts', 'listing-cleanup.service.ts', '../action-center/action-center.service.ts']) {
    expect(read(f)).not.toMatch(/store_settings[\s\S]{0,80}listing_rules/);
    expect(read(f)).toMatch(/listing_settings_groups|buildGroupRuleSql/);
  }
});
it('auto-promote after create/publish is gone', () => {
  expect(read('listings.service.ts')).not.toMatch(/promoteNewListings/);
  expect(read('listing-processor.service.ts')).not.toMatch(/promoteNewListings/);
  expect(existsSync(join(__dirname, 'listing-promotion.service.ts'))).toBe(false);
});
```

  In `listing-cleanup.helpers.spec.ts`, replace the `planListingCleanup` tests with SQL-shape tests:
  - `buildCleanupCandidateSql(OUT_OF_STOCK)` contains `listing_settings_groups` and `'outOfStockEndDays'` and no `$4`;
  - the NOT_SELLING variant requires `'coldListingAutoEnd'`;
  - `buildNotSellingSql('l')` reads `'coldListingDays'` from the group and does not contain `store_settings`.
- [ ] **Step 2: Run** `pnpm --filter api exec jest src/modules/listings src/modules/action-center` and confirm the failures.
- [ ] **Step 3: Implement.**
  - **Processor:**
    - fetch the group once per batch, before the item loop: `const group = await this.listingStrategyService.getSettingsGroup(userId, listingSettingsGroupId); const listingRules = normalizeListingRules(group.listingRules);`;
    - reuse that `group` at 420 instead of fetching it again;
    - replace `isAsinBlocked(listingRules, …)` with `isAsinBlocked(resolvedStoreSettings.blockedAsins, …)` at 344 and 395;
    - delete the promotion call (621–627), the import and the constructor parameter.
  - **Strategy (`prepareListingData`):** `const hideBrand = group.listingRules.hideBrand;` (drop the `storeSettings.listingRules` read; `storeSettings` is still needed for the blacklist).
  - **Cleanup helpers:**
    - delete `planListingCleanup`, `hasCleanupWork` and `cleanupSteps`;
    - in `buildCleanupCandidateSql`, the OUT_OF_STOCK `due` becomes `${days} IS NOT NULL AND l.quantity_zero_since <= NOW() - make_interval(days => ${days})`, where `days = buildGroupRuleSql('l','outOfStockEndDays')`. Keep the pause and lock guards;
    - NOT_SELLING requires `COALESCE(${buildGroupRuleSql('l','coldListingAutoEnd')}, FALSE)` plus the creation-date and no-order conditions on `buildGroupRuleSql('l','coldListingDays')`;
    - `LIMIT $3::int`;
    - `buildNotSellingSql(alias)` reads `buildGroupRuleSql(alias,'coldListingDays')` with the same body.
  - **Cleanup service:**
    - the store query becomes `SELECT a.id AS account_id, a.user_id FROM ebay_accounts a WHERE a.status = 'active' AND EXISTS (SELECT 1 FROM listing_settings_groups gr WHERE gr.user_id = a.user_id AND (gr.listing_rules->>'outOfStockEndDays' IS NOT NULL OR (gr.listing_rules->>'coldListingAutoEnd')::boolean IS TRUE)) ORDER BY a.id`;
    - per store, run both reasons in order (OUT_OF_STOCK, then NOT_SELLING) with `[user_id, account_id, limit]`;
    - drop `CleanupStoreRow.store_rules` and `.global_rules`.
  - **Action Center:** replace the store/global `coldListingAutoEnd` sub-select with `NOT COALESCE(${buildGroupRuleSql('l','coldListingAutoEnd')}, FALSE)`.
  - **Listings service and module:** remove the promotion injection and its call; delete the service file and its provider. `EbayPromotedListingsService` stays: `getEligibility` is still used by `ebay.controller.ts`, and Part B replaces the rest.
- [ ] **Step 4: Run the tests** and confirm they pass. Fix `listing-strategy-title.spec.ts`: `buildGroup` returns `listingRules: { ...DEFAULT_LISTING_RULES, hideBrand: false }` for the send-brand case, and the store-settings fake no longer carries `listingRules`. `PREPARE` against the Task 2 container:
  - both candidate SQLs (`EXECUTE` with a user and a store id);
  - the store query;
  - the Action Center count;
  - `buildNotSellingSql` inside `SELECT 1 FROM listings l WHERE …`.

  Then run the full `pnpm --filter api test`.
- [ ] **Step 5: Commit** — `refactor(api): listing rules are read from the listing's settings group; auto-promote removed`.

---

### Task 6: Web — the "Rules" step of the group drawer

**Files:**
- Modify: `apps/web/src/features/settings/drawers/ListingGroupDrawer/ListingGroupDrawer.{component,container,types,style}.tsx`.
- Create: `apps/web/src/features/settings/drawers/ListingGroupDrawer/ListingRulesStep/ListingRulesStep.{component,types,style}.tsx` and `index.ts`. It is presentational; its state lives in the group form.
- Modify: `packages/shared/src/i18n/resources/*/listingSettingsGroup.json` (16 files).
- Modify: `packages/shared/src/schemas/listing-settings-groups/listingSettingsGroup.schema.ts`.
- Test:
  - `apps/web/src/features/settings/drawers/ListingGroupDrawer/listingRulesForm.test.ts`;
  - a pure `toListingRulesForm` / `fromListingRulesForm` in `ListingGroupDrawer/listingRulesForm.ts`.

**Interfaces:**
- Form field `listingRules` in `ListingSettingsGroupFormData`, holding strings for the numeric inputs.
- `fromListingRulesForm(form): ListingRulesConfig` converts with `normalizeMinRating` and `Number`, where empty means null.
- `listingRulesFormError(form): 'minRating' | 'price' | 'coldDays' | null` returns the first invalid field.

**Steps:**
- [ ] **Step 1: Failing Vitest:**
  - `fromListingRulesForm({ minRating: '4,5', … })` gives `minRating` 4.5;
  - `minRating: '6'` → `listingRulesFormError` = `'minRating'`;
  - empty strings → nulls;
  - `toListingRulesForm(DEFAULT_LISTING_RULES)` round-trips.
- [ ] **Step 2: Run it** (`pnpm --filter web exec vitest run src/features/settings/drawers/ListingGroupDrawer`) and confirm it fails.
- [ ] **Step 3: Implement the helpers.** Then the drawer:
  - **Step order:** `ListingGroupDrawerStep = 0|1|2|3|4`; `stepLabels` gets `t('listingSettingsGroup.rules.title')` before the HTML template; the template moves to index 4; `isLastStep` is `=== 4`; the `handleNext` bound becomes 4; `canProceed` case 3 is `listingRulesFormError(watched.listingRules) === null`.
  - **Defaults and reset:** `listingRules: toListingRulesForm(group?.listingRules ?? DEFAULT_LISTING_RULES)`.
  - **Submit:** `listingRules: fromListingRulesForm(data.listingRules)`.
  - **`ListingRulesStep` cards**, moved from `ListingRulesDrawer.component.tsx` (67–213), keeping their behaviour: Brand protection (VeRO and hide-brand toggles, warning when VeRO is off); "What may be listed" (min/max price, Amazon-shipped toggle, **minimum rating as `ModernTextInput` with `inputMode="decimal"`, helper "1.0–5.0" and `errorMessage` on a failed Continue**, minimum ratings count); Clean-up (out-of-stock days select, the cold watch toggle with days and mode). No blocked-ASINs card and no promoted card.
  - **i18n:** a script copies each locale's `storeSettings.listingRules.{title,subtitle,off,brand,filters,cleanup}` subtree into `listingSettingsGroup.json` as `listingSettingsGroup.rules.*` (EOL-preserving; `JSON.parse` check). It then adds, in all 16 locales, `rules.filters.minRatingHint` ("Between 1.0 and 5.0, for example 4.5" / "1.0 ile 5.0 arası, örneğin 4,5") and `rules.filters.minRatingError` ("Enter a rating between 1.0 and 5.0." / "1,0 ile 5,0 arasında bir puan girin."). `ratingOption` is not copied (it was the dropdown's).
  - **Zod:** `listingSettingsGroupSchema` gains `listingRules: z.any().optional()`. Validation lives in `listingRulesFormError`, because the form holds strings.
- [ ] **Step 4: Run the tests** and confirm they pass. Then web `tsc`, the web tests and eslint on the changed files.
- [ ] **Step 5: Commit** — `feat(web): listing rules are a step of the listing settings group`.

---

### Task 7: Web — blocked ASINs in the Blacklist drawer; listing-rules drawer removed

**Files:**
- Modify: `apps/web/src/features/settings/drawers/BlacklistDrawer/BlacklistDrawer.{container,component,types,style}.tsx`.
- Delete: `apps/web/src/features/settings/drawers/ListingRulesDrawer/`, plus its export in `drawers/index.ts:26-27`.
- Modify:
  - `SettingsPage/SettingsHubPage.{component,container,types}.tsx`: the row at component 141–146, `onOpenListingRules`, the drawer at 321–336;
  - `apps/web/src/features/ebay/api/ebayApi.ts`: remove `useGetEbayAdvertisingEligibilityQuery` only if nothing else uses it (grep; Part B will use eligibility, so keeping it is fine);
  - `translation.json` (16): `settingsHub.drawer.blacklist.blockedAsins.{title,hint,placeholder,count}`, copied from `storeSettings.listingRules.blockedAsins.*` plus a hint;
  - `storeSettings.json` (16): delete the `storeSettings.listingRules` block;
  - `translation.json` (16): delete `settingsHub.sections.storeManagement.listingRules` and `listingRulesSubtitle`.
- Test: `apps/web/src/features/settings/drawers/BlacklistDrawer/blockedAsinsDraft.test.ts`.

**Interfaces:**
- Consumes: `StoreSettings.blockedAsins` (raw, NULL = inherit) and `SaveStoreSettingsRequest.blockedAsins` (Task 1).
- Produces: `blockedAsinsDraft(config, globalConfig): { text: string; inherited: boolean }`. A store row with NULL shows the global list marked "inherited"; `toSaveBlockedAsins(text, inheritedUntouched)` returns `undefined` (unchanged) when the seller did not edit an inherited list, else `parseBlockedAsins(text)`.

**Steps:**
- [ ] **Step 1: Failing Vitest:**
  - a NULL store list with a global `['B0GGGGGGGG']` → text `B0GGGGGGGG`, `inherited: true`;
  - untouched → `toSaveBlockedAsins` gives `undefined`;
  - edited to empty → `[]`.
- [ ] **Step 2: Run it** and confirm it fails. **Step 3: Implement**:
  - **Blacklist drawer:** a second card below the keywords: a `Textarea`, the valid-count line and the "inherited" caption when inherited. The save sends `blockedAsins: toSaveBlockedAsins(...)`. `hasChanges` also compares the blocked text.
  - **Hub:** delete the row, the drawer and the props. In `SettingsHubPage.container.tsx`, map an incoming `?drawer=storeListingRules` to `listingGroupsAll` with `replace`, so old links land on the groups.
  - **i18n:** the add and prune scripts must preserve EOLs and pass a `JSON.parse` check on all 16 locales; diff stats must show only the intended lines.
- [ ] **Step 4: Run the tests** and confirm they pass. Then web `tsc`, the web tests, and `pnpm lint`.
- [ ] **Step 5: Commit** — `feat(web): blocked ASINs live in the blacklist drawer; the listing-rules drawer is gone`.

---

### Task 8: Verification, demo, docs

**Files:**
- Modify:
  - `apps/web/src/features/demo/demoData.ts`: give the demo groups `listingRules` (VeRO on, hideBrand on, one group with `minRating: 4` and `outOfStockEndDays: 14`); add `blockedAsins: null` on store rows and `['B0SH000001']` on the global row;
  - `CLAUDE.md`: rewrite the "Listing rules, VeRO protection…" bullets (rules per group, blocked ASINs per store, no auto-promote) and add migration row `141`;
  - the spec: mark Part A built.

**Steps:**
- [ ] **Step 1: Full checks:** `pnpm --filter @repo/shared build && pnpm --filter @repo/ui build`, api `tsc`, `pnpm --filter api test`, web `tsc`, `pnpm --filter web test`, `pnpm lint`. Re-run all 141 migrations on a fresh stock container.
- [ ] **Step 2: Demo browser check** at 1440 and 375 px:
  - the group drawer shows five steps with Rules fourth;
  - rating `4,5` is accepted and `6` is refused on Continue;
  - the Blacklist drawer shows the blocked-ASIN card;
  - `/settings?drawer=storeListingRules` lands on the groups drawer;
  - no horizontal overflow.
- [ ] **Step 3: Production read-only check** (`claude_ro`): `SELECT COUNT(*) FROM store_settings WHERE listing_rules IS NOT NULL` and the group count per user. This confirms what the migration will copy, before shipping.
- [ ] **Step 4: Commit the docs and push `development`.** The UAT/main merge is the operator's call.
