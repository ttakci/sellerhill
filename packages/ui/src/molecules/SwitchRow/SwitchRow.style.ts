import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  background: ${tkn('colors.background.secondary')};
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.lg')};
  gap: ${tkn('spacing.md')};
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    border-color: ${tkn('colors.border.primary')};
    background: ${tkn('colors.background.primary')};
    box-shadow: ${tkn('shadows.sm')};
    transform: translateY(-1px);
  }
`;

export const TextContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;
