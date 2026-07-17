import styled from '@emotion/styled';
import { Text, tkn } from '@repo/ui';

export const Inner = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

export const IconWrapper = styled.div`
  width: 4.5rem;
  height: 4.5rem;
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.semanticTint.info')};
  color: ${tkn('colors.brand.primary')};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: ${tkn('spacing.lg')};
`;

export const Description = styled(Text)`
  margin: ${tkn('spacing.sm')} 0 ${tkn('spacing.lg')} 0;
  max-width: 26rem;
`;

export const ActionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  width: 100%;
  max-width: 20rem;
`;

export const Note = styled(Text)`
  margin-top: ${tkn('spacing.lg')};
  max-width: 20rem;
`;
