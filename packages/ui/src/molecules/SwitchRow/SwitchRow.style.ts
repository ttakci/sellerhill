import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${tkn('spacing.sm')};
  background: ${tkn('colors.background.secondary')};
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.md')};
  gap: ${tkn('spacing.md')};
`;

export const TextContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;
