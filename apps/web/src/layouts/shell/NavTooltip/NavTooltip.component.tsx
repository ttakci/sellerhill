import { Tooltip } from '@repo/ui';
import type React from 'react';

import type { NavTooltipProps } from './NavTooltip.types';

/**
 * A collapsed sidebar row shows only an icon, so its label needs a hover
 * tooltip. An expanded row already shows the label as text — wrapping it in
 * `Tooltip` too would both repeat it on hover AND break the row's full-width
 * layout (Tooltip's flex wrapper doesn't stretch its child like the sidebar's
 * own column-flex did), so it renders unwrapped.
 */
export const NavTooltip = ({ label, collapsed, children }: NavTooltipProps): React.ReactElement =>
  collapsed ? (
    <Tooltip content={label} position="right">
      {children}
    </Tooltip>
  ) : (
    children
  );

NavTooltip.displayName = 'NavTooltip';
