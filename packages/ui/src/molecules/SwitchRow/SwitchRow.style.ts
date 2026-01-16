import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  background: transparent;
  gap: ${tkn('spacing.md')};
  transition: all ${tkn('transitions.normal')} ease;

  &:not(:last-child) {
    border-bottom: 1px solid ${tkn('colors.border.primary')};
  }
`;

export const TextContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;
