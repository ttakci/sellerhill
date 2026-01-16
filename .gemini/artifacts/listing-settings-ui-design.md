# Listing Settings Groups - UI Design Specification

## Overview
This document describes the UI layout for the Listing Settings Groups feature, following the exact styling patterns from the existing StoreSettings page.

---

## Screen 1: Listing Groups Overview (Card Grid)

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ [STICKY HEADER - Background: colors.background.secondary]       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📋 Listing Settings Group                  [Create New +]   │ │
│ │ Manage and assign strategy templates...                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ [MAIN CONTENT AREA - Scrollable]                                │
│                                                                  │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│ │ ⚡ Flash Sale│  │ 💎 Premium   │  │ 🔄 Refurbished│          │
│ │ Strategy     │  │ Electronics  │  │ Items        │           │
│ │              │  │              │  │              │           │
│ │ Low margin,  │  │ High ticket  │  │ Standard     │           │
│ │ high volume  │  │ items, safe  │  │ margins...   │           │
│ │ listings...  │  │ margin...    │  │              │           │
│ │              │  │              │  │              │           │
│ │ 12 products  │  │ 45 products  │  │ 8 products   │           │
│ │ [ACTIVE]     │  │ [ACTIVE]     │  │ [DRAFT]      │           │
│ │              │  │              │  │              │           │
│ │    [✏️] [🗑️] │  │    [✏️] [🗑️] │  │    [✏️] [🗑️] │           │
│ └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│ ┌──────────────┐  ┌──────────────┐                             │
│ │ 🎄 Seasonal: │  │ ➕ Add New   │                             │
│ │ Q4 Holiday   │  │ Group        │                             │
│ │              │  │ Template     │                             │
│ │ Aggressive   │  │              │                             │
│ │ pricing for  │  │ (Dashed      │                             │
│ │ holiday...   │  │  Border)     │                             │
│ │              │  │              │                             │
│ │ 0 products   │  │              │                             │
│ │ [INACTIVE]   │  │              │                             │
│ │              │  │              │                             │
│ │    [✏️] [🗑️] │  │              │                             │
│ └──────────────┘  └──────────────┘                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### Sticky Header
- **Position**: `sticky`, `top: calc(-1 * spacing.md)`
- **Background**: `colors.background.secondary`
- **Border**: `1px solid colors.border.secondary` (bottom)
- **Padding**: `spacing.md` (mobile), `spacing.xl` (desktop)
- **Z-index**: `99`

**Content:**
- Left: Icon + Title + Subtitle
- Right: "Create New Group" button (primary variant)

#### Card Grid
- **Layout**: CSS Grid
- **Columns**: 
  - Mobile: `1fr`
  - Tablet (768px+): `repeat(2, 1fr)`
  - Desktop (1200px+): `repeat(3, 1fr)`
- **Gap**: `spacing.lg`
- **Margin**: `spacing.xl` (top)

#### Individual Card
- **Component**: `Card` with `variant="bordered"`
- **Background**: `colors.background.secondary`
- **Border**: `1px solid colors.border.primary`
- **Border Radius**: `radius.lg`
- **Shadow**: `shadows.sm`
- **Padding**: `spacing.lg`
- **Min Height**: `280px`

**Card Structure:**
```
┌─────────────────────────┐
│ [Icon Badge]            │  <- 48px rounded square (like StoreSettings)
│                         │
│ Group Name (h4, bold)   │  <- Text variant="h4" weight="bold"
│                         │
│ Description (caption)   │  <- Text variant="caption" color="text.secondary"
│ (2-3 lines, truncated)  │     Line clamp: 3
│                         │
│ [Spacer - flex-grow]    │
│                         │
│ 45 products             │  <- Text variant="caption" color="text.tertiary"
│ [ACTIVE Badge]          │  <- Badge component (primary/warning/secondary)
│                         │
│ [Edit Icon] [Delete]    │  <- IconAction buttons (right-aligned)
└─────────────────────────┘
```

**Icon Badge Variants:**
- Flash Sale: ⚡ (lightning) - Blue background
- Premium: 💎 (diamond) - Purple background
- Refurbished: 🔄 (refresh) - Green background
- Seasonal: 🎄 (gift) - Orange background

**Status Badges:**
- `ACTIVE`: Badge variant="primary" (green)
- `DRAFT`: Badge variant="warning" (yellow)
- `INACTIVE`: Badge variant="secondary" (gray)

#### "Add New Group" Card
- **Border**: `2px dashed colors.border.secondary`
- **Background**: `transparent` or `colors.background.tertiary` (on hover)
- **Content**: Centered icon + text
- **Cursor**: `pointer`
- **Hover**: Slight scale transform + background change

---

## Screen 2: Edit Listing Group (Two-Column Layout)

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [STICKY HEADER - Background: colors.background.secondary]                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ← Edit Listing Group: Electronics Master                               │ │
│ │ AMAZON TO EBAY CONNECTOR                                                │ │
│ │                                            [Cancel] [💾 Save Changes]   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ [TWO-COLUMN LAYOUT]                                                          │
│                                                                              │
│ ┌──────────────────────────────┐  ┌──────────────────────────────────────┐ │
│ │ [LEFT COLUMN - Scrollable]   │  │ [RIGHT COLUMN - Fixed/Sticky]        │ │
│ │ Width: 45%                   │  │ Width: 55%                           │ │
│ │                              │  │                                      │ │
│ │ ┌──────────────────────────┐ │  │ ┌──────────────────────────────────┐ │
│ │ │ 📋 Group Details         │ │  │ │ [Desktop] [Mobile] [Dark Mode ○] │ │
│ │ ├──────────────────────────┤ │  │ ├──────────────────────────────────┤ │
│ │ │ Group Name               │ │  │ │                                  │ │
│ │ │ [Electronics Master]     │ │  │ │  ┌────────────────────────────┐  │ │
│ │ │                          │ │  │ │  │ [Product Image]            │  │ │
│ │ │ Description              │ │  │ │  │                            │  │ │
│ │ │ [Enter group notes...]   │ │  │ │  └────────────────────────────┘  │ │
│ │ └──────────────────────────┘ │  │ │                                  │ │
│ │                              │  │ │  Next-Gen Wireless Pro           │ │
│ │ ┌──────────────────────────┐ │  │ │  Smartphone - 256GB              │ │
│ │ │ 💰 Repricing Strategy    │ │  │ │  ⭐⭐⭐⭐⭐ 2,410 ratings         │ │
│ │ ├──────────────────────────┤ │  │ │                                  │ │
│ │ │ Min Price ($) Max Price  │ │  │ │  US $849.00                      │ │
│ │ │ [19.99]      [499.00]    │ │  │ │  Est. delivery Mon, Oct 25...    │ │
│ │ │                          │ │  │ │                                  │ │
│ │ │ Profit Margin (%) Fixed  │ │  │ │  [Buy It Now]                    │ │
│ │ │ [15]              [2.50] │ │  │ │  [Add to Cart]                   │ │
│ │ │                          │ │  │ │                                  │ │
│ │ │ [+ Add Price Range]      │ │  │ │  Description | Shipping, returns │ │
│ │ └──────────────────────────┘ │  │ │  ─────────────────────────────── │ │
│ │                              │  │ │  📄 Live Rendered HTML Content   │ │
│ │ ┌──────────────────────────┐ │  │ │                                  │ │
│ │ │ 📦 Stock                 │ │  │ │  Experience the pinnacle of      │ │
│ │ ├──────────────────────────┤ │  │ │  mobile technology. This         │ │
│ │ │ Default Quantity         │ │  │ │  flagship device features...     │ │
│ │ │ [5]                      │ │  │ │                                  │ │
│ │ │                          │ │  │ │  • Performance: Powered by...    │ │
│ │ │ ☑ Auto-restock on sale   │ │  │ │  • Photography: 108MP camera...  │ │
│ │ └──────────────────────────┘ │  │ │                                  │ │
│ │                              │  │ └──────────────────────────────────┘ │
│ │ ┌──────────────────────────┐ │  │                                      │ │
│ │ │ 💳 Fees                  │ │  │                                      │ │
│ │ ├──────────────────────────┤ │  │                                      │ │
│ │ │ eBay Fee      13.25%     │ │  │                                      │ │
│ │ │ Fixed Fee     $0.30      │ │  │                                      │ │
│ │ │ Tax           8.5%       │ │  │                                      │ │
│ │ └──────────────────────────┘ │  │                                      │ │
│ │                              │  │                                      │ │
│ │ ┌──────────────────────────┐ │  │                                      │ │
│ │ │ 🎨 Template              │ │  │                                      │ │
│ │ ├──────────────────────────┤ │  │                                      │ │
│ │ │ [Custom] [Predefined]    │ │  │                                      │ │
│ │ │                          │ │  │                                      │ │
│ │ │ ┌──────────────────────┐ │ │  │                                      │ │
│ │ │ │ EBAY_LISTING_HTML    │ │ │  │                                      │ │
│ │ │ │ ─────────────────────│ │ │  │                                      │ │
│ │ │ │ 1 <div class="list...│ │ │  │                                      │ │
│ │ │ │ 2   <h1>{{product_...│ │ │  │                                      │ │
│ │ │ │ 3 </h1>              │ │ │  │                                      │ │
│ │ │ │ 4                    │ │ │  │                                      │ │
│ │ │ │ [HTML Editor]        │ │ │  │                                      │ │
│ │ │ └──────────────────────┘ │ │  │                                      │ │
│ │ └──────────────────────────┘ │  │                                      │ │
│ │                              │  │                                      │ │
│ └──────────────────────────────┘  └──────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### Sticky Header (Form)
- **Back Button**: Icon "arrow-left" + Text
- **Title**: "Edit Listing Group: {groupName}"
- **Subtitle**: "AMAZON TO EBAY CONNECTOR" (muted, uppercase, small)
- **Actions**: Cancel (secondary) + Save Changes (primary with save icon)

#### Two-Column Layout
- **Container**: Flex row with gap `spacing.xl`
- **Responsive**: 
  - Desktop (1024px+): 45% / 55% split
  - Tablet/Mobile: Stack vertically (left column on top)

#### Left Column (Form Fields)
**Scrollable**: `overflow-y: auto`, `max-height: calc(100vh - header)`

**Sections** (Each is a Card with SectionHeader):

1. **Group Details**
   - Icon: 📋 (clipboard)
   - Fields: Group Name (TextInput), Description (Textarea)

2. **Repricing Strategy**
   - Icon: 💰 (money bag)
   - Dynamic array of price ranges
   - Each range: Min Price, Max Price, Profit Margin %, Fixed Profit $
   - "Add Price Range" button (secondary, with plus icon)

3. **Stock**
   - Icon: 📦 (package)
   - Default Quantity (NumberInput)
   - Auto-restock checkbox

4. **Fees**
   - Icon: 💳 (credit card)
   - eBay Fee % (read-only or editable)
   - Fixed Fee $ (NumberInput)
   - Tax % (NumberInput)

5. **Template**
   - Icon: 🎨 (palette)
   - Toggle: Custom / Predefined (ButtonGroup or SegmentedControl)
   - If Custom: HTML Editor (CodeMirror or Monaco)
   - If Predefined: Dropdown to select template

#### Right Column (Live Preview)
**Fixed/Sticky**: `position: sticky`, `top: spacing.xl`

**Header Controls:**
- Desktop/Mobile toggle (icon buttons)
- Dark Mode Preview toggle (switch)

**Preview Container:**
- **Border**: `1px solid colors.border.primary`
- **Border Radius**: `radius.lg`
- **Background**: White (light mode) or Dark (dark mode preview)
- **Padding**: `spacing.lg`
- **Shadow**: `shadows.md`
- **Overflow**: `auto`
- **Max Height**: `calc(100vh - 200px)`

**Content:**
- Rendered HTML from template
- Mock product data injected (title, price, image, description)
- Responsive iframe or sandboxed div

---

## Color Palette (Theme Tokens)

**DO NOT use custom colors from mockup. Use existing theme tokens:**

### Backgrounds
- `colors.background.primary` - Main page background
- `colors.background.secondary` - Card backgrounds
- `colors.background.tertiary` - Subtle highlights

### Borders
- `colors.border.primary` - Main borders
- `colors.border.secondary` - Subtle borders
- `colors.border.focus` - Focus states

### Text
- `colors.text.primary` - Main text
- `colors.text.secondary` - Muted text
- `colors.text.tertiary` - Very muted (metadata)

### Semantic
- `colors.semantic.success` - Active status
- `colors.semantic.warning` - Draft status
- `colors.semantic.error` - Delete actions
- `colors.semantic.info` - Info badges

### Brand
- `colors.brand.primary` - Primary buttons, icons
- `colors.brand.secondary` - Focus rings

---

## Typography

### Headers
- **Page Title**: `Text variant="h3" weight="bold" style={{ fontSize: '26px' }}`
- **Section Title**: `Text variant="h4" weight="bold" style={{ fontSize: '1.125rem' }}`
- **Card Title**: `Text variant="h4" weight="bold"`

### Body
- **Description**: `Text variant="body" color="text.secondary"`
- **Subtitle**: `Text variant="caption" color="text.secondary"`
- **Metadata**: `Text variant="caption" color="text.tertiary"`

---

## Spacing

- **Container Padding**: `spacing.md` (mobile), `spacing.xl` (desktop)
- **Card Gap**: `spacing.lg`
- **Section Gap**: `spacing.xl`
- **Form Field Gap**: `spacing.md`
- **Inline Gap**: `spacing.sm`

---

## Responsive Breakpoints

```css
/* Mobile First */
@media (min-width: 768px) {
  /* Tablet: 2-column card grid */
}

@media (min-width: 1024px) {
  /* Desktop: 3-column card grid, two-column form layout */
}

@media (min-width: 1200px) {
  /* Large Desktop: Wider containers */
}
```

---

## Interactions

### Card Hover
- **Transform**: `scale(1.02)`
- **Shadow**: `shadows.md` (elevated)
- **Transition**: `transitions.normal`

### Icon Actions
- **Hover**: Background `colors.background.tertiary`, color change
- **Active**: Slight scale down
- **Transition**: `transitions.fast`

### Form Inputs
- **Focus**: Border `colors.border.focus`, ring `colors.brand.secondary`
- **Error**: Border `colors.semantic.error`, error message below
- **Disabled**: Opacity `0.6`, cursor `not-allowed`

---

## Accessibility

- **Focus Indicators**: All interactive elements have visible focus rings
- **Keyboard Navigation**: Tab order follows visual hierarchy
- **ARIA Labels**: All icon buttons have `aria-label`
- **Color Contrast**: WCAG AA compliant (4.5:1 minimum)
- **Screen Reader**: Semantic HTML, proper heading hierarchy

---

## Loading States

### Card Grid Loading
- Skeleton cards (shimmer effect)
- 6 skeleton cards in grid layout

### Form Loading
- Disabled inputs with loading spinner
- "Save Changes" button shows spinner + "Saving..."

### Preview Loading
- Skeleton preview with pulsing animation
- "Rendering preview..." text

---

## Error States

### Form Validation
- Inline error messages below fields (red text)
- Error icon next to field label
- Scroll to first error on submit

### API Errors
- Toast notification (top-right)
- Error message in card if list fails to load
- Retry button

---

## Empty States

### No Groups
```
┌─────────────────────────────────────┐
│                                     │
│         📋 (Large Icon)             │
│                                     │
│   No Listing Groups Yet             │
│   Create your first group to start  │
│   organizing your listings          │
│                                     │
│      [Create New Group]             │
│                                     │
└─────────────────────────────────────┘
```

### No Predefined Templates
- Fallback to custom template only
- Info message: "No predefined templates available"

---

## Animation

### Page Transitions
- Fade in: `opacity 0 -> 1` (300ms)
- Slide up: `translateY(20px) -> 0` (300ms)

### Card Entrance
- Stagger animation (each card delayed by 50ms)
- Fade + slide up

### Modal/Drawer
- Backdrop fade in
- Content slide from right (300ms, ease-out)

---

## Notes

1. **Sticky Header**: Same implementation as StoreSettings (negative margin, z-index 99)
2. **Responsive**: Mobile-first approach, sidebar hidden <1024px
3. **Preview**: Use iframe or sandboxed div to prevent CSS conflicts
4. **HTML Editor**: Consider Monaco Editor or CodeMirror for syntax highlighting
5. **Template Variables**: Support placeholders like `{{product_title}}`, `{{product_price}}`
6. **Dark Mode Preview**: Toggle applies only to preview pane, not entire page
7. **Unsaved Changes**: Prompt user before navigating away if form is dirty
8. **Auto-save**: Optional debounced auto-save (save draft every 30 seconds)
