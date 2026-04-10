# Frontend Component & Style Rules

## Component Hierarchy
- **Atoms** → Primitive UI elements (`packages/ui/src/atoms/`): Text, Button, Icon, Badge, Card, etc.
- **Molecules** → Composed atoms (`packages/ui/src/molecules/`): Select, TextInput, PageHeader, Toast, Collapsible, etc.
- **Pages** → Feature screens (`apps/web/src/features/[feature]/`)

## Mandatory Rules

### 1. Reuse Atoms & Molecules — Never Duplicate
Feature screens MUST NOT create custom UI primitives when an equivalent atom/molecule exists in `@repo/ui`. This applies to both `.component.tsx` and `.style.ts` files.

**What this means:**
- **Buttons** → Use `Button`, `ModernButton`, or `IconButton` directly, or extend them in `.style.ts`: `styled(Button)`.
- **Text inputs** → Use or extend `TextInput`. Never `styled.input` or raw `<input>`.
- **Textareas** → Use or extend `Textarea`. Never `styled.textarea`.
- **Dropdowns** → Use or extend `Select`. Never native `<select>`.
- **Badges** → Use or extend `Badge`, `StatusBadge`. Never `styled.span` acting as a badge.
- **Headings/Text** → Use `<Text variant="h1">` etc. Never `styled.h1`, `styled.h2`, `styled.h3`, `styled.p`.
- **Cards** → Use or extend `Card` and its variants. Never build card-like structures from `styled.div`.
- **Tables** → Use `Table` molecule. Never `styled.table`/`styled.thead`/`styled.th`/`styled.tr`/`styled.td`.
- **Other** → Check the available atoms/molecules list below before creating any new styled primitive.

**How to extend in `.style.ts` — Use Props, Not Custom CSS:**
When extending atoms/molecules, use their built-in variant/weight/size props instead of writing custom CSS. The template literal should be empty or contain only layout CSS (margin, gap, display, position, width, height, grid, flex).

```ts
// WRONG — custom CSS that duplicates variant behavior
export const SectionTitle = styled(Text)`
  font-size: 1rem;
  font-weight: 700;
  color: ${tkn('colors.text.primary')};
`;

// RIGHT — empty template, pass variant/weight in component file
export const SectionTitle = styled(Text)``;
// Then in .component.tsx: <SectionTitle variant="h3" weight="bold">
```

```ts
// WRONG — custom CSS for button styling
export const TextBtn = styled(Button)`
  background: none; border: none; color: ${tkn('colors.brand.primary')};
`;

// RIGHT — use variant prop
export const TextBtn = styled(Button)``;
// Then in .component.tsx: <TextBtn variant="text">
```

**What counts as layout CSS (allowed in template):**
- `margin`, `gap`, `padding` (when atom doesn't handle it via size)
- `display: flex`, `flex-direction`, `align-items`, `justify-content`
- `position`, `top`, `right`, `bottom`, `left`
- `width`, `height`, `min-height`, `max-width`
- `overflow`, `grid-column`, `z-index`
- `opacity`, `cursor` (when not covered by variant)

**What must use props instead of CSS:**
- `font-size`, `font-weight`, `font-family` → Text `variant`, `weight` props
- `color` (text) → Text `color`, `muted` props; Button `variant` prop
- `background`, `border`, `border-radius` → Button/Badge/Card `variant` + `size` props
- `box-shadow` → Card `variant` prop
- `padding` (inner) → Button/Badge `size` prop

**Exception:** Layout-only wrappers (`Container`, `Grid`, `Row`, `Column`, etc.) may use `styled.div` since they carry no visual semantics.
**Exception:** Dynamic state styling (e.g., `$active` conditional colors) that cannot be expressed through static variant props may use minimal custom CSS.

### 2. No Inline Styled Components in .component.tsx
NEVER create `styled.div` in `.component.tsx` files. All styled components must be in `.style.ts` files.

### 3. tkn() Token Mandatory
All colors, spacing, shadows, radius, typography values MUST use `tkn('path')` from `@repo/ui`.
NEVER hardcode hex colors (`#3B82F6`), rgb values, or raw pixel values for design tokens.

### 4. Text Component Mandatory
All visible text MUST use the `<Text>` component from `@repo/ui`. Use the appropriate variant:
- `display` → 36px hero headings
- `h1` → 24px page titles
- `h2` → 20px section titles
- `h3` → 18px subsection titles
- `h4` → 16px card/panel titles
- `h5` → 14px semibold labels
- `body` → 14px body text
- `body-sm` → 14px small body
- `body-xs` → 12px extra small body
- `caption` → 12px captions
- `mono` → 12px monospace (JetBrains Mono)
- `overline` → 10px uppercase labels

### 5. Select for All Dropdowns
All dropdown selects MUST use `Select` from `@repo/ui`. Never use native HTML `<select>`.

### 6. TextInput for All Text Inputs
All text input fields MUST use `TextInput` from `@repo/ui`. Never use raw `<input>` or old `Input`.

### 7. Card Variants
Use the appropriate `Card` variant from `@repo/ui`:
- `default` → border + shadow (panels)
- `bordered` → border only
- `elevated` → shadow only (floating)
- `flat` → no border/shadow
- `interactive` → hoverable with lift effect (grid cards)
- `stat` → statistic card with icon/value/trend
- `section` → titled section container

### 8. PageHeader for Page Titles
Use `PageHeader` molecule for consistent page headers.

### 9. Toast for Notifications
Use `useToast()` hook for action notifications:
```tsx
const { toast } = useToast();
toast.success('Saved successfully');
toast.error('Something went wrong');
```

### 10. Icon Component
Use `Icon` atom from `@repo/ui`. Never use inline SVGs.

### 11. Hover Effects Required
All interactive elements MUST have visible hover effects:
- Color change (background, border, or text)
- Subtle lift (translateY)
- Shadow enhancement
- Use `transition: all ${tkn('transitions.fast')}` for smooth transitions

## Available Components

### Atoms
Button, IconButton, ModernButton, Checkbox, Radio, Toggle, Textarea, Text, Icon, Card, CardHeader, CardBody, CardFooter, CardStat, Badge, Alert, Breadcrumb, Modal, Dropdown, Tabs, ProgressBar, Logo, MeshBackground, Typewriter

### Molecules
Select, TextInput, ConfirmModal, CheckboxGroup, RadioGroup, ThemeToggle, Table, TablePagination, SwitchRow, SettingsCard, StatusBadge, ViewToggle, PageHeader, SearchField, QuickActionCard, EmptyState, ErrorState, Popover, Tooltip, Toast, Collapsible, Stepper, SegmentedControl, ListItem

### Hooks
useLoading, useTheme, useUI, useToast
