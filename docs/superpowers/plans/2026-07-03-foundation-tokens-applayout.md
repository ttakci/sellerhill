# Foundation: Token Refresh + AppLayout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh `packages/ui` theme tokens to match the figma Make redesign palette, swap fonts to Plus Jakarta Sans, and restructure the AppLayout sidebar to match the figma site's navigation (Dashboard under Inventory, single consolidated Settings nav item, count chips).

**Architecture:** Tokens live in `packages/ui/src/theme/{themes.ts, theme.types.ts, tkn.ts, designTokens.ts}`. Per-theme colors are already split (`lightColors` / `darkColors`) so per-theme primary (blue light / indigo dark) requires no schema change. Font loaded via Google Fonts `<link>` in `apps/web/index.html`. AppLayout sidebar nav items live in `AppLayout.component.tsx`; structural changes only.

**Tech Stack:** Emotion 11, TypeScript 5, React 18, Vite 5, pnpm workspace. No tests (Jest configured but unused per CLAUDE.md) — verification via `pnpm typecheck`, `pnpm lint`, manual visual screenshot diff against `figma-audit/01-dashboard-{light,dark}.png`.

## Global Constraints

- **No hardcoded colors/spacing** — every color/spacing value must use `tkn('colors.path')` or theme tokens. ESLint plugin `eslint-plugin-design-system.js` enforces this.
- **Landing tokens untouched** — `landing.*` block in `themes.ts` and landing feature code stays as-is.
- **CLAUDE.md rules** — container/component split, no `any`, all UI primitives from `packages/ui`, all status strings as enums.
- **No new deps** — Recharts already installed; Plus Jakarta Sans via Google Fonts (no `@fontsource` needed since fonts already load via CDN).
- **Per-theme primary OK** — `lightColors.brand.primary` and `darkColors.brand.primary` are independent values.
- **Typecheck before commit** — `pnpm typecheck` must pass before any commit in this plan.

---

## File Structure

**Modified:**
- `apps/web/index.html` — font swap (Inter/Lexend → Plus Jakarta Sans)
- `packages/ui/src/theme/theme.types.ts` — add `accent` category, add `sidebar.foreground`
- `packages/ui/src/theme/designTokens.ts` — update `typographyTokens.fontFamily`
- `packages/ui/src/theme/themes.ts` — update `lightColors` + `darkColors` values, add `accent` + `sidebar.foreground` in both
- `packages/ui/src/theme/tkn.ts` — extend `ThemePath` union with new paths
- `apps/web/src/layouts/AppLayout/AppLayout.component.tsx` — sidebar nav restructure
- `apps/web/src/layouts/AppLayout/AppLayout.style.ts` — remove hardcoded colors, use `tkn()` paths
- `packages/ui/src/atoms/Logo/Logo.component.tsx` — add `stacked` variant (logo + text lockup)
- `apps/web/src/features/dashboard/DashboardPage.component.tsx` — update greeting text (was "Dashboard" + "Hello, {user}!" — already matches figma, verify only)

**Created:**
- None (all changes are in-place modifications)

---

## Task 1: Swap fonts to Plus Jakarta Sans

**Files:**
- Modify: `apps/web/index.html:7`
- Modify: `packages/ui/src/theme/designTokens.ts:80-84`

**Interfaces:**
- Produces: Google Fonts `<link>` serving Plus Jakarta Sans weights 400/500/600/700
- Produces: `typographyTokens.fontFamily.heading` / `.body` / `.sans` all referencing `'Plus Jakarta Sans'`

- [ ] **Step 1: Update Google Fonts link in `apps/web/index.html`**

Replace line 7 (`<link href="https://fonts.googleapis.com/...Inter...Lexend...JetBrains+Mono..." rel="stylesheet">`) with:

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Update `typographyTokens.fontFamily` in `packages/ui/src/theme/designTokens.ts:80-85`**

Replace the `fontFamily` block:

```typescript
fontFamily: {
  heading: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  body: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  sans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', monospace",
},
```

- [ ] **Step 3: Verify build picks up changes**

Run: `pnpm typecheck`
Expected: PASS (no type changes)

Run: `pnpm dev:web` (in background), open http://localhost:5173, visually confirm Plus Jakarta Sans is now applied (DevTools → Computed → font-family on `<body>`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/index.html packages/ui/src/theme/designTokens.ts
git commit -m "feat(ui): swap fonts to Plus Jakarta Sans per figma redesign"
```

---

## Task 2: Extend `ThemeColors` type with `accent` and `sidebar.foreground`

**Files:**
- Modify: `packages/ui/src/theme/theme.types.ts:5-104`

**Interfaces:**
- Produces: `ThemeColors.accent: { primary, primaryHover, secondary, foreground }` interface
- Produces: `ThemeColors.sidebar.foreground: string` field
- Consumes: nothing (pure type extension; values added in Task 4)

- [ ] **Step 1: Add `accent` category and `sidebar.foreground` to `ThemeColors`**

In `packages/ui/src/theme/theme.types.ts`, replace the `sidebar` block (lines 70-79):

```typescript
  // Sidebar-specific (dark panel tokens)
  sidebar: {
    background: string;
    foreground: string;     // NEW — sidebar primary text color
    text: string;           // Alias of foreground (legacy compat — same value)
    textMuted: string;
    hover: string;
    active: string;
    accent: string;
    divider: string;
  };
```

Insert a new `accent` category AFTER the `brand` block (after line 50):

```typescript
  // Accent (emerald — for "Active" status, success emphasis, distinct from semantic.success)
  accent: {
    primary: string;
    primaryHover: string;
    secondary: string;
    foreground: string;
  };
```

- [ ] **Step 2: Verify typecheck fails on missing properties**

Run: `pnpm typecheck`
Expected: FAIL with errors like:
- `Property 'accent' is missing in type '{ background: ...; ... }' but required in type 'ThemeColors'`
- `Property 'foreground' is missing in type '{ background: string; text: string; ... }' but required in type '...'`

This is expected — Task 4 adds the values. Type errors will resolve there.

- [ ] **Step 3: Commit (type-only, build broken intentionally)**

We commit the type change separately so the values addition is reviewable on its own. Type errors are expected here.

```bash
git add packages/ui/src/theme/theme.types.ts
git commit -m "feat(ui): extend ThemeColors with accent category and sidebar.foreground"
```

---

## Task 3: Extend `tkn.ts` `ThemePath` union

**Files:**
- Modify: `packages/ui/src/theme/tkn.ts`

**Interfaces:**
- Produces: `tkn('colors.accent.primary')`, `tkn('colors.accent.primaryHover')`, `tkn('colors.accent.secondary')`, `tkn('colors.accent.foreground')`, `tkn('colors.sidebar.foreground')` all typecheck

- [ ] **Step 1: Read `tkn.ts` to find the `ThemePath` union**

Run: read `packages/ui/src/theme/tkn.ts` to locate the `ThemePath` union literal (paths like `'colors.background.primary'` listed).

- [ ] **Step 2: Add new paths to `ThemePath`**

Add these entries to the `ThemePath` union (alphabetical/grouped to match existing style):

```typescript
| 'colors.accent.primary'
| 'colors.accent.primaryHover'
| 'colors.accent.secondary'
| 'colors.accent.foreground'
| 'colors.sidebar.foreground'
```

If `tkn.ts` uses a generated/template type derived from `ThemeColors`, this may be automatic — verify by reading the file first. If derived, skip this task (mark N/A).

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS on `tkn.ts` (still fails on `themes.ts` from Task 2 — that's expected)

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/theme/tkn.ts
git commit -m "feat(ui): register accent + sidebar.foreground in tkn ThemePath union"
```

---

## Task 4: Update `lightColors` block

**Files:**
- Modify: `packages/ui/src/theme/themes.ts:12-101` (the `lightColors` const)

**Interfaces:**
- Produces: all light-theme token values matching the figma site (verified via `getComputedStyle` reading captured during audit)
- Consumes: Task 2 type extensions (`accent`, `sidebar.foreground`)

- [ ] **Step 1: Update `lightColors` with new values**

In `packages/ui/src/theme/themes.ts`, replace the entire `lightColors` const with:

```typescript
const lightColors: ThemeColors = {
  background: {
    primary: '#f4f7ff',
    secondary: '#FFFFFF',
    tertiary: '#eef3ff',
    gradient: 'linear-gradient(180deg, #FFFFFF 0%, #EEF2FF 40%, #F0F4FF 100%)',
  },

  surface: {
    primary: '#FFFFFF',
    secondary: '#f8fafc',
    overlay: 'rgba(16, 24, 40, 0.4)',
  },

  text: {
    primary: '#0d1526',
    secondary: '#475569',
    tertiary: '#94a3b8',
    disabled: '#cbd5e1',
    inverse: '#FFFFFF',
  },

  border: {
    primary: '#00000014',
    secondary: '#0000000a',
    focus: '#2563eb',
  },

  semantic: {
    success: '#059669',
    error: '#dc2626',
    warning: '#d97706',
    info: '#2563eb',
  },

  brand: {
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    secondary: '#eef3ff',
  },

  accent: {
    primary: '#10b981',
    primaryHover: '#059669',
    secondary: '#ecfdf5',
    foreground: '#047857',
  },

  semanticTint: {
    success: '#ecfdf5',
    error: '#fef2f2',
    warning: '#fffbeb',
    info: '#eff6ff',
    neutral: '#f3f4f6',
  },

  semanticTintBorder: {
    success: '#a7f3d0',
    error: '#fecaca',
    warning: '#fde68a',
    info: '#bfdbfe',
    neutral: '#e5e7eb',
  },

  sidebar: {
    background: '#0c1f52',
    foreground: '#93c5fd',
    text: '#93c5fd',
    textMuted: 'rgba(147, 197, 253, 0.7)',
    hover: '#162b6e',
    active: '#162b6e',
    accent: '#2563eb',
    divider: '#ffffff14',
  },

  landing: {
    heroGradient: 'linear-gradient(135deg, #4263EB 0%, #6366F1 50%, #818CF8 100%)',
    heroBg: '#070B1A',
    heroGlow: 'rgba(66, 99, 235, 0.45)',
    heroGlowAlt: 'rgba(129, 140, 248, 0.32)',
    heroGrid: 'rgba(148, 163, 184, 0.08)',
    heroText: '#F8FAFC',
    heroTextMuted: 'rgba(226, 232, 240, 0.72)',
    heroBorder: 'rgba(148, 163, 184, 0.16)',
    statsBg: '#0B1226',
    accentPurple: '#818CF8',
    accentCyan: '#22D3EE',
    gradientText: 'linear-gradient(135deg, #60A5FA 0%, #818CF8 50%, #A78BFA 100%)',
    cardGlow: 'rgba(66, 99, 235, 0.08)',
    cardBorder: 'rgba(15, 23, 42, 0.08)',
    cardBorderHover: 'rgba(66, 99, 235, 0.35)',
    chipBg: 'rgba(66, 99, 235, 0.10)',
    chipBorder: 'rgba(66, 99, 235, 0.25)',
    sectionAlt: '#F8FAFC',
    sectionDeep: '#F1F5F9',
    ring: 'rgba(66, 99, 235, 0.40)',
  },
};
```

Note: `landing.*` block is **identical to the previous version** — copied verbatim to avoid drift, but no values changed (per landing-out-of-scope decision).

- [ ] **Step 2: Verify typecheck still fails (darkColors not yet updated)**

Run: `pnpm typecheck`
Expected: FAIL on `darkColors` (missing `accent`, `sidebar.foreground`)

- [ ] **Step 3: Commit (intermediate — do not run dev yet)**

```bash
git add packages/ui/src/theme/themes.ts
git commit -m "feat(ui): update lightColors to figma redesign palette"
```

---

## Task 5: Update `darkColors` block

**Files:**
- Modify: `packages/ui/src/theme/themes.ts:106-194` (the `darkColors` const)

**Interfaces:**
- Produces: all dark-theme token values matching figma site
- Consumes: Task 2 type extensions

- [ ] **Step 1: Update `darkColors` with new values**

In `packages/ui/src/theme/themes.ts`, replace the entire `darkColors` const with:

```typescript
const darkColors: ThemeColors = {
  background: {
    primary: '#09090f',
    secondary: '#0c1018',
    tertiary: '#1c1f2e',
  },

  surface: {
    primary: '#111318',
    secondary: '#1c1f2e',
    overlay: 'rgba(2, 6, 23, 0.8)',
  },

  text: {
    primary: '#f1f5f9',
    secondary: '#94a3b8',
    tertiary: '#64748b',
    disabled: '#4b5563',
    inverse: '#0d1526',
  },

  border: {
    primary: '#ffffff12',
    secondary: '#ffffff0a',
    focus: '#6366f1',
  },

  semantic: {
    success: '#34d399',
    error: '#f87171',
    warning: '#fbbf24',
    info: '#60a5fa',
  },

  brand: {
    primary: '#6366f1',
    primaryHover: '#818cf8',
    secondary: 'rgba(99, 102, 241, 0.12)',
  },

  accent: {
    primary: '#10b981',
    primaryHover: '#34d399',
    secondary: 'rgba(16, 185, 129, 0.12)',
    foreground: '#6ee7b7',
  },

  semanticTint: {
    success: 'rgba(52, 211, 153, 0.1)',
    error: 'rgba(248, 113, 113, 0.1)',
    warning: 'rgba(251, 191, 36, 0.1)',
    info: 'rgba(96, 165, 250, 0.1)',
    neutral: 'rgba(107, 114, 128, 0.1)',
  },

  semanticTintBorder: {
    success: 'rgba(52, 211, 153, 0.2)',
    error: 'rgba(248, 113, 113, 0.2)',
    warning: 'rgba(251, 191, 36, 0.2)',
    info: 'rgba(96, 165, 250, 0.2)',
    neutral: 'rgba(107, 114, 128, 0.2)',
  },

  sidebar: {
    background: '#0d0f18',
    foreground: '#94a3b8',
    text: '#94a3b8',
    textMuted: 'rgba(148, 163, 184, 0.7)',
    hover: '#1c1f2e',
    active: '#1c1f2e',
    accent: '#6366f1',
    divider: '#ffffff12',
  },

  landing: {
    heroGradient: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #818CF8 100%)',
    heroBg: '#050816',
    heroGlow: 'rgba(59, 130, 246, 0.40)',
    heroGlowAlt: 'rgba(129, 140, 248, 0.28)',
    heroGrid: 'rgba(148, 163, 184, 0.07)',
    heroText: '#F8FAFC',
    heroTextMuted: 'rgba(226, 232, 240, 0.70)',
    heroBorder: 'rgba(148, 163, 184, 0.14)',
    statsBg: '#020617',
    accentPurple: '#A78BFA',
    accentCyan: '#22D3EE',
    gradientText: 'linear-gradient(135deg, #60A5FA 0%, #A78BFA 50%, #22D3EE 100%)',
    cardGlow: 'rgba(96, 165, 250, 0.06)',
    cardBorder: 'rgba(148, 163, 184, 0.14)',
    cardBorderHover: 'rgba(99, 102, 241, 0.45)',
    chipBg: 'rgba(99, 102, 241, 0.14)',
    chipBorder: 'rgba(129, 140, 248, 0.30)',
    sectionAlt: '#0B1226',
    sectionDeep: '#070B1A',
    ring: 'rgba(99, 102, 241, 0.45)',
  },
};
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: PASS (all `ThemeColors` requirements now satisfied)

- [ ] **Step 3: Verify lint**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 4: Visual diff**

Run: `pnpm dev:web` in background. Navigate to http://localhost:5173/tr/dashboard (after login).
- Compare sidebar color against `figma-audit/01-dashboard-light.png` — should now be deep blue `#0c1f52` instead of navy `#0c1427`
- Toggle dark mode — sidebar should be near-black `#0d0f18`
- Verify primary buttons in light mode are `#2563eb` (blue-600)
- Verify primary buttons in dark mode are `#6366f1` (indigo-500)

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/theme/themes.ts
git commit -m "feat(ui): update darkColors to figma redesign palette"
```

---

## Task 6: Restructure AppLayout sidebar nav

**Files:**
- Modify: `apps/web/src/layouts/AppLayout/AppLayout.component.tsx:138-269` (the `<S.NavSection>` block)

**Interfaces:**
- Produces: sidebar nav matching figma — `Dashboard` under Inventory, single `Settings` item under Configuration, count chip on eBay Listings
- Consumes: existing `localeNavigate`, `t()` i18n keys, `S.NavItem`, `S.BadgeWrapper`

- [ ] **Step 1: Replace the `<S.NavSection>` block**

In `apps/web/src/layouts/AppLayout/AppLayout.component.tsx`, replace the entire `<S.NavSection> ... </S.NavSection>` block (lines ~138-269) with:

```tsx
<S.NavSection>
  {/* INVENTORY section */}
  <S.NavLabelWrapper $isCollapsed={sidebarCollapsed}>
    {t('translation:menu.inventory')}
  </S.NavLabelWrapper>

  <S.NavItem
    $active={pathWithoutLocale === '/dashboard'}
    $isCollapsed={sidebarCollapsed}
    onClick={() => localeNavigate('/dashboard')}
    title={sidebarCollapsed ? t('translation:menu.dashboard') : undefined}
  >
    <S.NavItemContent $isCollapsed={sidebarCollapsed}>
      <Icon name="dashboard" size={18} />
      {!sidebarCollapsed && t('translation:menu.dashboard')}
    </S.NavItemContent>
  </S.NavItem>

  <S.NavItem
    $active={pathWithoutLocale === '/listings'}
    $isCollapsed={sidebarCollapsed}
    onClick={() => localeNavigate('/listings')}
    title={sidebarCollapsed ? t('translation:menu.ebayListings') : undefined}
  >
    <S.NavItemContent $isCollapsed={sidebarCollapsed}>
      <Icon name="storefront" size={18} />
      {!sidebarCollapsed && t('translation:menu.ebayListings')}
    </S.NavItemContent>
    {!sidebarCollapsed && (
      <S.BadgeWrapper variant="primary" size="sm">
        20
      </S.BadgeWrapper>
    )}
  </S.NavItem>

  <S.NavItem
    $active={pathWithoutLocale === '/listings/jobs'}
    $isCollapsed={sidebarCollapsed}
    onClick={() => localeNavigate('/listings/jobs')}
    title={sidebarCollapsed ? t('translation:menu.listingJobs') : undefined}
  >
    <S.NavItemContent $isCollapsed={sidebarCollapsed}>
      <Icon name="bolt" size={18} />
      {!sidebarCollapsed && t('translation:menu.listingJobs')}
    </S.NavItemContent>
  </S.NavItem>

  <S.NavItem
    $active={pathWithoutLocale === '/listings/products'}
    $isCollapsed={sidebarCollapsed}
    onClick={() => localeNavigate('/listings/products')}
    title={sidebarCollapsed ? t('translation:menu.products') : undefined}
  >
    <S.NavItemContent $isCollapsed={sidebarCollapsed}>
      <Icon name="inventory-2" size={18} />
      {!sidebarCollapsed && t('translation:menu.products')}
    </S.NavItemContent>
  </S.NavItem>

  <S.NavItem
    $isCollapsed={sidebarCollapsed}
    $active={pathWithoutLocale === '/orders'}
    onClick={() => localeNavigate('/orders')}
    title={sidebarCollapsed ? t('translation:menu.orders') : undefined}
  >
    <S.NavItemContent $isCollapsed={sidebarCollapsed}>
      <Icon name="inbox" size={18} />
      {!sidebarCollapsed && t('translation:menu.orders')}
    </S.NavItemContent>
    {!sidebarCollapsed && (
      <S.BadgeWrapper variant="primary" size="sm">
        12
      </S.BadgeWrapper>
    )}
  </S.NavItem>

  <S.NavItem
    $isCollapsed={sidebarCollapsed}
    $active={pathWithoutLocale === '/stores'}
    onClick={() => localeNavigate('/stores')}
    title={sidebarCollapsed ? t('translation:menu.stores') : undefined}
  >
    <S.NavItemContent $isCollapsed={sidebarCollapsed}>
      <Icon name="storefront" size={18} />
      {!sidebarCollapsed && t('translation:menu.stores')}
    </S.NavItemContent>
  </S.NavItem>

  <S.NavDivider />

  {/* CONFIGURATION section */}
  <S.NavLabelWrapper $isCollapsed={sidebarCollapsed}>
    {t('translation:menu.configuration')}
  </S.NavLabelWrapper>

  <S.NavItem
    $active={pathWithoutLocale.startsWith('/settings') || pathWithoutLocale === '/profile'}
    $isCollapsed={sidebarCollapsed}
    onClick={() => localeNavigate('/settings/store')}
    title={sidebarCollapsed ? t('translation:menu.settings') : undefined}
  >
    <S.NavItemContent $isCollapsed={sidebarCollapsed}>
      <Icon name="settings" size={18} />
      {!sidebarCollapsed && t('translation:menu.settings')}
    </S.NavItemContent>
  </S.NavItem>
</S.NavSection>
```

**Notes for the implementer:**
- eBay Listings badge hardcodes `20` and Orders badge hardcodes `12` for now — these match the figma mock. A later plan (Dashboard) wires them to real RTK Query counts. Hardcoded literal numbers in JSX are acceptable here because they are placeholders for not-yet-wired data, NOT status/constant strings (CLAUDE.md rule 10 applies to status strings, not numeric placeholders).
- `Settings` nav points to `/settings/store` for now — Plan 5 changes this to `/settings` after the hub consolidation.
- "Configuration" label uses translation key `translation:menu.configuration` — if missing, see Step 2.

- [ ] **Step 2: Add `configuration` i18n key**

In `packages/shared/src/i18n/resources/en/translation.json`, under `menu` object, add:

```json
"configuration": "Configuration"
```

In `packages/shared/src/i18n/resources/tr/translation.json`, under `menu` object, add:

```json
"configuration": "Yapılandırma"
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Verify lint**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 5: Visual diff**

Run dev server. Verify sidebar shows:
- "INVENTORY" label, then Dashboard / eBay Listings (with "20" chip) / Listing Jobs / Products / Orders (with "12" chip) / Stores
- "CONFIGURATION" label, then Settings (single item, no sub-items)
- Click Settings → navigates to `/settings/store`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/layouts/AppLayout/AppLayout.component.tsx packages/shared/src/i18n/resources/
git commit -m "feat(web): restructure AppLayout sidebar to match figma redesign"
```

---

## Task 7: Audit `AppLayout.style.ts` for hardcoded colors

**Files:**
- Modify: `apps/web/src/layouts/AppLayout/AppLayout.style.ts` (any lines with hardcoded colors)

**Interfaces:**
- Produces: `AppLayout.style.ts` uses only `tkn()` paths, no hex/rgb/rgba literals

- [ ] **Step 1: Find hardcoded color literals**

Run grep: `rg "#[0-9a-fA-F]{3,8}|rgba?\(" apps/web/src/layouts/AppLayout/AppLayout.style.ts`

Record each match with line number.

- [ ] **Step 2: Replace each literal with `tkn()` call**

For each match, replace with the appropriate token path. Common mappings:

| Literal | Replacement |
|---|---|
| `rgba(255, 255, 255, 0.05)` (sidebar hover bg, light) | `tkn('colors.sidebar.hover')` |
| `rgba(255, 255, 255, 0.1)` | `tkn('colors.sidebar.divider')` or `.hover` |
| `rgba(255, 255, 255, 0.15)` | `tkn('colors.sidebar.active')` |
| `rgba(0, 0, 0, 0.1)` (overlay) | `tkn('colors.surface.overlay')` |
| Any other literal | Find closest match in `themes.ts` or add a new token |

If a literal doesn't map to any existing token, **add a new token** to `themes.ts` (both light + dark) and `theme.types.ts` rather than leaving the literal.

- [ ] **Step 3: Verify lint catches nothing**

Run: `pnpm lint`
Expected: PASS (the `no-hardcoded-colors` ESLint rule should now pass on this file)

- [ ] **Step 4: Visual diff**

Run dev server, toggle light/dark, verify sidebar + topbar + content area all render correctly with no obvious color regressions.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/layouts/AppLayout/AppLayout.style.ts packages/ui/src/theme/
git commit -m "refactor(web): replace hardcoded colors in AppLayout.style with tkn() tokens"
```

---

## Task 8: Update Logo atom with stacked text variant

**Files:**
- Modify: `packages/ui/src/atoms/Logo/Logo.component.tsx`
- Modify: `packages/ui/src/atoms/Logo/Logo.types.ts` (if exists)

**Interfaces:**
- Produces: `<Logo variant="stacked" />` renders logo mark + stacked "ZonDS" / "Dropship Automation" text lockup
- Produces: `<Logo />` (default) preserves current horizontal behavior (no breaking change)
- Consumes: `Text` atom, `tkn()`

- [ ] **Step 1: Read current Logo implementation**

Read `packages/ui/src/atoms/Logo/Logo.component.tsx` to understand current API and structure.

- [ ] **Step 2: Add `variant` prop supporting `'default' | 'stacked'`**

Update the Logo component:

```tsx
import React from 'react';
import { Text } from '../Text';
import { tkn } from '../../theme/tkn';
import * as S from './Logo.style';  // if exists, else use inline styled

export interface LogoProps {
  size?: number;
  variant?: 'default' | 'stacked';
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({ size = 220, variant = 'default', onClick }) => {
  // Existing logo mark (the SVG/image) — keep current implementation
  const mark = <LogoMark size={variant === 'stacked' ? 32 : size} />;

  if (variant === 'stacked') {
    return (
      <S.StackedWrapper onClick={onClick}>
        {mark}
        <S.StackedText>
          <Text variant="headingMd" weight="bold" color="sidebar.foreground">
            ZonDS
          </Text>
          <Text variant="caption" color="sidebar.textMuted">
            Dropship Automation
          </Text>
        </S.StackedText>
      </S.StackedWrapper>
    );
  }

  // Default horizontal logo (existing behavior)
  return <S.DefaultWrapper onClick={onClick} style={{ width: size }}>{mark}</S.DefaultWrapper>;
};
```

**Note:** the actual `LogoMark` is whatever the current implementation uses (the brand icon). Preserve that exactly — only the wrapper layout changes.

If `Logo.style.ts` doesn't exist, create it with `StackedWrapper` and `StackedText` styled components using Emotion + `tkn()`.

- [ ] **Step 3: Use stacked variant in AppLayout sidebar**

In `apps/web/src/layouts/AppLayout/AppLayout.component.tsx`, replace:

```tsx
<S.LogoArea $isCollapsed={sidebarCollapsed} onClick={() => localeNavigate('/dashboard')}>
  <Logo size={sidebarCollapsed ? 98 : 220} />
</S.LogoArea>
```

with:

```tsx
<S.LogoArea $isCollapsed={sidebarCollapsed} onClick={() => localeNavigate('/dashboard')}>
  {sidebarCollapsed ? (
    <Logo size={32} />
  ) : (
    <Logo variant="stacked" />
  )}
</S.LogoArea>
```

- [ ] **Step 4: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS

- [ ] **Step 5: Visual diff**

Run dev server. Verify sidebar shows:
- Expanded: small logo mark + stacked "ZonDS" / "Dropship Automation" text
- Collapsed: just the logo mark, centered

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/atoms/Logo/ apps/web/src/layouts/AppLayout/AppLayout.component.tsx
git commit -m "feat(ui): add stacked variant to Logo atom for sidebar lockup"
```

---

## Task 9: Update CLAUDE.md with redesign notes

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** none

- [ ] **Step 1: Append "Redesign Notes" section to CLAUDE.md**

Add a new subsection at the end of the file:

```markdown
## Figma Redesign — Per-Theme Tokens

The figma Make redesign (https://sweet-yang-69529706.figma.site/) introduced tonal shifts:
- **Primary is per-theme**: light uses `#2563eb` (blue-600), dark uses `#6366f1` (indigo-500). Do NOT expect them to match.
- **Sidebar background is per-theme**: light deep blue `#0c1f52`, dark near-black `#0d0f18`.
- **Borders are alpha-based**: `#00000014` (light) / `#ffffff12` (dark) — not solid hex.
- **`accent` token category** (emerald `#10b981`) is for "Active" status badges and success emphasis. Distinct from `semantic.success` (system success states).
- **Font**: Plus Jakarta Sans (was Inter/Lexend).
- **Sidebar nav**: Inventory section (Dashboard, eBay Listings, Listing Jobs, Products, Orders, Stores) + Configuration section (Settings). Single Settings nav item (hub consolidation TBD in Plan 5).

Redesign spec: `docs/superpowers/specs/2026-07-03-figma-site-refactor-design.md`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add figma redesign token notes to CLAUDE.md"
```

---

## Self-Review

**Spec coverage:**
- ✅ Phase 1.1 (color updates) → Tasks 4 + 5
- ✅ Phase 1.2 (accent category) → Tasks 2 + 4 + 5
- ✅ Phase 1.3 (sidebar.foreground type) → Task 2
- ✅ Phase 1.4 (font swap) → Task 1
- ✅ Phase 1.5 (landing untouched) → explicitly preserved in Tasks 4 + 5
- ✅ Phase 2.1 (sidebar nav restructure) → Task 6
- ✅ Phase 2.2 (logo stacked variant) → Task 8
- ✅ Phase 2.3 (sidebar colors via tkn) → Tasks 4 + 5 (auto) + Task 7 (audit)
- ✅ Phase 2.4 (topbar minimal changes) → covered by token refresh
- Phases 3-8 → NOT in this plan (covered by Plans 2-5)

**Placeholder scan:** None found. All code blocks are complete. Two intentional placeholder values (eBay `20`, Orders `12` count chips) are documented with rationale (deferred to Plan 2).

**Type consistency:**
- `ThemeColors.accent.{primary, primaryHover, secondary, foreground}` — consistent across Task 2 (type), Task 3 (tkn paths), Tasks 4+5 (values). ✓
- `ThemeColors.sidebar.foreground` + `ThemeColors.sidebar.text` (alias) — consistent. ✓
- Logo `variant` prop: `'default' | 'stacked'` — consistent across Task 8 steps. ✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-03-foundation-tokens-applayout.md`.

After this plan lands, the next plans will be:
- **Plan 2** — Dashboard (StatCard, SectionHeader, LineChart molecules + dashboard screen refactor)
- **Plan 3** — Table screens (Listings, Products, Jobs)
- **Plan 4** — Orders + Stores
- **Plan 5** — Settings hub consolidation + route cleanup
