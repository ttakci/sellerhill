# Responsive Design Rules

## 🚨 CRITICAL RULES - NO EXCEPTIONS

### 1. Unit Usage

- ✅ **USE**: `rem`, `em`, `%`, `vw`, `vh`, `fr` (grid)
- ❌ **NEVER USE**: `px` for sizing (only for borders: `1px`, `2px`)
- **Base**: `1rem = 16px` (browser default)

### 2. Breakpoints (Mobile-First)

```css
/* Mobile First - Default styles are for mobile */

/* Small Mobile */
@media (min-width: 20rem) {
  /* 320px */
}

/* Mobile */
@media (min-width: 30rem) {
  /* 480px */
}

/* Tablet */
@media (min-width: 48rem) {
  /* 768px */
}

/* Desktop */
@media (min-width: 64rem) {
  /* 1024px */
}

/* Large Desktop */
@media (min-width: 80rem) {
  /* 1280px */
}

/* Extra Large Desktop */
@media (min-width: 90rem) {
  /* 1440px */
}
```

### 3. Spacing Scale (rem-based)

```typescript
spacing: {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
}
```

### 4. Typography Scale (rem-based)

```typescript
fontSize: {
  xs: '0.75rem',      // 12px
  sm: '0.875rem',     // 14px
  base: '1rem',       // 16px
  lg: '1.125rem',     // 18px
  xl: '1.25rem',      // 20px
  '2xl': '1.5rem',    // 24px
  '3xl': '1.875rem',  // 30px
  '4xl': '2.25rem',   // 36px
}
```

### 5. Width Guidelines

- **Fixed widths**: Use `rem` with `max-width` for constraints
- **Fluid widths**: Use `%`, `fr`, `auto`, `fit-content`
- **Container max-widths**:
  - Small: `40rem` (640px)
  - Medium: `48rem` (768px)
  - Large: `64rem` (1024px)
  - XLarge: `80rem` (1280px)

### 6. Component Sizing

```typescript
// Button, Input, Select heights
sizes: {
  sm: '2rem',      // 32px
  md: '2.5rem',    // 40px
  lg: '3rem',      // 48px
  xl: '3.5rem',    // 56px
}
```

### 7. Grid & Flexbox

```css
/* Prefer Grid for layouts */
.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 1rem;
}

/* Flexbox for components */
.flex-container {
  display: flex;
  gap: 1rem; /* Use gap instead of margin */
}
```

### 8. Mobile-First Approach

```css
/* ✅ CORRECT - Mobile First */
.element {
  width: 100%;
  padding: 1rem;
}

@media (min-width: 48rem) {
  .element {
    width: 50%;
    padding: 1.5rem;
  }
}

/* ❌ WRONG - Desktop First */
.element {
  width: 50%;
  padding: 1.5rem;
}

@media (max-width: 48rem) {
  .element {
    width: 100%;
    padding: 1rem;
  }
}
```

### 9. Image & Media

```css
img,
video {
  max-width: 100%;
  height: auto;
}
```

### 10. Touch Targets

- Minimum: `2.75rem` (44px) - iOS guideline
- Recommended: `3rem` (48px) - Material Design

## 📋 Checklist for Every Component

- [ ] No `px` values (except borders)
- [ ] Uses `rem` for spacing and sizing
- [ ] Mobile-first media queries
- [ ] Tested on mobile (320px), tablet (768px), desktop (1024px+)
- [ ] Touch targets ≥ 44px
- [ ] Text readable at all sizes
- [ ] No horizontal scroll
- [ ] Flexible containers (`%`, `fr`, `auto`)

## 🎯 Common Patterns

### Card Grid

```typescript
const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 1rem;

  @media (min-width: 48rem) {
    gap: 1.5rem;
  }
`;
```

### Responsive Container

```typescript
const Container = styled.div`
  width: 100%;
  max-width: 80rem;
  margin: 0 auto;
  padding: 1rem;

  @media (min-width: 48rem) {
    padding: 1.5rem;
  }
`;
```

### Responsive Stack

```typescript
const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @media (min-width: 48rem) {
    flex-direction: row;
    gap: 1.5rem;
  }
`;
```

## 🚫 Anti-Patterns to Avoid

1. ❌ `width: 220px` → ✅ `width: 13.75rem` or `min-width: 15rem`
2. ❌ `padding: 16px` → ✅ `padding: 1rem`
3. ❌ `@media (max-width: 768px)` → ✅ `@media (min-width: 48rem)`
4. ❌ `margin-right: 8px` → ✅ `gap: 0.5rem`
5. ❌ Fixed widths without `max-width` → ✅ `width: 100%; max-width: 20rem`
