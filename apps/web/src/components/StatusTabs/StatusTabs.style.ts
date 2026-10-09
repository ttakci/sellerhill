import styled from '@emotion/styled';
import { TabNav, tkn, type AppTheme } from '@repo/ui';

import type { StatusTabColor } from './StatusTabs.types';

const selectedTabColor = (theme: AppTheme, position: number, color: StatusTabColor): string => {
  const ink = String(tkn(color)({ theme }));
  const inverse = String(tkn('colors.text.inverse')({ theme }));
  const selected = `> [role='tab']:nth-of-type(${position})[aria-selected='true']`;
  return `
    ${selected},
    ${selected}:hover {
      color: ${ink};
    }
    ${selected}::after {
      background: ${ink};
    }
    ${selected} > span:last-child {
      color: ${inverse};
      background: ${ink};
    }
  `;
};

/**
 * The Orders stage rail for any status list: a plain icon before each label
 * (no disc), and only the SELECTED tab takes its colour — icon, bold label,
 * underline and a filled count pill. `$colors[i]` is the colour of the i-th
 * tab; a tab with no colour keeps TabNav's default.
 */
export const StatusTabs = styled(TabNav)<{ $colors: readonly StatusTabColor[] }>`
  > [role='tab'][aria-selected='true'] {
    font-weight: ${tkn('typography.fontWeight.bold')};
  }

  > [role='tab'][aria-selected='true'] > span:last-child {
    font-weight: ${tkn('typography.fontWeight.bold')};
    box-shadow: 0 0 0 0.0625rem ${tkn('colors.glass.edge')};
  }

  ${({ theme, $colors }) => $colors.map((color, index) => selectedTabColor(theme as AppTheme, index + 1, color)).join('')}
`;
