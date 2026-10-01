import type { AppTheme } from '../theme/theme.types';

/**
 * The frosted-glass pane (2026-10-01).
 *
 * ONE definition for every card-tier surface — Card, SettingsCard, the table
 * container, the detached pagination bar, the order card — so the whole app
 * reads as panes of the same glass over one lit canvas. A surface that must
 * stay opaque (an input, a menu, a drawer, a modal) does not use this.
 *
 * `backdrop-filter` is what makes the aurora behind a pane show through as a
 * soft wash of colour; without it a translucent white is just a dimmer white.
 * The blur also establishes a containing block, so a `position: fixed` child
 * inside a pane would stick to the pane — none of the panes above hold one.
 */
export const glassSurface = (theme: AppTheme): string => `
  background: ${theme.colors.glass.sheen}, ${theme.colors.glass.surface};
  -webkit-backdrop-filter: blur(1.5rem) saturate(1.5);
  backdrop-filter: blur(1.5rem) saturate(1.5);
  border: 0.0625rem solid ${theme.colors.glass.edge};
  box-shadow: ${theme.shadows.glass};
`;

/** A pane on a pane — a touch more opaque so the layers still read as two. */
export const glassSurfaceStrong = (theme: AppTheme): string => `
  background: ${theme.colors.glass.sheen}, ${theme.colors.glass.surfaceStrong};
  -webkit-backdrop-filter: blur(1.5rem) saturate(1.5);
  backdrop-filter: blur(1.5rem) saturate(1.5);
  border: 0.0625rem solid ${theme.colors.glass.edge};
  box-shadow: ${theme.shadows.glass};
`;
