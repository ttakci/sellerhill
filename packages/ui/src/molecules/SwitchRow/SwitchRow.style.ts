import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0; /* 12px */
  background: transparent;
  gap: ${tkn('spacing.md')};
  transition: all ${tkn('transitions.normal')} ease;

  &:not(:last-child) {
    border-bottom: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  }
`;

export const TextContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem; /* 2px */
`;
