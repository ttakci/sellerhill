# ESLint & Prettier Configuration

## Overview

This project uses industry-standard linting and formatting tools:

- **ESLint** - Static code analysis
- **Prettier** - Code formatting
- **Husky** - Git hooks
- **lint-staged** - Run linters on staged files

## Rules

### ESLint Rules (Strict)

#### Console & Debugging

- ❌ `no-console: error` - No console.log in commits
- ❌ `no-debugger: error` - No debugger statements
- ❌ `no-alert: error` - No alert/confirm/prompt

#### TypeScript

- ⚠️ `@typescript-eslint/no-explicit-any: warn` - Avoid any types
- ❌ `@typescript-eslint/no-unused-vars: error` - No unused variables
- ❌ `@typescript-eslint/no-floating-promises: error` - Await all promises
- ❌ `@typescript-eslint/no-misused-promises: error` - Promise type safety

#### Code Quality

- ❌ `no-var: error` - Use let/const instead of var
- ❌ `prefer-const: error` - Use const when possible
- ❌ `eqeqeq: error` - Always use === instead of ==
- ❌ `curly: error` - Always use curly braces

#### React (TSX files only)

- ❌ `react-hooks/rules-of-hooks: error` - Follow Hooks rules
- ⚠️ `react-hooks/exhaustive-deps: warn` - Complete dependency arrays

#### Import Organization

- Automatically sorts and groups imports

## Usage

### Development

```bash
# Run linter
pnpm lint

# Fix auto-fixable issues
pnpm lint:fix

# Format code
pnpm format

# Type check
pnpm typecheck
```

### Pre-commit Hook

Husky automatically runs on `git commit`:

1. ✅ Runs ESLint on staged `.ts` and `.tsx` files
2. ✅ Runs Prettier on all staged files
3. ❌ Prevents commit if errors found

**Example:**

```bash
git add .
git commit -m "Add feature"

# Husky runs:
# → ESLint fixes auto-fixable issues
# → Prettier formats code
# → If errors remain, commit is blocked
```

### Bypassing Hooks (Emergency Only)

```bash
# Not recommended!
git commit --no-verify -m "Emergency fix"
```

## Configuration Files

- `.eslintrc.json` - ESLint rules
- `.prettierrc.json` - Prettier config
- `.lintstagedrc.json` - Lint-staged config
- `.husky/pre-commit` - Pre-commit hook

## Exceptions

Config files can use console.log:

- `*.config.js`
- `*.config.ts`
- `*.config.mjs`

## Common Issues

### Issue: ESLint errors on commit

**Solution:**

```bash
pnpm lint:fix
git add .
git commit -m "Your message"
```

### Issue: console.log blocked

**Solution:**
Remove console.log or use logger service (API only)

```typescript
// ❌ Bad
console.log('Hello');

// ✅ Good (development debugging)
if (process.env.NODE_ENV === 'development') {
  // Remove before commit
}

// ✅ Good (API only)
this.logger.info('Hello');
```

### Issue: Import order errors

**Solution:**

```bash
pnpm lint:fix
```

ESLint will automatically reorganize imports.

## CI/CD Integration

Add to GitHub Actions:

```yaml
- name: Lint
  run: pnpm lint

- name: Type Check
  run: pnpm typecheck
```
