import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const CollapsibleContainer = styled.div`
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  overflow: hidden;
  background: ${tkn('colors.surface.primary')};
`;

export const CollapsibleHeader = styled.button<{ $isOpen: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: ${tkn('spacing.md')};
  background: none;
  border: none;
  cursor: pointer;
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  text-align: left;
  gap: ${tkn('spacing.sm')};

  &:hover {
    background: ${tkn('colors.surface.secondary')};
  }

  .collapsible-chevron {
    transition: transform ${tkn('transitions.fast')};
    transform: rotate(${(props) => (props.$isOpen ? '180deg' : '0deg')});
    color: ${tkn('colors.text.tertiary')};
    flex-shrink: 0;
  }
`;

export const CollapsibleContent = styled.div<{ $isOpen: boolean; $maxHeight: number | null }>`
  overflow: hidden;
  transition: max-height ${tkn('transitions.normal')}, padding ${tkn('transitions.normal')};
  ${(props) =>
    props.$isOpen
      ? `max-height: ${props.$maxHeight ?? 2000}px; padding: 0 ${tkn('spacing.md')(props)} ${tkn('spacing.md')(props)};`
      : 'max-height: 0; padding: 0;'}
`;
