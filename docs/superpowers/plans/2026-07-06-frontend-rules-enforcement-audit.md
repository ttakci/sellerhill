# Frontend Rules Audit — Baseline (2026-07-06)

Counts below drive Phase 3 task scope (Tasks 7–16).

## Summary

| Feature / Package | styled-outside-style | type-outside-types | logic-in-component | styled-in-container | Total |
|---|---:|---:|---:|---:|---:|
| apps/web/src/features/amazon/accounts | 0 | 0 | 4 | 0 | 4 |
| apps/web/src/features/amazon/components | 1 | 0 | 0 | 0 | 1 |
| apps/web/src/features/dashboard/DashboardPage | 0 | 0 | 6 | 0 | 6 |
| apps/web/src/features/listings | 0 | 0 | 1 | 0 | 1 |
| apps/web/src/features/settings/drawers | 1 | 0 | 0 | 0 | 1 |
| apps/web/src/layouts/AppLayout | 0 | 0 | 8 | 0 | 8 |
| packages/ui/src/atoms/Dropdown | 0 | 0 | 3 | 0 | 3 |
| packages/ui/src/atoms/MeshBackground | 0 | 0 | 1 | 0 | 1 |
| packages/ui/src/atoms/Modal | 0 | 0 | 1 | 0 | 1 |
| packages/ui/src/atoms/Tabs | 0 | 0 | 1 | 0 | 1 |
| packages/ui/src/atoms/Typewriter | 0 | 0 | 4 | 0 | 4 |
| packages/ui/src/molecules/Collapsible | 0 | 0 | 4 | 0 | 4 |
| packages/ui/src/molecules/Drawer | 0 | 0 | 2 | 0 | 2 |
| packages/ui/src/molecules/IdBadge | 0 | 0 | 1 | 0 | 1 |
| packages/ui/src/molecules/Popover | 0 | 0 | 5 | 0 | 5 |
| packages/ui/src/molecules/SearchField | 0 | 0 | 1 | 0 | 1 |
| packages/ui/src/molecules/Select | 0 | 0 | 9 | 0 | 9 |
| packages/ui/src/molecules/Table | 0 | 0 | 6 | 0 | 6 |
| packages/ui/src/molecules/TextInput | 0 | 0 | 3 | 0 | 3 |
| packages/ui/src/molecules/Toast | 0 | 0 | 2 | 0 | 2 |
| packages/ui/src/molecules/Tooltip | 0 | 0 | 9 | 0 | 9 |
| **GRAND TOTAL** | **2** | **0** | **71** | **0** | **73** |

## Rule-by-Rule Breakdown

- **styled-only-in-style-files** (2 violations): `LinkAmazonModal.tsx` (inline styled in a component file), `ChangePasswordDrawer.tsx` (same pattern).
- **types-only-in-types-files** (0 violations): Clean — all type declarations are already in `*.types.ts` files.
- **logic-only-in-container** (71 violations): The dominant violation. Most features and nearly all `packages/ui` atoms/molecules use `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef` directly in `.component.tsx` files. This is expected for interactive UI components (Dropdown, Select, Tooltip, Table, etc.) that manage purely visual/UI state — those need exemption or the rule needs refinement to distinguish visual state from business logic.
- **no-styled-in-container** (0 violations): Clean — no styled() calls in container files.

## Notes

1. **`logic-only-in-container` dominates (71/73 = 97%)**: The rule flags ALL React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, plus RTK Query hooks). Many `packages/ui` atoms/molecules legitimately need UI-local state (open/close, hover, ref management). Phase 3 refactor tasks for `packages/ui` (Task 16) will need to either:
   - Exempt `packages/ui` from this rule (UI components are self-contained, no container split), or
   - Rename `.component.tsx` to just `.tsx` in packages/ui (the rule only targets `*.component.tsx` files).

2. **`apps/web/src/layouts/AppLayout` (8 violations)**: Not under `features/` but has significant logic in its component file. Should be included in a refactor pass.

3. **Features with 0 violations**: `store-settings`, `orders`, `ebay`, `auth`, `profile`, `listing-settings-groups` — these features either have no `.component.tsx` files with logic hooks or already follow the container/component split correctly. Phase 3 tasks for these features (Tasks 9, 10, 12, 13, 14, 15) may have minimal work.

4. **Audit tooling note**: The `eslint-plugin-design-system` is installed via `file:` link in `package.json`. The `node_modules/eslint-plugin-design-system/index.js` copy was stale (pre-Task 1). For this audit, it was manually synced. Future `pnpm install` may refresh it automatically, but if rules go missing again, run: `cp packages/ui/src/eslint-plugin/index.js node_modules/eslint-plugin-design-system/index.js`.

5. **Windows path handling**: The Python aggregation script required backslash-to-forwardslash normalization for ESLint's Windows output. The script is saved at `.superpowers/sdd/aggregate.py` for reuse in Phase 3 per-feature audits.

## Methodology

```bash
npx eslint \
  --rule '{"design-system/styled-only-in-style-files":"error","design-system/types-only-in-types-files":"error","design-system/logic-only-in-container":"error","design-system/no-styled-in-container":"error"}' \
  --ext .ts,.tsx \
  apps/web/src packages/ui/src/atoms packages/ui/src/molecules
```

Raw output: `.superpowers/sdd/audit-output.txt` (73 lines of violations across 21 files).
Aggregation script: `.superpowers/sdd/aggregate.py`.
