import styled from '@emotion/styled';
import { Button, IconButton, tkn } from '@repo/ui';

export const LauncherCard = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.sm')};
  background: ${tkn('colors.sidebar.active')};
  border: 0.0625rem solid ${tkn('colors.sidebar.divider')};
  box-sizing: border-box;
`;

export const LauncherButtonAnchor = styled.div`
  position: relative;
`;

/**
 * Color override, not layout-only — a deliberate exception to the usual
 * "extend an atom for layout only" rule. `Button`'s variants (`primary`,
 * `secondary`, …) are tuned for the app's own light/dark THEME surfaces
 * (`brand.primary`, `surface.primary`); this card sits on the sidebar's
 * separate, theme-invariant dark surface. `primary`'s fill is the exact hex
 * of `colors.sidebar.accent` — the SELECTED nav-item color — so it read as
 * if this card were an active menu item. `secondary`'s light fill then
 * rendered a stark white block against the navy card. Pulling the button
 * into the sidebar's own token family (`sidebar.text`/`sidebar.divider`)
 * fixes both: it stays legible on the dark card without borrowing either
 * the app theme's or the nav's own colors.
 */
export const LauncherButton = styled(Button)`
  background: transparent;
  /* sidebar.textMuted, not sidebar.divider — divider's ~8% alpha is tuned for
     a hairline separator, not a button's own outline; it read as barely
     there against the card. */
  border: 0.0625rem solid ${tkn('colors.sidebar.textMuted')};
  color: ${tkn('colors.sidebar.text')};
  box-shadow: none;

  &:hover:not(:disabled) {
    background: ${tkn('colors.sidebar.hover')};
    border-color: ${tkn('colors.sidebar.text')};
    /* The secondary variant's own hover rule sets color: brand.primaryHover
       (blue) at the same specificity — restate white here or the icon/label
       flip blue on hover even though the base override above already fixed
       the rest state. */
    color: ${tkn('colors.sidebar.text')};
    box-shadow: none;
    filter: brightness(1.15);
  }

  &:active:not(:disabled) {
    color: ${tkn('colors.sidebar.text')};
    filter: brightness(0.95);
    box-shadow: none;
  }
`;

export const CollapsedLauncher = styled(IconButton)`
  position: relative;
`;

/**
 * `Tooltip`'s wrapper div becomes the actual flex item inside the sidebar
 * footer (column flex, default `align-items: stretch`) once the launcher is
 * wrapped in it — this anchor carries the centering the launcher itself used
 * to own directly, so wrapping it in a tooltip doesn't left-align it.
 */
export const CollapsedLauncherAnchor = styled.div`
  align-self: center;
`;

export const UnreadBadge = styled.span`
  position: absolute;
  top: 0;
  right: 0;
  min-width: ${tkn('spacing.md')};
  height: ${tkn('spacing.md')};
  padding: 0 ${tkn('spacing.2xs')};
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.semantic.error')};
  color: ${tkn('colors.text.inverse')};
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  transform: translate(35%, -35%);
`;
