# UI Component Resizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resize and refine Button, Drawer, Sidebar, form inputs, and Modal/Popup components to match the Anadolu Sigorta visual language: smaller overlays (no backdrop blur), narrower side navigation, taller form controls, icon-free buttons, stacked-button popups.

**Architecture:** Per-component inline value updates in `packages/ui/` and `apps/web/src/layouts/AppLayout/`. No new token category introduced. Existing `theme.mode` field (already at `theme.types.ts:118`) powers dark/light-aware hover filter on Button. Select molecule already contains mobile bottom-sheet CSS — this plan polishes it rather than building from scratch.

**Tech Stack:** React 18, TypeScript, Emotion CSS-in-JS, RTK Query, pnpm workspace monorepo, custom ESLint plugin `eslint-plugin-design-system.js`.

## Global Constraints

(Copied verbatim from `docs/superpowers/specs/2026-07-08-ui-component-resizing-design.md`)

- **Full responsive:** every component adapts from 320px to 1920px+. Breakpoints: `40rem` (640px) for form controls/drawer mobile, `48rem` (768px) for sidebar mobile overlay.
- **Both themes:** light AND dark values tested. Backdrop opacity: `rgba(0,0,0,0.5)` light / `rgba(0,0,0,0.7)` dark. NO blur.
- **Bilingual (TR/EN):** no UI copy changes; layouts must handle longer Turkish words without truncation.
- **Container/Component split:** `.container.tsx` = logic, `.component.tsx` = markup + `useTranslation`/`useTheme` only, `.style.ts` = all `styled(...)`, `.types.ts` = types/enums only.
- **No hardcoded magic values:** use `tkn('spacing.*')` for spacing tokens. Inline rem values allowed for heights/widths per the approved "per-component inline" token strategy.
- **Verification gate:** `pnpm validate` (lint + typecheck). No test infrastructure exists yet.
- **No emojis** unless explicitly requested.
- **Existing theme field:** `theme.mode: 'light' | 'dark'` available at `packages/ui/src/theme/theme.types.ts:118`. Read via `${({ theme }) => theme.mode}` in Emotion callbacks.

---

## File Structure

### Files Modified

| File | Responsibility | Task |
|---|---|---|
| `packages/ui/src/atoms/Button/Button.types.ts` | Remove `iconLeft`, `iconRight` from props | Task 1 |
| `packages/ui/src/atoms/Button/Button.component.tsx` | Remove icon rendering JSX | Task 1 |
| `packages/ui/src/atoms/Button/Button.style.ts` | New heights/padding/font-weight, hover brightness, color fixes, remove icon CSS | Task 1 |
| `packages/ui/src/molecules/Drawer/Drawer.style.ts` | Narrower widths, no blur backdrop, reduced padding | Task 2 |
| `apps/web/src/layouts/AppLayout/AppLayout.style.ts` | Sidebar 240/64px, mobile overlay backdrop no blur | Task 3 |
| `packages/ui/src/molecules/TextInput/TextInput.style.ts` | Heights 52/60/68, padding | Task 4 |
| `packages/ui/src/atoms/Textarea/Textarea.style.ts` | Min-height 140px (single size) | Task 5 |
| `packages/ui/src/atoms/Modal/Modal.style.ts` | Narrower widths, no blur backdrop | Task 6 |
| `packages/ui/src/molecules/MessageModal/MessageModal.style.ts` | Fixed 390px width, 12px radius, vertical button stack | Task 7 |
| `packages/ui/src/molecules/MessageModal/MessageModal.component.tsx` | Vertical button layout markup | Task 7 |
| `packages/ui/src/molecules/Select/Select.style.ts` | Heights 52/60/68, padding, bottom sheet polish | Task 8 |

### Files NOT Touched

- No new `useMediaQuery` hook — Select already uses `window.innerWidth < 1024` pattern at `Select.container.tsx:38`.
- No new `BottomSheet/` subfolder — Select's mobile bottom sheet is inline in existing files.
- No feature code changes — `iconLeft`/`iconRight` props were never used outside Button itself (confirmed via grep).
- No `themes.ts`/`theme.types.ts` changes — `mode` field already exists.
- No landing page changes (exempt per CLAUDE.md).
- No API/store/RTK Query changes.

---

## Task 1: Button Atom — Remove Icons + New Sizing/Hover

**Files:**
- Modify: `packages/ui/src/atoms/Button/Button.types.ts`
- Modify: `packages/ui/src/atoms/Button/Button.component.tsx`
- Modify: `packages/ui/src/atoms/Button/Button.style.ts`

**Interfaces:**
- Consumes: `${({ theme }) => theme.mode}` from existing Emotion theme (returns `'light' | 'dark'`)
- Produces: `<Button>` with no icon props; variants still `primary | secondary | tertiary | text | danger`

- [ ] **Step 1: Remove icon props from Button.types.ts**

Open `packages/ui/src/atoms/Button/Button.types.ts`. Delete the `iconLeft?` and `iconRight?` lines (currently around lines 13-14). The remaining props stay untouched.

Final file content should retain:
```ts
import { { ThemeColorsPath } } from '../../theme/tkn';  // keep existing imports
// ... ButtonVariant, ButtonSize type unions stay
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  // iconLeft and iconRight REMOVED
  isLoading?: boolean;
  isFullWidth?: boolean;
  // ... rest unchanged
}
```

- [ ] **Step 2: Remove icon rendering from Button.component.tsx**

Open `packages/ui/src/atoms/Button/Button.component.tsx`. Delete the JSX that renders `iconLeft` and `iconRight` (around lines 41-43). Also delete any `iconSize` calculation referencing the size prop (around line 41 — "16px for xsmall, 20px for others").

The component body should retain only:
```tsx
return (
  <StyledButton
    type={type}
    disabled={disabled || isLoading}
    $variant={variant}
    $size={size}
    $isFullWidth={isFullWidth}
    $isLoading={isLoading}
    {...rest}
  >
    {isLoading && <LoadingSpinner>...</LoadingSpinner>}
    {!isLoading && children}
  </StyledButton>
);
```

Keep the `LoadingSpinner` block (or whatever the existing loading dots markup is) exactly as-is.

- [ ] **Step 3: Update Button.style.ts — heights, padding, font-weight, min-width**

Open `packages/ui/src/atoms/Button/Button.style.ts`. Update the size variant blocks:

**Heights** (around lines 17-29):
```ts
const heights = {
  xsmall: '2rem',   // 32px (unchanged)
  small: '2.75rem', // 44px (was 2.5rem)
  medium: '3.25rem', // 52px (was 2.75rem)
  large: '3.75rem',  // 60px (was 3.25rem)
};
```

**Padding** (around lines 31-43):
```ts
const paddings = {
  xsmall: '0 0.75rem',   // unchanged
  small: '0 1rem',       // unchanged
  medium: '0 1.25rem',   // unchanged
  large: '0 1.5rem',     // unchanged
};
```
(Padding values are already correct per audit — verify, don't change unless different from above.)

**Min-width** (around lines 45-57) — keep current values, no change required.

**Font-size** (around line 83) — update:
```ts
const fontSizes = {
  xsmall: '0.8125rem',  // was 0.875rem
  small: '0.875rem',    // unchanged
  medium: '0.9375rem',  // was 0.875rem
  large: '1rem',        // unchanged
};
```

**Font-weight** (around line 82): change `600` → `500`.

- [ ] **Step 4: Update Button.style.ts — hover brightness replaces translateY**

For EACH variant block (`primary`, `secondary`, `tertiary`, `text`, `danger`):
1. Delete all `transform: translateY(...)` declarations.
2. Add a hover rule using `theme.mode` to switch brightness direction.

Example for `primary` variant (around line 97 area — replace the existing `&:hover` block):
```ts
'&:hover': {
  filter: ({ theme }) => theme.mode === 'dark' ? 'brightness(1.08)' : 'brightness(0.92)',
  // KEEP existing bg color declaration — do not delete the bg
},
```

Apply the same hover pattern to all 5 variants. The `bg` / `color` / `border` declarations inside `&:hover` blocks (if any) stay; only `transform` is removed.

- [ ] **Step 5: Update Button.style.ts — secondary variant color fix**

In the `secondary` variant block (around lines 110-120), change the `color` declaration from `text.primary` to `brand.primary`:
```ts
secondary: {
  bg: { /* keep existing */ },
  color: 'brand.primary', // was: text.primary (NO BLACK TEXT)
  border: { /* keep existing border.primary */ },
},
```

Verify `danger` variant stays as ghost/outline (bg `background.secondary`, color `semantic.error`, border `semantic.error`) — do NOT make it filled. This was a self-review correction in the spec.

- [ ] **Step 6: Delete icon-specific CSS from Button.style.ts**

Search the file for any CSS rules sizing icon containers (rules referencing `.icon`, `svg`, icon widths). Delete them. If none exist beyond the component.tsx logic, skip.

- [ ] **Step 7: Run validation gate**

Run: `pnpm validate`
Expected: PASS (0 lint warnings, 0 typecheck errors). If lint fails on unused imports (e.g., `ReactNode` imported for icons), remove the unused imports.

- [ ] **Step 8: Commit**

```bash
cd D:/dev/projects/sellerhill/sellerhill
git add packages/ui/src/atoms/Button/Button.types.ts packages/ui/src/atoms/Button/Button.component.tsx packages/ui/src/atoms/Button/Button.style.ts
git commit -m "$(cat <<'EOF'
refactor(ui): Button — remove icon props, new sizing, brightness hover

Heights 32/44/52/60, font-weight 500. Removed iconLeft/iconRight props
(never used in feature code). Hover: translateY → brightness(0.92/1.08)
via theme.mode. Secondary variant color text.primary → brand.primary
(no black text). Danger stays ghost/outline per spec.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Drawer Molecule — Narrower Widths + No Blur Backdrop

**Files:**
- Modify: `packages/ui/src/molecules/Drawer/Drawer.style.ts`

**Interfaces:**
- Consumes: existing `size` prop `'sm' | 'md' | 'lg'`
- Produces: unchanged Drawer API

- [ ] **Step 1: Update Drawer widths**

Open `packages/ui/src/molecules/Drawer/Drawer.style.ts`. Find the size variant map (around lines 26-36). Update:

```ts
const sizes = {
  sm: '20rem',     // 320px (was 25rem / 400px)
  md: '26.25rem',  // 420px (was 37.5rem / 600px)
  lg: '35rem',     // 560px (was 50rem / 800px)
};
```

- [ ] **Step 2: Remove backdrop blur, use best-practice opacity**

In the backdrop styled component (around line 11), replace the backdrop styles:

```ts
export const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  /* REMOVED: backdrop-filter: blur(0.25rem); */
  z-index: ${({ theme }) => theme.zIndex.overlay};
  animation: ${fadeIn} 0.2s ease-out;

  /* Dark mode: darker backdrop */
  ${({ theme }) => theme.mode === 'dark' && css`
    background-color: rgba(0, 0, 0, 0.7);
  `}
`;
```

(If the existing code uses a different structure — e.g., one `BackDrop` styled with conditional — adapt. The key: no `backdrop-filter`, two opacity values per theme mode.)

Add `css` import from `@emotion/react` if not already imported at top of file.

- [ ] **Step 3: Reduce inner padding**

Find Header, Body, Footer styled components (around lines 52-82). Change padding from `spacing.lg` (1.5rem) to `spacing.md` (1rem):

```ts
padding: ${({ theme }) => theme.spacing.md};
```

Apply to all three (Header, Body, Footer).

- [ ] **Step 4: Verify mobile full-width rule exists**

Check the file for a `@media (max-width: 48rem)` (or similar 768px) rule that sets drawer width to `100vw`. If present, leave it. If absent, add:

```ts
@media (max-width: 48rem) {
  width: 100vw !important;
}
```

to the main Panel styled component (around line 42 area).

- [ ] **Step 5: Run validation gate**

Run: `pnpm validate`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/molecules/Drawer/Drawer.style.ts
git commit -m "$(cat <<'EOF'
refactor(ui): Drawer — narrower widths, no blur backdrop

Widths 320/420/560px (was 400/600/800). Backdrop blur removed;
opacity 0.5 light / 0.7 dark. Inner padding spacing.lg → spacing.md.
Mobile full-width preserved.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Sidebar / AppLayout — Narrower Widths + Mobile Overlay Backdrop

**Files:**
- Modify: `apps/web/src/layouts/AppLayout/AppLayout.style.ts`

**Interfaces:**
- Consumes: existing `sidebarCollapsed`, `mobileSidebarOpen` state from `AppLayout.container.tsx:30-31`
- Produces: unchanged layout API

- [ ] **Step 1: Update sidebar widths**

Open `apps/web/src/layouts/AppLayout/AppLayout.style.ts`. Find the width constants (around line 24). Update:

```ts
export const sidebarWidths = {
  collapsed: '4rem',   // 64px (was 5rem / 80px)
  expanded: '15rem',   // 240px (was 18rem / 288px)
};
```

(If the values are inline in styled components rather than a shared constant, update them inline in every reference. Use grep to find all occurrences of `'5rem'` or `'18rem'` in this file that relate to sidebar width — some `5rem` values may refer to header height, leave those.)

- [ ] **Step 2: Remove blur from mobile sidebar overlay backdrop**

Find the mobile sidebar overlay backdrop (around line 62). Update:

```ts
export const MobileSidebarBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  /* REMOVED: backdrop-filter: blur(0.125rem); */
  z-index: ${({ theme }) => theme.zIndex.overlay};

  ${({ theme }) => theme.mode === 'dark' && css`
    background-color: rgba(0, 0, 0, 0.7);
  `}
`;
```

Add `css` import from `@emotion/react` if not present.

- [ ] **Step 3: Verify mobile overlay pattern is intact**

Open `apps/web/src/layouts/AppLayout/AppLayout.container.tsx`. Confirm:
- `mobileSidebarOpen` state toggles on hamburger tap (around line 30-31)
- `window.innerWidth < 1024` check exists (around line 44)
- Hamburger button rendered below `48rem` / 768px breakpoint

If any piece is missing, add it. The overlay sidebar slides from left, width `15rem` (240px), full height, uses the new backdrop.

- [ ] **Step 4: Run validation gate**

Run: `pnpm validate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/layouts/AppLayout/AppLayout.style.ts apps/web/src/layouts/AppLayout/AppLayout.container.tsx
git commit -m "$(cat <<'EOF'
refactor(ui): AppLayout sidebar — 240/64px widths, no blur mobile overlay

Expanded 288→240px, collapsed 80→64px. Mobile sidebar overlay backdrop
blur removed; opacity 0.5 light / 0.7 dark. Mobile overlay pattern
verified.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: TextInput — Uniform Heights + Padding

**Files:**
- Modify: `packages/ui/src/molecules/TextInput/TextInput.style.ts`

**Interfaces:**
- Produces: unchanged TextInput API

- [ ] **Step 1: Update TextInput heights**

Open `packages/ui/src/molecules/TextInput/TextInput.style.ts`. Find the height map (around line 26). Update:

```ts
const heights = {
  small: '3.25rem',  // 52px (was 2.75rem / 44px)
  medium: '3.75rem', // 60px (was 3.25rem / 52px)
  large: '4.25rem',  // 68px (was 3.75rem / 60px)
};
```

- [ ] **Step 2: Update TextInput padding**

Find the padding declaration in the input styled component (search for `padding:`). Update to:

```ts
padding: 0.875rem 1.125rem;
```

(If the existing code uses tokens like `spacing.sm-md spacing.md`, replace those with the explicit values above. Token consistency is desired but the existing values give less generous padding for the new taller inputs.)

- [ ] **Step 3: Verify floating label transforms still align**

The file has floating label transforms (around lines 82-100) that translate the label based on size. With new taller inputs, the label may sit too high or too low. Visually verify in dev server — if label position looks off, nudge the `translateY` values by `+0.25rem` to account for the ~8px height increase per size.

- [ ] **Step 4: Run validation gate**

Run: `pnpm validate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/molecules/TextInput/TextInput.style.ts
git commit -m "$(cat <<'EOF'
refactor(ui): TextInput — heights 52/60/68, padding 0.875/1.125rem

Heights increased to match Select (52/60/68px uniform). Padding widened
for taller inputs. Floating label positions verified.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Textarea — Update Min-height

**Files:**
- Modify: `packages/ui/src/atoms/Textarea/Textarea.style.ts`

**Interfaces:** none (Textarea has no size prop currently — single min-height only)

- [ ] **Step 1: Update min-height and padding**

Open `packages/ui/src/atoms/Textarea/Textarea.style.ts`. Update:

```ts
export const StyledTextarea = styled.textarea`
  /* ... existing rules ... */
  min-height: 8.75rem;   /* 140px — was 7.5rem / 120px */
  padding: 0.875rem 1.125rem;  /* was spacing.sm-md spacing.md */
  border-radius: 0.5rem;  /* 8px — matches Button, was spacing.sm */
`;
```

(Single min-height since Textarea has no size variant. Adding size variants is out of scope per the approved spec.)

- [ ] **Step 2: Run validation gate**

Run: `pnpm validate`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/atoms/Textarea/Textarea.style.ts
git commit -m "$(cat <<'EOF'
refactor(ui): Textarea — min-height 140px, padding/radius aligned with inputs

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Modal — Narrower Widths + No Blur Backdrop

**Files:**
- Modify: `packages/ui/src/atoms/Modal/Modal.style.ts`

**Interfaces:** none

- [ ] **Step 1: Update Modal widths**

Open `packages/ui/src/atoms/Modal/Modal.style.ts`. Find the size map (around lines 36-49). Update:

```ts
const sizes = {
  sm: '22.5rem',  // 360px (was 25rem / 400px)
  md: '30rem',    // 480px (was 37.5rem / 600px)
  lg: '40rem',    // 640px (was 50rem / 800px)
  xl: '60rem',    // 960px (was 75rem / 1200px)
};
```

- [ ] **Step 2: Remove backdrop blur, best-practice opacity**

Find the backdrop styled component (around line 14). Replace:

```ts
export const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  /* REMOVED: backdrop-filter: blur(0.25rem); */
  z-index: ${({ theme }) => theme.zIndex.overlay};
  animation: ${fadeIn} 0.2s ease-out;

  ${({ theme }) => theme.mode === 'dark' && css`
    background-color: rgba(0, 0, 0, 0.7);
  `};
`;
```

Add `css` import from `@emotion/react` if not present.

- [ ] **Step 3: Run validation gate**

Run: `pnpm validate`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/atoms/Modal/Modal.style.ts
git commit -m "$(cat <<'EOF'
refactor(ui): Modal — widths 360/480/640/960, no blur backdrop

Widths reduced ~20%. Backdrop blur removed; opacity 0.5 light / 0.7
dark.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: MessageModal — Fixed Width + Vertical Button Stack

**Files:**
- Modify: `packages/ui/src/molecules/MessageModal/MessageModal.style.ts`
- Modify: `packages/ui/src/molecules/MessageModal/MessageModal.component.tsx`

**Interfaces:**
- Consumes: existing Modal molecule (Task 6 already updated widths)
- Produces: unchanged MessageModal API

- [ ] **Step 1: Force fixed popup width in MessageModal.style.ts**

Open `packages/ui/src/molecules/MessageModal/MessageModal.style.ts`. The current code sets `Button` min-width (around lines 39-44). Replace the styles to:

```ts
import styled from '@emotion/styled';
import { Modal } from '../../atoms/Modal/Modal.component';

export const PopupModal = styled(Modal)`
  /* Override Modal's size prop — popup is always 390px */
  width: 24.375rem !important;
  max-width: 90vw;
  border-radius: 0.75rem;  /* 12px — distinct from Modal's 8px */
  min-height: 12.5rem;
  max-height: 80vh;
`;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2rem 1.5rem;
  gap: 0.75rem;
`;

export const IconCircle = styled.div<{ $type: string }>`
  width: 3.75rem;   /* 60px */
  height: 3.75rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
  background-color: ${({ theme, $type }) => {
    switch ($type) {
      case 'success': return theme.colors.semantic.successBg;
      case 'error':   return theme.colors.semantic.errorBg;
      case 'warning': return theme.colors.semantic.warningBg;
      default:        return theme.colors.semantic.infoBg;
    }
  }};
`;

export const Title = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0;
`;

export const Message = styled.p`
  font-size: 0.9375rem;
  color: ${({ theme }) => theme.colors.text.secondary};
  margin: 0;
  line-height: 1.5;
`;

export const ButtonStack = styled.div`
  display: flex;
  flex-direction: column;  /* VERTICAL STACK per user requirement */
  gap: 0.5rem;
  width: 100%;
  margin-top: 0.5rem;

  & > button {
    width: 100%;
    height: 3rem;  /* 48px */
  }
`;
```

(If `semantic.successBg`/`errorBg`/`warningBg`/`infoBg` tokens don't exist, fall back to alpha-tinted versions of `semantic.success`/`error`/`warning`/`info`. Verify in `themes.ts` before use; if absent, use `rgba(...)` values inline with semantic colors at 12% opacity.)

- [ ] **Step 2: Refactor MessageModal.component.tsx for vertical button stack**

Open `packages/ui/src/molecules/MessageModal/MessageModal.component.tsx`. Restructure the JSX to use the new styled components:

```tsx
import { useTranslation } from 'react-i18next';
import { Icon } from '../../atoms/Icon/Icon.component';
import { Button } from '../../atoms/Button/Button.component';
import {
  PopupModal,
  Content,
  IconCircle,
  Title,
  Message,
  ButtonStack,
} from './MessageModal.style';
import { MessageModalProps } from './MessageModal.types';

const iconMap = {
  success: 'check-circle',
  error: 'x-circle',
  warning: 'alert-triangle',
  info: 'info',
} as const;

export const MessageModal = ({
  isOpen,
  onClose,
  type = 'info',
  title,
  message,
  primaryAction,
  secondaryAction,
}: MessageModalProps) => {
  const { t } = useTranslation(['translation']);
  if (!isOpen) return null;

  return (
    <PopupModal size="sm" onClose={onClose}>
      <Content>
        <IconCircle $type={type}>
          <Icon name={iconMap[type]} size={32} color={`semantic.${type}`} />
        </IconCircle>
        <Title>{title}</Title>
        {message && <Message>{message}</Message>}
        <ButtonStack>
          {primaryAction && (
            <Button variant="primary" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </ButtonStack>
      </Content>
    </PopupModal>
  );
};
```

(Preserve existing prop names/types from `MessageModal.types.ts`. Adapt destructuring if names differ — e.g., `onConfirm` instead of `primaryAction`. Match what the existing API expects.)

- [ ] **Step 3: Verify Modal children prop accepts styled override**

The `PopupModal = styled(Modal)` requires Modal to forward `className` and accept `children`. Open `packages/ui/src/atoms/Modal/Modal.component.tsx` to confirm:
- Modal forwards `className` to its outer styled div
- Modal renders `children` inside its body

If Modal renders its own Header/Body/Footer structure, MessageModal's children may need to slot into a specific section. Adapt Step 2's JSX accordingly.

- [ ] **Step 4: Run validation gate**

Run: `pnpm validate`
Expected: PASS. Common failures:
- `semantic.successBg` token doesn't exist → fall back to alpha-rgba inline
- `MessageModalProps` field names mismatch → adapt destructuring
- Modal doesn't accept arbitrary children → use Modal's existing slots

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/molecules/MessageModal/MessageModal.style.ts packages/ui/src/molecules/MessageModal/MessageModal.component.tsx
git commit -m "$(cat <<'EOF'
refactor(ui): MessageModal — 390px popup, 12px radius, vertical buttons

Fixed 24.375rem width / 12px radius distinct from Modal. 60px icon
circle, centered title/message, vertical button stack (alt alta) per
Anadolu Sigorta reference.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Select — Heights + Mobile Bottom Sheet Polish

**Files:**
- Modify: `packages/ui/src/molecules/Select/Select.style.ts`

**Interfaces:** none (mobile bottom sheet already wired in `Select.container.tsx:38`)

- [ ] **Step 1: Update Select field heights**

Open `packages/ui/src/molecules/Select/Select.style.ts`. Find the height map (around line 25). Update:

```ts
const heights = {
  small: '3.25rem',  // 52px (was 2.75rem / 44px)
  medium: '3.75rem', // 60px (was 3rem / 48px)
  large: '4.25rem',  // 68px (was 3.5rem / 56px)
};
```

- [ ] **Step 2: Update Select field padding**

Find the SelectField styled component padding (search for the field's `padding:` declaration). Update to:

```ts
padding: 0.875rem 1.125rem;
```

(Aligned with TextInput from Task 4.)

- [ ] **Step 3: Polish the existing mobile bottom sheet styling**

The bottom sheet CSS exists at lines 283-291 (slides up from `translateY(100%)`). Verify and polish:

```ts
export const MobileBottomSheet = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 70vh;
  background-color: ${({ theme }) => theme.colors.background.primary};
  border-radius: 0.75rem 0.75rem 0 0;  /* 12px top corners */
  z-index: ${({ theme }) => theme.zIndex.overlay + 1};
  transform: translateY(${({ $isOpen }) => $isOpen ? '0' : '100%'});
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  padding: 0.75rem 1rem 1.5rem;
  overflow-y: auto;
`;

export const Grabber = styled.div`
  width: 2rem;
  height: 0.25rem;
  background-color: ${({ theme }) => theme.colors.border.secondary};
  border-radius: 999px;
  margin: 0 auto 1rem;
`;

export const MobileOption = styled.button<{ $isSelected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 3.25rem;  /* 52px tap target */
  padding: 0 0.5rem;
  width: 100%;
  border: none;
  background: transparent;
  color: ${({ theme, $isSelected }) =>
    $isSelected ? theme.colors.brand.primary : theme.colors.text.primary};
  font-size: 1rem;
  cursor: pointer;

  &:active {
    background-color: ${({ theme }) => theme.colors.background.secondary};
  }
`;
```

(If the existing code already has these structures with different class names, adapt the names — don't duplicate. The key requirements: 12px top corners, 70vh max-height, grabber handle, 52px option min-height.)

- [ ] **Step 4: Update mobile bottom sheet backdrop**

Find the mobile backdrop styled component (search for `position: fixed` in the context of mobile rendering). Update to:

```ts
export const MobileBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: ${({ theme }) => theme.zIndex.overlay};

  ${({ theme }) => theme.mode === 'dark' && css`
    background-color: rgba(0, 0, 0, 0.7);
  `};
`;
```

No blur. Add `css` import if not present.

- [ ] **Step 5: Verify mobile detection uses 640px breakpoint**

Open `packages/ui/src/molecules/Select/Select.container.tsx`. The current check at line 38 is `window.innerWidth < 1024`. Update to:

```ts
const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
```

(640px = 40rem, aligned with the spec's mobile breakpoint for form controls.)

Also add a `resize` event listener so the mobile/desktop switch responds to viewport changes:

```ts
useEffect(() => {
  const onResize = () => setIsMobile(window.innerWidth < 640);
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}, []);
```

(Add `isMobile` to the existing state declarations in the container.)

- [ ] **Step 6: Update Select.component.tsx to render Grabber + MobileOptions**

Open `packages/ui/src/molecules/Select/Select.component.tsx`. Find the mobile rendering branch (the one that uses `MobileBottomSheet`). Add `<Grabber />` as the first child inside `<MobileBottomSheet>`, and ensure options map to `<MobileOption>` with the `$isSelected` prop.

(If the mobile branch uses a different structure, refactor to use the polished styled components from Step 3. Preserve `onSelect` and `onClose` callbacks.)

- [ ] **Step 7: Run validation gate**

Run: `pnpm validate`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/molecules/Select/Select.style.ts packages/ui/src/molecules/Select/Select.container.tsx packages/ui/src/molecules/Select/Select.component.tsx
git commit -m "$(cat <<'EOF'
refactor(ui): Select — heights 52/60/68, polished mobile bottom sheet

Field heights aligned with TextInput. Mobile breakpoint 1024 → 640px.
Bottom sheet polished: 12px top corners, 70vh max, grabber handle,
52px option tap targets. Backdrop no blur; 0.5/0.7 opacity per theme.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

- [ ] **Step 1: Run full validation**

```bash
cd D:/dev/projects/sellerhill/sellerhill
pnpm validate
```
Expected: lint 0 warnings, typecheck 0 errors.

- [ ] **Step 2: Visual smoke test (manual)**

Start dev server: `pnpm dev`. Open the web app at `http://localhost:5173` and verify in BOTH light and dark mode:

1. **Button hover** — no movement, only bg color shift. Check primary, secondary, tertiary, danger on a settings page.
2. **Drawer** — open any drawer (e.g., order detail sidebar). Width feels narrower (~420px). Backdrop is dark but not blurred.
3. **Sidebar** — narrower (~240px). Toggle collapse to 64px. Resize below 768px — hamburger appears, mobile overlay works.
4. **Form inputs** — open any form (e.g., login, settings). TextInput/Select heights visibly taller, padding more generous.
5. **Select mobile** — resize below 640px. Tap a Select trigger. Bottom sheet slides from bottom with grabber handle, 52px option rows.
6. **Popup** — trigger any `showMessage` call. Popup is ~390px wide, 12px corners, dark backdrop (no blur), buttons stacked vertically full-width.
7. **Modal** — open any Modal (e.g., confirmation). Width narrower than before, no backdrop blur.

If any visual issue, note it and address in a follow-up commit before declaring done.

- [ ] **Step 3: i18n spot check**

Switch language between EN and TR. Verify:
- Button labels don't truncate (especially "Vazgeç" in TR vs "Cancel" in EN — both fit in 52px-tall buttons).
- Popup titles/messages wrap correctly when TR copy is longer.
- Sidebar nav labels don't truncate (TR "eBay Listelemeleri" vs EN "eBay Listings").

- [ ] **Step 4: Final commit if any fixes were needed**

If fixes were applied in Step 2 or 3, commit them:

```bash
git add -p
git commit -m "$(cat <<'EOF'
fix(ui): visual polish from smoke test

[Describe specific fixes — e.g., floating label offset, token fallback
for missing semantic.*Bg tokens, etc.]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Spec Coverage Check

| Spec Section | Task |
|---|---|
| §1 Button (heights, no icons, no scale, no black text, font 500) | Task 1 |
| §2 Drawer (320/420/560, no blur, padding) | Task 2 |
| §3 Sidebar (240/64, mobile overlay backdrop) | Task 3 |
| §4 TextInput (52/60/68 uniform, padding) | Task 4 |
| §4 Textarea (140px min, no size variants) | Task 5 |
| §5 Modal (360/480/640/960, no blur) | Task 6 |
| §5 MessageModal (390px, 12px, vertical stack) | Task 7 |
| §4 Select (52/60/68, mobile bottom sheet) | Task 8 |
| Cross-cutting: full responsive, both themes, TR/EN, no hardcoded | All tasks |
