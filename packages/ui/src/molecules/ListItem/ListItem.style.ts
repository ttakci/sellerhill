import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const ListItemContainer = styled.div<{ $clickable: boolean; $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  transition: background ${tkn('transitions.fast')};

  ${(props) => {
    if (props.$selected) {
      return `background: ${tkn('colors.brand.secondary')(props)};`;
    }
    return '';
  }}

  ${(props) =>
    props.$clickable
      ? `
    cursor: pointer;
    &:hover {
      background: ${tkn('colors.surface.secondary')(props)};
    }
  `
      : ''}
`;

export const ListItemIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${tkn('colors.text.secondary')};
  flex-shrink: 0;
`;

export const ListItemContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: ${tkn('spacing.2xs')};
`;

export const ListItemTitle = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.primary')};
  line-height: ${tkn('typography.lineHeight.normal')};
`;

export const ListItemSubtitle = styled.span`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.secondary')};
  line-height: ${tkn('typography.lineHeight.normal')};
`;

export const ListItemAction = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
`;
