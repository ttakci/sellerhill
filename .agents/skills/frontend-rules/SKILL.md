---
name: frontend-rules
description: Frontend file-organization and design-system rules for apps/web and packages/ui. Use when writing or modifying any .ts/.tsx file under apps/web/src (except landing) or packages/ui/src/atoms|molecules.
---

# Frontend Rules

## File Organization (mandatory)

Every feature component has 4 files:

| File | Allowed | Forbidden |
|---|---|---|
| `[Name].component.tsx` | JSX markup, `useTranslation`, `useTheme` | `useState/useEffect/useMemo`, RTK Query hooks, `dispatch`, `useSelector`, `useNavigate`, `formatCurrency`-style helpers, `styled(...)` |
| `[Name].container.tsx` | All logic, hooks, RTK Query, handlers, formatters | `styled(...)`, JSX markup (only `<Component .../>` return allowed) |
| `[Name].style.ts` | All `styled(...)` calls | JSX, logic |
| `[Name].types.ts` | `interface`, `type`, `enum` | implementations |

Atoms/Molecules (`packages/ui/src/{atoms,molecules}/`) follow the same rules. **Stateful** atoms/molecules (Select, Dropdown, Tooltip, etc.) MUST split into `.container.tsx` + `.component.tsx` like features. **Stateless** atoms/molecules (Button, Badge, Icon) only need `.component.tsx` + `.style.ts` + `.types.ts`.

### Exempt paths
- `apps/web/src/features/landing/**`
- `apps/web/src/**/api/*.ts(x)` (RTK Query endpoints)
- `apps/web/src/app/store.ts`
- `apps/api/**`
- `*.config.{ts,js,mjs,cjs}`

## Design System (mandatory, enforced by ESLint)

### Tokens
- All colors, spacing, shadows, radii, typography → `tkn('path')` from `@repo/ui`. Never hardcoded hex/rgb, never raw `16px`/`1rem`.
- Inline `style={{ }}` is forbidden.
- Typeface: **Inter** for `heading`, **Lexend** for `body` / `sans`, JetBrains Mono for `mono`. That pairing is fixed — never introduce a third family or hardcode a family name outside `designTokens.ts`. Body reads at **15px** (`fontSize.base`); `fontSize.md` (16px) is a heading step.

### Text
- All visible text uses `<Text variant="...">` from `@repo/ui`. Never `styled.h1`, `styled.p`, etc.
- Variants (hierarchy — keep sizes distinct):
  - `h1` 24px page title · `h2` 20px · `h3` 18px drawer · `h4` 16px card · `h5` 14px
  - `body` 16px primary UI · `body-sm` 14px table cells/secondary · `body-xs` 10px · `caption` 12px · `overline` 10px uppercase
  - `metric` 20px / `metric-sm` 18px — KPI figures (tabular-nums). Never repurpose `h1`/`h2` for a number.
- Any figure in a column (money, counts, %) sets `<Text numeric>` so digits stack instead of jittering.
- Page titles: use `PageHeader` (not ad-hoc title stacks). Title→subtitle gap is built into `PageHeader` / Drawer — do not invent per-page gaps.
- Prefer `weight="semibold"` on headings; avoid bold everywhere.

### Form controls
- Buttons → `Button`, `IconButton`. Never raw `<button>`.
- Text inputs → `TextInput` with **floating `label` prop**. Never `<input>`, never external label above the field.
- Selects → `Select` with floating `label` (forms) or `placeholder` only (compact toolbars). Never `<select>`.
- Checkboxes → `Checkbox`. Toggles → `Toggle`.
- Shared geometry: `controlTokens.height` on the theme is the single source of truth; `packages/ui/src/styles/formControl.ts` derives from it and must never re-declare a literal. TextInput / Select / SearchField / Textarea share heights and the **brand.primary** focus ring via `controlFocusShadow` (never black borders, never a bespoke ring).
- Heights: compact `2.5 / 2.75 / 3rem`, labeled `3.25 / 3.5 / 4rem`. Button `medium` = compact medium; Button `large` = labeled medium (auth submit under a labeled field).
- `colors.border.focus` must always equal `colors.brand.primary`.
- Every interactive atom needs a `:focus-visible` ring. Checkbox/Radio/Toggle mirror it from the hidden input via `input:focus-visible + &` — a plain sibling selector, never an Emotion component selector.
- Toolbar rows (filters): all compact same size so Search + Select + Button align.

### Required-field validation (mandatory)
- A required field is validated on submit attempt, not by silently disabling the submit/Continue button. Disabling gives the user no way to discover *which* field is wrong or why; a rejected click that turns the empty field(s) red does.
- Pattern: track an `xSubmitAttempted` boolean (starts `false`, reset whenever the form/step is (re)opened with fresh data). The submit/Continue handler checks validity first — if invalid, set `xSubmitAttempted = true` and return without proceeding; only advance/save once valid.
- Per-field error flags are `submitAttempted && !field.trim()` (or the field's own emptiness rule), computed in the **container** and passed down as booleans/strings — never a raw `.trim()` call inside a `.component.tsx` ternary.
- Render the error via the field atom's own error prop, not a separate static `InfoMessage` sitting near the form. `ModernTextInput` supports this for **manual** (non-RHF) usage via `errorMessage?: string` — RHF-controlled fields get theirs from `fieldState.error` automatically. A static "N fields are required" info box that's always visible regardless of what the user has typed is not validation and should not be used as a substitute.
- Do not gate the button's `disabled` state on form completeness for this purpose — `isContinueDisabled`/`isSubmitDisabled` should reflect only genuine in-flight state (`isSaving`), not field validity.

### Layout
- Cards → `Card` variants: `default | bordered | elevated | flat | interactive | stat | section`. **Never hand-roll a card** — extend with `styled(Card)` + layout-only CSS.
- Radius tiers: cards/tables/filter bars `lg` (12px) · controls `md` (8px) · badges `sm` (6px) · modals `xl`.
- Card content inset is 20px whether via `padding="lg"` or `<CardBody>`.
- Tabs → `TabNav` (underline) for page sections; `SegmentedControl` for in-card switches. Never `Button variant="primary|secondary"` as a tab or filter group.
- z-index → `theme.zIndex.*`; breakpoints → `theme.breakpoints.*`. Never a literal.
- Money/count table columns: `align: 'right'` + `<Text numeric>`.
- Card grids: set `gridMinItemWidth` (narrowest track the card survives in) and `gridMaxColumns` on `DataTable`. Inside a card, stat strips use `repeat(auto-fit, minmax(...))`, never a fixed `repeat(N, 1fr)`.
- Textareas → `Textarea` (`fill` = absolute-inset, `mono` = code/HTML). Never fork a native `<textarea>`.
- Loading and empty on the same surface must both be `EmptyState` — different components make them look like different screens.
- Nested flows → a real nested `Drawer` with `onBack`, never inline content swapped into the parent card.
- Never hand-roll a Card, Button, Textarea or empty state. Add a variant to the atom instead of forking it.
- Settings sections → `SettingsCard` + `SettingsActionRow` (row label = `body`, subtitle = `caption`/`body-sm`).
- Tables → `Table` / `DataTable`. Never `styled.table`.
- Page header → `PageHeader` molecule.
- Drawers → `Drawer` (title `h3` semibold, subtitle `body-sm`).
- Dropdowns → `Dropdown` atom.

### Mobile responsiveness (mandatory — every new UI must work down to 360px)
- Never a hardcoded `@media` literal or raw `window.innerWidth` check — use `tkn('breakpoints.*')` (`sm/md/lg/xl` + `*Below`); for a rare JS-side threshold, use an exported constant (e.g. `SIDEBAR_MOBILE_BREAKPOINT_PX` from `@repo/ui`), never a second inline magic number.
- Multi-column layouts/grids collapse to one column at `breakpoints.md`/`mdBelow`.
- Card grids use `DataTable`'s `GridContainer` `minmax(min(100%,...),1fr)` pattern, never a fixed `repeat(N, 1fr)`.
- Wide/tabular content that can't reflow gets its own local `overflow-x: auto` container — never left to overflow the page.
- A horizontal image+content card stacks to `flex-direction: column` below `breakpoints.sm`/`smBelow` once fixed-width children can't coexist with reflowing content at that width.
- `Drawer` is full-width below `breakpoints.md`; a multi-button `Modal` footer stacks to full-width buttons below `breakpoints.md`, same visual order as desktop.
- Popover-style menus (`Dropdown`, `Select`) render as a bottom sheet below 640px width — reuse `Select`'s `isMobile`/`createPortal`/`Overlay`+`BottomSheet` pattern for any new one, never a floating popover shrunk to fit.
- Fixed bottom action bars reserve `env(safe-area-inset-bottom)` in their bottom padding.
- Verify at a 375px-wide viewport (devtools device emulation) before calling a UI change done.

### Loading
- `useLoading` takes **mutation flags only**. Never fold a query's initial `isLoading` into it — that blocks the whole app on first paint.
- Initial page data → the page's own `EmptyState` (loading title + description). Loading and empty must use the same component so the two states don't look like different screens.

### Logic extraction
- Feature hooks under `features/<feature>/hooks/` when container would exceed ~150–200 lines.
- `useForm` in container or `useXxxForm` hook — never in `.component.tsx`.

### Notifications
- Toasts: `useToast()` → `toast.success(...)`, `toast.error(...)`.
- Modals (info/error/warn): `MessageModal` via `showMessage` from `UIContext`. Never `alert()`/`confirm()`.

### Extending atoms in `.style.ts`
Use the atom's built-in variant/weight/size props. Template literal should be empty or **layout CSS only** (margin, gap, flex, grid, position, width/height, overflow, z-index).

What goes in template literal:
- `margin`, `gap`, `padding` (when atom doesn't handle it), `display`, `flex-direction`, `align-items`, `justify-content`, `position`, `top/right/bottom/left`, `width`, `height`, `min-height`, `max-width`, `overflow`, `grid-column`, `z-index`, `opacity`, `cursor`.

What goes in props instead:
- `font-size`, `font-weight`, `font-family` → `Text` `variant`/`weight`.
- `color` (text) → `Text` `color`/`muted`, or `Button` `variant`.
- `background`, `border`, `border-radius` → atom `variant`/`size`.
- `box-shadow` → `Card` `variant`.
- inner `padding` → atom `size`.

**Exception:** Layout-only wrappers (`Container`, `Grid`, `Row`, `Column`) may be `styled.div`.
**Exception:** Dynamic state styling (`$active`) that variant props can't express may use minimal CSS.

## Status / constants
All status values, type discriminators, and constant strings come from enums in `packages/shared/src/domain/`. Never raw `'active'`, `'draft'`, etc.

## i18n
- No hardcoded UI strings.
- Files: `packages/shared/src/i18n/resources/{en,tr}/`.
- Primary namespace: dot notation `t('ebay.connect.title')`.
- Cross-namespace `translation`: colon syntax `t('translation:common.loading')`.

## Hover effects
All interactive elements must have visible hover (color change, lift, or shadow), using `transition: all ${tkn('transitions.fast')}`.

## Listings / product chrome (project conventions)
- Prefer **few or no** PageHeader action buttons on list/detail (mobile-first). Prefer overview QuickActions, SettingsCard/SettingsActionRow, drawers, DataTable toolbar, or one mobile Manage action.
- Product images: **transparent** background (no gray plate) on cards, table product column, and listing detail gallery.
- Do not duplicate ASIN / eBay ID / price blocks across multiple sections on the same page.
- After changing `@repo/ui` (Table selection col, Icon map, Checkbox), rebuild: `pnpm --filter @repo/ui build` — web resolves package `dist/`.
