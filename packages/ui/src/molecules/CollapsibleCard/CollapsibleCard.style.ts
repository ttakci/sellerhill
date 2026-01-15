import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.md')};
  overflow: hidden;
`;

export const Header = styled.button`
  width: 100%;
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  background: ${tkn('colors.background.primary')};
  border: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.background.secondary')};
  }
`;

export const HeaderLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.primary')};
`;

export const ChevronWrapper = styled.div<{ $rotated: boolean }>`
  transform: ${({ $rotated }) => ($rotated ? 'rotate(90deg)' : 'rotate(0deg)')};
  transition: transform ${tkn('transitions.fast')};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const Content = styled.div`
  padding: ${tkn('spacing.lg')};
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;
