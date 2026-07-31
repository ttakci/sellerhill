import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const ErrorStateWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: ${tkn('spacing.xl')} ${tkn('spacing.md')};
  gap: ${tkn('spacing.md')};
`;

export const ErrorIconCircle = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: ${tkn('radius.full')};
  background-color: ${tkn('colors.semanticTint.error')};
  color: ${tkn('colors.semantic.error')};

  svg {
    width: 2.25rem;
    height: 2.25rem;
  }
`;

export const Title = styled.div`
  margin: 0;
  font-size: ${tkn('typography.fontSize.lg')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  line-height: ${tkn('typography.lineHeight.normal')};
`;

export const Description = styled.div`
  margin: 0;
  font-size: ${tkn('typography.fontSize.base')};
  font-weight: ${tkn('typography.fontWeight.normal')};
  color: ${tkn('colors.text.secondary')};
  line-height: ${tkn('typography.lineHeight.relaxed')};
  max-width: 28rem;
`;

export const ActionsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.sm')};
  margin-top: ${tkn('spacing.xs')};
`;
