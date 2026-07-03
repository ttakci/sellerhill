# Plan 1c: Enable `design-system/*` Rules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Clean the remaining 205 in-scope violations across `packages/ui/src/` + `apps/web/src/` so the 5 styling-related `design-system/*` rules can finally be enabled as `error`. After this plan, `pnpm lint` enforces: no-hardcoded-colors, no-hardcoded-spacing (padding/margin/gap), no-styled-typography, no-inline-styles, no-bare-text-in-button.

**Out of scope (rules stay disabled):**
- `no-implicit-i18n-namespaces` — 383 violations, separate i18n compliance effort
- `no-native-select` — 1 violation, will be fixed when ModernSelect migration happens

**Architecture:** Three layers of fix:
1. **Token substitution** in `packages/ui/src/**/*.style.ts` — same patterns A/B/C from Plan 1b
2. **Canonical-value eslint-disable** — `Text.style.ts` and a few atoms where the canonical typography values live get `// eslint-disable-next-line design-system/no-hardcoded-spacing` comments where appropriate (atoms DEFINE the canonical values; they can't reference themselves recursively)
3. **Structural cleanup** in component files — extract inline-styles to styled components, wrap Button text in `<Text>`

**Tech Stack:** Emotion 11, TypeScript 5, custom ESLint plugin at `packages/ui/src/eslint-plugin/index.js`.

## Global Constraints

- Token category discipline (CRITICAL — was a violation in Plan 1b Task 3):
  - `tkn('typography.fontSize.*')` ONLY for `font-size:`
  - `tkn('typography.fontWeight.*')` ONLY for `font-weight:`
  - `tkn('spacing.*')` ONLY for `padding/margin/gap` (NOT width/height)
  - `tkn('colors.*')` ONLY for `color/background/border-color`
- **Canonical-value exemption:** `packages/ui/src/atoms/Text/Text.style.ts` holds the canonical `font-size: 1.5rem` etc. values that DEFINE the typography scale. These CANNOT use `tkn('typography.fontSize.*')` (recursive). They get `// eslint-disable-next-line design-system/no-hardcoded-spacing` (and similar) comments instead.
- Other atoms (Button, Card, Modal, etc.) that have hardcoded values: try to use tokens first. Only eslint-disable if the value IS defining a canonical reference (e.g. radius tokens in a `radius.ts` file).
- After each task: `pnpm typecheck` and `pnpm lint` (lint still passes because rules disabled). Commit only on green.
- Do NOT touch `apps/web/src/features/landing/` — out of scope.

---

## Task 1: Refactor `packages/ui/src/atoms/` styles

**Files (clean violations):**
- `packages/ui/src/atoms/Alert/Alert.style.ts`
- `packages/ui/src/atoms/Badge/Badge.style.ts`
- `packages/ui/src/atoms/Button/Button.style.ts`
- `packages/ui/src/atoms/Card/Card.{component,style}.tsx`
- `packages/ui/src/atoms/Dropdown/Dropdown.{component,style}.tsx`
- `packages/ui/src/atoms/IconButton/IconButton.style.ts`
- `packages/ui/src/atoms/Icon/Icon.component.tsx`
- `packages/ui/src/atoms/MeshBackground/MeshBackground.component.tsx`
- `packages/ui/src/atoms/Modal/Modal.style.ts`
- `packages/ui/src/atoms/Tabs/Tabs.style.ts`
- `packages/ui/src/atoms/Text/Text.{component,style}.tsx`
- `packages/ui/src/atoms/Textarea/Textarea.style.ts`

**Approach:**
1. Run `pnpm lint --no-cache 2>&1 | grep -B1 "atoms/"` to get the EXACT violation list per file
2. For each violation: apply Patterns A/B/C from Plan 1b plan (`docs/superpowers/plans/2026-07-03-plan-1b-style-consistency-pass.md`)
3. **Special case — `Text.style.ts`:** the variant font-sizes (1.5rem for h1, etc.) are CANONICAL — they DEFINE the typography scale. Replace each `font-size: 1.5rem` with `// eslint-disable-next-line design-system/no-hardcoded-spacing` on the prior line. Do NOT use tkn() — it would be recursive.
4. Same canonical exemption for `radius` values in any atom that defines a corner radius matching `radiusTokens`.
5. For Dropdown/Modal/Tabs/IconButton styles: use real `tkn()` calls for spacing/colors.

**Verify:** `pnpm typecheck` PASS, `pnpm lint` (rules still disabled — baseline) PASS.
**Commit:** `refactor(ui/atoms): tkn() substitutions + canonical-value eslint-disable in Text.style`

---

## Task 2: Refactor `packages/ui/src/molecules/` styles

**Files (clean violations):**
- All `packages/ui/src/molecules/*/{*.style.ts, *.component.tsx}` with violations — get list via `pnpm lint --no-cache 2>&1 | grep -B1 "molecules/"`

**Approach:**
1. Get exact violation list
2. Apply Patterns A/B/C for token substitution
3. For `no-bare-text-in-button` violations in molecule components: wrap Button children in `<Text>`
4. For `no-styled-typography`: migrate `styled.h1/h2/p` to `<Text>` atom (per Plan 1b Pattern D). NOTE: molecules SHOULD use `<Text>` — they're not canonical value holders.
5. For `no-inline-styles` violations: extract to styled components

**Verify:** typecheck + lint baseline PASS.
**Commit:** `refactor(ui/molecules): tkn() substitutions + Text atom migration + Button text wrapping`

---

## Task 3: Refactor `packages/ui/src/organisms/` styles

**Files:**
- `packages/ui/src/organisms/DataTable/DataTable.{component,style}.tsx`
- `packages/ui/src/organisms/DataTable/ColumnManager.tsx`

**Approach:**
1. Get violations
2. Extract inline-styles to styled components (the `style={{ ... }}` patterns in DataTable/ColumnManager likely compute dynamic widths — extract to a styled component that accepts a prop)
3. Token substitution for spacing/colors

**Verify:** typecheck + lint baseline PASS.
**Commit:** `refactor(ui/organisms): tkn() substitutions + extract DataTable inline styles`

---

## Task 4: Refactor `apps/web/src/` remaining violations

**Files:** all `apps/web/src/` files with violations — get list via `pnpm lint --no-cache 2>&1 | grep -B1 "apps/web/"` excluding landing

**Approach:**
1. Get violations
2. Most will be:
   - `no-bare-text-in-button` — wrap Button children in `<Text>` (heavy in feature component files)
   - `no-inline-styles` — extract to styled components
   - Residual `no-hardcoded-spacing` / `no-hardcoded-colors` / `no-styled-typography` missed in Plan 1b
3. Apply patterns mechanically

**Verify:** typecheck + lint baseline PASS.
**Commit:** `refactor(web): clean residual style violations (Button text, inline-styles, missed tokens)`

---

## Task 5: Enable rules + verify

**Files:** `.eslintrc.json`

**Approach:**
1. Uncomment the 5 in-scope rules (NOT i18n, NOT native-select)
2. Run `pnpm lint --no-cache`
3. Expected: PASS with zero warnings
4. If FAILS: capture exact remaining violations, dispatch ONE fix subagent with the list, re-run

**Commit:** `chore(eslint): enable design-system styling rules as error (Plan 1c complete)`

Final `.eslintrc.json` rules block:
```json
"design-system/no-hardcoded-colors": "error",
"design-system/no-hardcoded-spacing": "error",
"design-system/no-inline-styles": "error",
"design-system/no-styled-typography": "error",
"design-system/no-bare-text-in-button": "error",
// Stays disabled (separate concerns):
// "design-system/no-implicit-i18n-namespaces": "error",
// "design-system/no-native-select": "error",
```

---

## Self-Review Checklist

After all 5 tasks:
- [ ] `pnpm lint --no-cache` PASS with 5 styling rules enabled as `error`
- [ ] `pnpm typecheck` PASS
- [ ] `apps/web/src/features/landing/` files UNTOUCHED (verify via git diff)
- [ ] Pre-commit hooks still pass (no `--no-verify` used)
- [ ] No new untracked files that should be committed (check `git status` after each task)
