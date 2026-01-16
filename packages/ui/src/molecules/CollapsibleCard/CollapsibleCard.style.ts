import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  border: 1px solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  overflow: hidden;
  background: ${tkn('colors.background.secondary')};
  transition: box-shadow ${tkn('transitions.normal')}, transform ${tkn('transitions.normal')};

  &:hover {
    box-shadow: ${tkn('shadows.md')};
  }
`;

export const Header = styled.button`
  width: 100%;
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  background: ${tkn('colors.background.primary')};
  border-bottom: 1px solid ${tkn('colors.border.primary')};
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all ${tkn('transitions.normal')};

  &:hover {
    background: ${tkn('colors.background.tertiary')};
  }
  
  &:active {
    opacity: 0.8;
  }
`;

export const HeaderLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
`;

export const ChevronWrapper = styled.div<{ $rotated: boolean }>`
  transform: ${({ $rotated }) => ($rotated ? 'rotate(90deg)' : 'rotate(0deg)')};
  transition: transform ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${tkn('colors.text.tertiary')};
`;

/**
 * Modern height transition using CSS Grid fr rows
 */
export const ContentGrid = styled.div<{ $isExpanded: boolean }>`
  display: grid;
  grid-template-rows: ${({ $isExpanded }) => ($isExpanded ? '1fr' : '0fr')};
  transition: grid-template-rows ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1), 
              opacity ${tkn('transitions.normal')};
  opacity: ${({ $isExpanded }) => ($isExpanded ? 1 : 0)};
`;

export const ContentInner = styled.div`
  min-height: 0;
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;
