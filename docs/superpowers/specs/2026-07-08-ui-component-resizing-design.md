# UI Component Resizing & Refinement — Design

**Date:** 2026-07-08
**Status:** Approved (brainstorming complete)
**Reference:** Anadolu Sigorta Bireysel Şube (https://m.anadolusigorta.com.tr/)

## Goal

Update Button, Drawer, Sidebar, Form Inputs, and Modal/Popup components to match the visual language of the Anadolu Sigorta reference site: smaller overlays (no backdrop blur), narrower side navigation, taller form controls, icon-free buttons, and stacked-button popups.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Token strategy | **Per-component inline** values (no new token category) |
| Button icons | **Remove `iconLeft` / `iconRight` props entirely** |
| Button hover | **Background color shift only** (no scale, no translateY) |
| Backdrop | **Best practice:** `rgba(0,0,0,0.5)` light / `rgba(0,0,0,0.7)` dark, **NO blur** |
| Popup buttons | **Stacked vertically** (alt alta), full-width |

## Cross-cutting Concerns

Every change in this spec MUST satisfy:

1. **Full responsive** — every component adapts from mobile (320px) to desktop (1920px+). Specific breakpoints defined per component.
2. **Both themes** — light AND dark mode values are first-class, not an afterthought. Hover effects, backdrop opacity, and borders are tested in both.
3. **Bilingual (TR/EN)** — no UI copy changes in this spec, but layout must handle both Turkish (longer words, e.g. "Vazgeç") and English (shorter, e.g. "Cancel") without truncation or overflow.
4. **Container/Component split** — all stateful atom/molecule changes respect the `.container.tsx` + `.component.tsx` + `.style.ts` + `.types.ts` split. No logic in `.component.tsx`.
5. **No hardcoded values** — heights, widths, and spacings in `.style.ts` files use either `tkn('spacing.*')` or a literal rem value inline. No px literals.

---

## Section 1: Button Atom

**Files:** `packages/ui/src/atoms/Button/{Button.types.ts, Button.component.tsx, Button.style.ts}`

### New Heights & Spacing

| Size | Height | Font-size | Padding X | Font-weight |
|---|---|---|---|---|
| xsmall | `2rem` (32px) | `0.8125rem` | `0.75rem` | 500 |
| small | `2.75rem` (44px) | `0.875rem` | `1rem` | 500 |
| medium | `3.25rem` (52px) | `0.9375rem` | `1.25rem` | 500 |
| large | `3.75rem` (60px) | `1rem` | `1.5rem` | 500 |

(All values inline in `Button.style.ts`. `xsmall` height unchanged.)

### Changes

1. **Remove icon props entirely:**
   - `Button.types.ts`: delete `iconLeft`, `iconRight` from `ButtonProps`
   - `Button.component.tsx`: delete icon rendering logic
   - `Button.style.ts`: delete icon sizing CSS rules
2. **Hover behavior — bg shift via filter:**
   - Remove all `transform: translateY(...)`
   - On `:hover`, apply `filter: brightness(0.92)` in light mode / `brightness(1.08)` in dark mode
   - **Theme detection:** read current mode from existing `ThemeContext` (or `theme.mode` token if it exists; verify during implementation). Pass the brightness value via Emotion's `${({theme}) => ...}` callback in `Button.style.ts`. If no `mode`/`isDark` flag exists on the theme object, add a `mode: 'light' | 'dark'` field to `theme.types.ts` and set it in `themes.ts` — this is a small, scoped addition to the existing theme system, not a new dimension token category.
   - Works on all variants automatically (no new color tokens)
   - Note: `brightness()` affects descendants too (text darkens slightly on hover) — this is acceptable, it's a subtle ~8% shift, not enough to break contrast.
3. **Font weight:** `600` → `500` (Plus Jakarta Sans medium)
4. **No black text in any variant.** Each variant's colors:
   - `primary`: bg `brand.primary`, `text.inverse` (white) — unchanged
   - `secondary`: bg `background.secondary`, **color `brand.primary`** (was `text.primary`), border `border.primary`
   - `tertiary`: transparent bg, color `brand.primary` — unchanged
   - `text`: transparent bg, color `text.secondary` — unchanged
   - `danger`: **unchanged visual structure** — bg `background.secondary`, color `semantic.error` (red, not black), border `semantic.error`. Only the hover and font-weight rules change; the existing ghost/outline-red pattern is preserved.
5. **Border-radius:** `0.5rem` (8px) — kept

### Usage Cleanup

Grep all feature code for `iconLeft=` and `iconRight=` on `<Button>`. Remove the icon prop and the icon element from each usage site. Keep the text children. **Files affected will be enumerated during plan writing.**

---

## Section 2: Drawer Molecule

**Files:** `packages/ui/src/molecules/Drawer/Drawer.style.ts`

### New Widths

| Size | Width |
|---|---|
| sm | `20rem` (320px) |
| md | `26.25rem` (420px) |
| lg | `35rem` (560px) |

### Changes

1. **Widths reduced ~20%** from 400/600/800 → 320/420/560.
2. **Backdrop blur removed:**
   - Remove `backdrop-filter: blur(0.25rem)`
   - Light: `background-color: rgba(0, 0, 0, 0.5)`
   - Dark: `background-color: rgba(0, 0, 0, 0.7)`
3. **Inner padding reduced:** Header/Body/Footer `padding: spacing.lg` (1.5rem) → `spacing.md` (1rem)
4. **Animation kept:** `slideIn` right→left, 0.3s `cubic-bezier(0.16, 1, 0.3, 1)`.
5. **Mobile responsive:** below `40rem` (640px), drawer width becomes `100vw`. Add `@media (max-width: 40rem)` rule.
6. **NOT a bottom sheet** — drawer always slides from the right.

---

## Section 3: Sidebar / AppLayout

**Files:** `apps/web/src/layouts/AppLayout/AppLayout.style.ts` (+ container for mobile state)

### New Widths

| State | Width |
|---|---|
| Expanded | `15rem` (240px) |
| Collapsed | `4rem` (64px) |

### Changes

1. **Expanded 288→240px** (17% narrower). Content area gains ~48px.
2. **Collapsed 80→64px.** Icon (18px) centers with 23px padding each side.
3. **Background colors kept** (Figma redesign palette):
   - Light: `#0c1f52` (deep blue)
   - Dark: `#0d0f18` (near-black)
4. **Hover:** bg `background.secondary`, **no scale/transform**.
5. **Active item indicator:** 3px left accent stripe (current pattern preserved).
6. **Section labels** ("Inventory", "Configuration") preserved.

### Mobile Check (during implementation)

- Verify behavior below `48rem` (768px): sidebar should hide, hamburger triggers overlay sidebar.
- If overlay pattern doesn't exist, add it as part of this work (overlay sidebar uses the same backdrop as modal — `rgba(0,0,0,0.5)` light / `rgba(0,0,0,0.7)` dark, no blur).
- Overlay sidebar slides in from left, full height, width `15rem` (240px).

---

## Section 4: Form Input Atoms

**Files:**
- `packages/ui/src/molecules/TextInput/TextInput.style.ts`
- `packages/ui/src/molecules/Select/{Select.style.ts, Select.container.tsx, Select.component.tsx}`
- `packages/ui/src/atoms/Textarea/Textarea.style.ts`

### New Heights (TextInput = Select, uniform)

| Size | Height |
|---|---|
| small | `3.25rem` (52px) |
| medium | `3.75rem` (60px) |
| large | `4.25rem` (68px) |

### Textarea

| Size | Min-height |
|---|---|
| small | `7.5rem` (120px) |
| medium | `8.75rem` (140px) |
| large | `10rem` (160px) |

### Changes

1. **TextInput/Select heights equalized.** Select was 44/48/56, now matches TextInput at 52/60/68.
2. **Font sizes:** small `0.875rem`, medium `1rem`, large `1.0625rem`.
3. **Padding:** `0.875rem 1.125rem` for inputs (both TextInput and Select trigger).
4. **Border-radius:** `0.5rem` (8px) — matches Button.
5. **Textarea padding:** `0.875rem 1.125rem` (matches inputs).

### Select — Mobile Bottom Sheet

Below `40rem` (640px) viewport:

- **Trigger tap** → bottom sheet slides up from bottom (replaces dropdown popover)
- **Bottom sheet structure:**
  - Backdrop: `rgba(0,0,0,0.5)` light / `rgba(0,0,0,0.7)` dark, no blur
  - Sheet takes **bottom 70%** of viewport, border-radius `0.75rem` (12px) on top corners
  - Grabber handle at top: `4px × 2rem`, color `border.secondary`, centered, `0.5rem` margin top
  - Options list below, each option **min-height `3.25rem` (52px)** for tap target
  - Selected option has `brand.primary` text color + check icon on right
- **Close interactions:**
  - Backdrop tap → close
  - Option select → close (single-select behavior)
  - **Swipe-down NOT in v1** (added complexity, revisit later)
- **Desktop (`>=40rem`):** current popover pattern preserved.

**Implementation note:** Select already has a `.container.tsx` (stateful molecule). Add viewport-size detection via `useMediaQuery` (or `matchMedia` in container). Conditional render: `<Popover>` (desktop) vs `<BottomSheet>` (mobile). 

**New BottomSheet component** under `packages/ui/src/molecules/Select/BottomSheet/` with the 4-file split:
- `BottomSheet.component.tsx` — presentation (grabber handle, option list markup)
- `BottomSheet.container.tsx` — open/close state, backdrop click handler, escape key handler
- `BottomSheet.style.ts` — slide-up animation, backdrop, sheet styling
- `BottomSheet.types.ts` — props (options, value, onSelect, onClose)

Mobile breakpoint: `useMediaQuery('(max-width: 40rem)')` in `Select.container.tsx`. If no `useMediaQuery` hook exists in the repo, create a small one in `packages/ui/src/utils/` (matches existing utilities location per CLAUDE.md rule #7).

---

## Section 5: Modal / Popup / MessageModal

**Files:**
- `packages/ui/src/atoms/Modal/Modal.style.ts`
- `packages/ui/src/molecules/MessageModal/` (all files)

### Modal Widths (general-purpose)

| Size | Width |
|---|---|
| sm | `22.5rem` (360px) |
| md | `30rem` (480px) |
| lg | `40rem` (640px) |
| xl | `60rem` (960px) |

### Popup / MessageModal (Anadolu-style)

- **Fixed width:** `24.375rem` (390px), `max-width: 90vw`
- **Border-radius:** `0.75rem` (12px) — **distinct from modal (8px)**
- **Min-height:** `12.5rem` (200px)
- **Max-height:** `80vh`, scrollable body

**Layout (vertical stack):**
```
┌─────────────────────────┐
│                         │
│      [Icon circle]      │  ← 60×60 circle, type-specific bg
│                         │
│       Title             │  ← 1.125rem, weight 600, centered
│                         │
│   Message text here.    │  ← 0.9375rem, text.secondary, centered
│   Can wrap to 2 lines.  │
│                         │
│  ┌───────────────────┐  │
│  │   Primary action  │  │  ← full-width, 3rem (48px) height
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │  Secondary action │  │  ← full-width, 3rem (48px) height
│  └───────────────────┘  │
└─────────────────────────┘
```

Buttons are **stacked vertically, full-width**, with `0.5rem` gap between. Order:
- Primary action (confirm) on top — filled style
- Secondary action (cancel) below — outline/tertiary style

Single-button popups: one full-width button at the bottom.

### Backdrop (all overlays)

- **Light:** `rgba(0, 0, 0, 0.5)`
- **Dark:** `rgba(0, 0, 0, 0.7)`
- **Blur:** none (`backdrop-filter: none`)
- **Applied uniformly** to: Modal, MessageModal, Drawer, Select mobile bottom sheet, mobile sidebar overlay.

### Animation

- **Kept:** scale-in + fade-in (`0.2s ease-out`)
- Remove blur-related keyframes if present in current Modal/Drawer styles.

---

## Out of Scope

- **No i18n string changes** — only layout/sizing.
- **No new color tokens** — only sizing changes. Hover via `filter: brightness()`. Possible small `theme.mode` field addition for dark/light detection (scoped change, not a new dimension token category).
- **No new breakpoints** — uses existing `40rem` (640px) and `48rem` (768px) where applicable.
- **Landing page** (`apps/web/src/features/landing/**`) is exempt from frontend-rules; this spec doesn't touch it unless a shared atom changes propagate there.
- **API/store/RTK Query layers** untouched.
- **Swipe-down gesture** for mobile Select bottom sheet (deferred to future spec).
- **No new unit tests** — repo has no test infrastructure yet (per CLAUDE.md).

## Files Touched (high-level)

Will be enumerated in detail during `writing-plans`. Approximate scope:

- `packages/ui/src/atoms/Button/` — 3 files modified, icon logic removed
- `packages/ui/src/atoms/Modal/` — 1 file modified (styles)
- `packages/ui/src/atoms/Textarea/` — 1 file modified
- `packages/ui/src/molecules/Drawer/` — 1 file modified
- `packages/ui/src/molecules/TextInput/` — 1 file modified
- `packages/ui/src/molecules/Select/` — 3 files modified + new `BottomSheet/` subfolder (4 files)
- `packages/ui/src/molecules/MessageModal/` — files modified for layout (vertical button stack, width, radius)
- `apps/web/src/layouts/AppLayout/` — 1-2 files modified (sidebar width + mobile overlay check)
- Feature cleanup: all files containing `<Button iconLeft=` or `<Button iconRight=` (count TBD during plan)

## Success Criteria

1. All atom/molecule changes pass `pnpm validate` (lint + typecheck).
2. Visual check: popup matches Anadolu reference (390px, 12px radius, no blur, stacked buttons).
3. Visual check: buttons have no icons in any feature screen.
4. Visual check: no `translateY` or scale on button hover.
5. Visual check: dark mode backdrops are visibly darker than light mode (0.5 → 0.7 opacity).
6. Visual check: Select on mobile (`<640px`) opens as bottom sheet.
7. Container/Component split maintained — no ESLint `design-system` rule violations.
