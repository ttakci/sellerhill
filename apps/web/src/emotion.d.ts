/**
 * Emotion `Theme` augmentation for the web app.
 *
 * `packages/ui/src/theme/emotion.d.ts` declares the same augmentation, but a
 * module augmentation only reaches the `@emotion/react` instance the declaring
 * package resolves. The lockfile carries two `@types/react` versions, so pnpm
 * installs two `@emotion/react` instances and the web app resolves the other
 * one — `Theme` then stays `{}` here, every `theme.colors.*` access in a
 * `.style.ts` is a type error, and the type-aware lint rules report them as
 * unsafe `any` access. Declaring it again from inside the app binds the
 * augmentation to the copy this app actually imports.
 */
import '@emotion/react';
import type { AppTheme } from '@repo/ui';

declare module '@emotion/react' {
  export interface Theme extends AppTheme {}
}
