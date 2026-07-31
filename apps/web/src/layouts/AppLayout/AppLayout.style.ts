/**
 * The seller shell and the operator shell are the same chrome with different
 * navigation, so the chrome lives once in `layouts/shell/AppShell.style.ts`
 * and both layouts re-export it. Anything genuinely seller-specific belongs
 * here, below the re-export.
 */
export * from '../shell/AppShell.style';
