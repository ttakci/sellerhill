# Plan 1b: Style Token & Typography Consistency Pass

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Refactor every hardcoded style value across `apps/web/src/` and the affected `packages/ui/src/` files so the design system is actually enforced — every font-size/weight, spacing value, and color comes from `tkn()` or the `<Text>` atom. Then enable the previously-disabled `design-system/*` ESLint rules so future regressions are blocked at commit time.

**Architecture:** Two patterns of fix:
- **Token substitution** (mechanical): replace `font-size: 0.875rem` → `${tkn('typography.fontSize.sm')}`, `padding: 16px` → `${tkn('spacing.md')}`, `color: #ffffff` → `${tkn('colors.text.inverse')}`. No JSX changes.
- **Typography atom migration** (structural): every `styled.h1/h2/h3/h4/h5/p` usage gets removed from the style file, and the consuming component imports `<Text>` from `@repo/ui` with the matching `variant`. Extra layout-specific styling (margin, color, alignment) is applied via `<Text>` props or wrapped in an Emotion `<S.HeadingWrapper>` if the styling is non-typographic.

**Tech Stack:** Emotion 11, TypeScript 5, React 18. Custom ESLint plugin at `eslint-plugin-design-system.js`.

## Global Constraints

- **No hardcoded values** in `apps/web/src/**/*.style.ts`: no `font-size: Xrem`, `font-weight: N`, `padding/margin/gap: Xpx`, `#hexcolor`, `rgba(...)`. Everything via `tkn()`.
- **No `styled.h1/h2/h3/h4/h5/p/span`** in `apps/web/src/**` — use `<Text>` atom with `variant`.
- **ESLint plugin `design-system`** is registered in `.eslintrc.json` `plugins` array; rules enabled at end of plan.
- **Landing page is OUT OF SCOPE** per project memory (`project-figma-redesign.md`) — `apps/web/src/features/landing/` files are not touched even if they have violations (they're a separate intentional design system).
- **Auth pages** (`/login`, `/register`, `/verify-email`, `/auth/check-email`) ARE in scope — they should use the same tokens as the authenticated app.
- **`packages/ui/src/atoms/Text/Text.style.ts`** keeps hardcoded font-sizes (they ARE the canonical typography values); not a violation.
- **Mono font exceptions** (`'JetBrains Mono'`, `ui-monospace`) are allowed where the context is genuinely monospaced (ID display, code). Keep them.
- **CLAUDE.md rules apply** — container/component split, no `any`, etc.

---

## File Map

**Style files to refactor (token substitution):**
- `apps/web/src/layouts/AppLayout/AppLayout.style.ts`
- `apps/web/src/components/Footer/Footer.style.ts`
- `apps/web/src/components/ErrorBoundary/ErrorBoundary.style.ts`
- `apps/web/src/features/dashboard/DashboardPage/DashboardPage.style.ts`
- `apps/web/src/features/listings/ListingsPage.style.ts`
- `apps/web/src/features/listings/add-listings/AddListingsPage.style.ts`
- `apps/web/src/features/listings/products/ProductsPage.style.ts`
- `apps/web/src/features/listings/listing-jobs/ListingJobsPage.style.ts`
- `apps/web/src/features/listings/listing-jobs/details/ListingJobDetailsPage.style.ts`
- `apps/web/src/features/orders/OrdersPage.style.ts`
- `apps/web/src/features/orders/details/OrderDetailsPage.style.ts`
- `apps/web/src/features/store-settings/StoreSettingsPage.style.ts`
- `apps/web/src/features/store-settings/components/BlacklistCard/BlacklistCard.style.ts`
- `apps/web/src/features/amazon/accounts/AmazonAccountsPage.style.ts`
- `apps/web/src/features/profile/ProfilePage.style.ts`
- `apps/web/src/features/listing-settings-groups/listing-settings-group-form/ListingSettingsGroupForm.style.ts`
- `apps/web/src/features/listing-settings-groups/ListingSettingsGroupPage.style.ts`
- `apps/web/src/features/ebay/stores/StoresPage.style.ts`
- `apps/web/src/features/ebay/onboarding/OnboardingEbayPage.style.ts`
- `apps/web/src/features/ebay/ebay-connect/EbayConnectPage.style.ts`
- `apps/web/src/features/auth/login/LoginPage.style.ts`
- `apps/web/src/features/auth/register/RegisterPage.style.ts`
- `apps/web/src/features/auth/verify-email/VerifyEmailPage.style.ts`
- `apps/web/src/features/auth/check-email/CheckEmailPage.style.ts`

**Component files needing `<Text>` migration** (where `styled.h1/h2/h3/h4/h5/p` consumers live):
- Determined per task by grepping for the styled-component name. The implementer reads the style file first to find the styled-component identifier (e.g., `const Title = styled.h1\`...\``), then greps the matching `.component.tsx` for `<Title>` usages.

**Config:**
- `.eslintrc.json` — register `design-system` plugin, enable rules

---

## Fix Patterns (apply uniformly)

### Pattern A: Hardcoded font-size / font-weight / line-height / letter-spacing

**Before:**
```typescript
font-size: 0.875rem;
font-weight: 700;
line-height: 1.25rem;
```

**After:**
```typescript
font-size: ${tkn('typography.fontSize.sm')};
font-weight: ${tkn('typography.fontWeight.bold')};
line-height: ${tkn('typography.lineHeight.normal')};
```

Mapping table (rem → token):

| rem | Token |
|---|---|
| 0.625rem (10px) | `typography.fontSize.2xs` |
| 0.6875rem (11px) | closest: `typography.fontSize.2xs` (or add new — flag in report) |
| 0.75rem (12px) | `typography.fontSize.xs` |
| 0.8125rem (13px) | closest: `typography.fontSize.xs` (or add `sm-`) — flag in report |
| 0.875rem (14px) | `typography.fontSize.sm` |
| 1rem (16px) | `typography.fontSize.md` |
| 1.125rem (18px) | `typography.fontSize.lg` |
| 1.25rem (20px) | `typography.fontSize.xl` |
| 1.5rem (24px) | `typography.fontSize.xxl` |

Font-weight mapping: 400→`normal`, 500→`medium`, 600→`semibold`, 700→`bold`.

Line-height: 1.2→`tight`, 1.5→`normal`, 1.625→`relaxed`. Other values: leave as literal in a comment + flag.

### Pattern B: Hardcoded spacing (padding / margin / gap)

**Before:**
```typescript
padding: 16px;
gap: 1rem;
```

**After:**
```typescript
padding: ${tkn('spacing.md')};
gap: ${tkn('spacing.md')};
```

Spacing mapping: 2px→`2xs`, 4px→`xs`, 8px→`sm`, 16px→`md`, 24px→`lg`, 32px→`xl`, 48px→`xxl`, 64px→`xxxl`. Non-standard values: flag in report — don't snap-fit silently.

### Pattern C: Hardcoded colors

**Before:**
```typescript
color: #ffffff;
background: #cbd5e1;
```

**After:**
```typescript
color: ${tkn('colors.text.inverse')};
background: ${tkn('colors.text.disabled')};   // or closest semantic match
```

Map by visual intent, not by hex match. `#ffffff` on dark background → `text.inverse`. `#cbd5e1` (slate-300) → `text.disabled` (light) or `border.primary` depending on context.

### Pattern D: `styled.h1/h2/h3/h4/h5/p` → `<Text>` migration

**Before** (style file):
```typescript
export const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 1rem;
`;
```

**Before** (component file):
```tsx
<Title>Hello, world</Title>
```

**After** (style file) — keep layout-only styling, drop typography:
```typescript
export const TitleWrapper = styled.div`
  margin-bottom: ${tkn('spacing.sm')};
`;
```

**After** (component file):
```tsx
import { Text } from '@repo/ui';

<TitleWrapper>
  <Text variant="h1" color="text.inverse">Hello, world</Text>
</TitleWrapper>
```

Or if no extra styling needed, drop the wrapper entirely:
```tsx
<Text variant="h1" color="text.inverse">Hello, world</Text>
```

If the styled.h1 had complex non-typographic styling (gradients, animations), keep the styled wrapper but change the tag from `styled.h1` to `styled.div` — then the rule stops firing AND the layout is preserved.

**Text variant mapping:** h1 tag → `variant="h1"`, h2 → `"h2"`, etc. Plain `styled.p` → `variant="body"` (or `"body-sm"` / `"caption"` based on context size).

---

## Tasks

### Task 1: Register `design-system` ESLint plugin (rules still commented)

**Files:** `.eslintrc.json`

- [ ] **Step 1:** Add `"design-system"` to the `plugins` array (plugin file is `eslint-plugin-design-system.js` at repo root — needs to be resolvable). If the plugin isn't auto-resolved, add `"plugins": ["@typescript-eslint", "import", "./eslint-plugin-design-system.js"]` or move the plugin into `packages/ui/src/eslint-plugin/` and reference it.

- [ ] **Step 2:** Add a commented block at the end of `rules`:
```json
// Design System Enforcement — enabled in Task 11 after violations cleaned
// "design-system/no-hardcoded-colors": "error",
// "design-system/no-hardcoded-spacing": "error",
// "design-system/no-inline-styles": "error",
// "design-system/no-styled-typography": "error",
// "design-system/no-bare-text-in-button": "error",
// "design-system/no-implicit-i18n-namespaces": "error",
// "design-system/no-native-select": "error",
```

- [ ] **Step 3:** Verify `pnpm lint` still passes (rules not yet enabled).
- [ ] **Step 4:** Commit: `chore(eslint): register design-system plugin (rules still disabled)`

---

### Task 2: Refactor auth pages

**Files:**
- `apps/web/src/features/auth/login/LoginPage.style.ts`
- `apps/web/src/features/auth/register/RegisterPage.style.ts`
- `apps/web/src/features/auth/verify-email/VerifyEmailPage.style.ts`
- `apps/web/src/features/auth/check-email/CheckEmailPage.style.ts`

Plus matching `.component.tsx` files IF they use `styled.h1/h2/p` consumers.

- [ ] **Step 1:** Apply Pattern A, B, C to all 4 style files.
- [ ] **Step 2:** Grep each style file for `styled.h1|h2|h3|h4|h5|p` — for each match, apply Pattern D (migrate to `<Text>`).
- [ ] **Step 3:** Verify `pnpm typecheck` + `pnpm lint` (lint still uses no design-system rules — just baseline).
- [ ] **Step 4:** Commit: `refactor(auth): use tkn() tokens and <Text> atom across all auth styles`

---

### Task 3: Refactor shared components (Footer, ErrorBoundary)

**Files:**
- `apps/web/src/components/Footer/Footer.style.ts`
- `apps/web/src/components/ErrorBoundary/ErrorBoundary.style.ts`

Plus `Footer.component.tsx`, `ErrorBoundary.component.tsx` if they consume styled.typography.

- [ ] **Step 1:** Apply Patterns A/B/C/D.
- [ ] **Step 2:** Verify typecheck + lint.
- [ ] **Step 3:** Commit: `refactor(web): tokens + Text atom in Footer and ErrorBoundary`

---

### Task 4: Refactor listings feature styles

**Files:**
- `apps/web/src/features/listings/ListingsPage.style.ts`
- `apps/web/src/features/listings/add-listings/AddListingsPage.style.ts`
- `apps/web/src/features/listings/products/ProductsPage.style.ts`
- `apps/web/src/features/listings/listing-jobs/ListingJobsPage.style.ts`
- `apps/web/src/features/listings/listing-jobs/details/ListingJobDetailsPage.style.ts`

- [ ] **Step 1:** Apply Patterns A/B/C/D.
- [ ] **Step 2:** Verify typecheck + lint.
- [ ] **Step 3:** Commit: `refactor(listings): tokens + Text atom across all listing screen styles`

---

### Task 5: Refactor orders feature styles

**Files:**
- `apps/web/src/features/orders/OrdersPage.style.ts`
- `apps/web/src/features/orders/details/OrderDetailsPage.style.ts`

- [ ] **Step 1:** Apply Patterns A/B/C/D.
- [ ] **Step 2:** Verify typecheck + lint.
- [ ] **Step 3:** Commit: `refactor(orders): tokens + Text atom in Orders list and detail styles`

---

### Task 6: Refactor dashboard styles

**Files:**
- `apps/web/src/features/dashboard/DashboardPage/DashboardPage.style.ts`

- [ ] **Step 1:** Apply Patterns A/B/C/D.
- [ ] **Step 2:** Verify typecheck + lint.
- [ ] **Step 3:** Commit: `refactor(dashboard): tokens + Text atom in Dashboard styles`

---

### Task 7: Refactor settings-related feature styles

**Files:**
- `apps/web/src/features/store-settings/StoreSettingsPage.style.ts`
- `apps/web/src/features/store-settings/components/BlacklistCard/BlacklistCard.style.ts`
- `apps/web/src/features/amazon/accounts/AmazonAccountsPage.style.ts`
- `apps/web/src/features/profile/ProfilePage.style.ts`
- `apps/web/src/features/listing-settings-groups/listing-settings-group-form/ListingSettingsGroupForm.style.ts`
- `apps/web/src/features/listing-settings-groups/ListingSettingsGroupPage.style.ts`

- [ ] **Step 1:** Apply Patterns A/B/C/D.
- [ ] **Step 2:** Verify typecheck + lint.
- [ ] **Step 3:** Commit: `refactor(settings): tokens + Text atom across all settings-related styles`

---

### Task 8: Refactor eBay feature styles

**Files:**
- `apps/web/src/features/ebay/stores/StoresPage.style.ts`
- `apps/web/src/features/ebay/onboarding/OnboardingEbayPage.style.ts`
- `apps/web/src/features/ebay/ebay-connect/EbayConnectPage.style.ts`

- [ ] **Step 1:** Apply Patterns A/B/C/D.
- [ ] **Step 2:** Verify typecheck + lint.
- [ ] **Step 3:** Commit: `refactor(ebay): tokens + Text atom in Stores, Onboarding, EbayConnect styles`

---

### Task 9: Refactor AppLayout.style.ts

**Files:** `apps/web/src/layouts/AppLayout/AppLayout.style.ts`

This file had a partial audit in Plan 1 Task 7 (colors only). Now complete it: font-size/font-weight/line-height/letter-spacing + any remaining spacing values.

- [ ] **Step 1:** Apply Patterns A/B (colors already done).
- [ ] **Step 2:** For each `styled.h1/h2/h3/h4/h5/p` (if any remain), apply Pattern D.
- [ ] **Step 3:** Verify typecheck + lint.
- [ ] **Step 4:** Commit: `refactor(web): AppLayout.style typography + spacing tokens`

---

### Task 10: Verify landing untouched

**Files:** read-only check on `apps/web/src/features/landing/LandingPage.style.ts`

- [ ] **Step 1:** Confirm landing files were NOT touched in Tasks 2-9. Run `git diff 76dbca3..HEAD -- apps/web/src/features/landing/` and verify empty.
- [ ] **Step 2:** Commit nothing — this is a verification gate. If anything in landing changed, revert it.

---

### Task 11: Enable `design-system/*` ESLint rules as `error`

**Files:** `.eslintrc.json`

- [ ] **Step 1:** Uncomment all the design-system rules. Final `rules` block addition:
```json
"design-system/no-hardcoded-colors": "error",
"design-system/no-hardcoded-spacing": "error",
"design-system/no-inline-styles": "error",
"design-system/no-styled-typography": "error",
"design-system/no-bare-text-in-button": "error",
"design-system/no-implicit-i18n-namespaces": "error",
"design-system/no-native-select": "error",
```

- [ ] **Step 2:** Run `pnpm lint`. Expected: PASS with zero warnings (because Tasks 2-9 cleaned all violations).
- [ ] **Step 3:** If lint FAILS, the failing rule + file is a missed violation — dispatch a fix subagent to clean it (apply the appropriate Pattern A/B/C/D), then re-run.
- [ ] **Step 4:** Commit: `chore(eslint): enable design-system rules as error (violations cleaned)`

---

## Self-Review Checklist

After all 11 tasks land:
- [ ] `pnpm lint` PASS with all `design-system/*` rules enabled
- [ ] `pnpm typecheck` PASS
- [ ] `git diff 76dbca3..HEAD -- apps/web/src/features/landing/` is empty (landing untouched)
- [ ] No `styled.h1|h2|h3|h4|h5|p` in `apps/web/src/` (grep returns 0 matches)
- [ ] No hardcoded `font-size:|font-weight:|padding:|margin:|gap:` literals in `apps/web/src/**/*.style.ts` (excluding mono font exceptions and 1px borders)
- [ ] No hardcoded `#hex` or `rgba(...)` in `apps/web/src/**/*.style.ts`

## Execution Handoff

Plan complete. Execute via superpowers:subagent-driven-development.

Recommended model tiers:
- Tasks 1, 11 (config): haiku
- Tasks 2-9 (mechanical token substitution): haiku for simple files, sonnet for files with `styled.h1/h2/p` consumers requiring JSX migration
- Task 10 (verification): haiku
