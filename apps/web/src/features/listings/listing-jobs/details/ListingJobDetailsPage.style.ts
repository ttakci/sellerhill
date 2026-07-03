import styled from '@emotion/styled';
import { Badge as UIBadge, Text as UIText, tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  max-width: 90rem; /* 1440px */
  margin: 0 auto;
  display: flex;
  flex-direction: column;
`;

export const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
  margin-bottom: ${tkn('spacing.lg')};
`;

export const HeaderRowTitle = styled.div`
  margin-bottom: ${tkn('spacing.xl')};
`;


export const AsinText = styled(UIText)``;

export const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  max-width: 25rem; /* 400px */
`;

export const ErrorText = styled.div`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.semantic.error')};
  font-weight: ${tkn('typography.fontWeight.medium')};
`;

export const ExceptionBadge = styled.div`
  font-size: ${tkn('typography.fontSize.2xs')};
  font-family: ui-monospace, monospace;
  background: ${tkn('colors.background.tertiary')};
  color: ${tkn('colors.semantic.error')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.sm')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 6.25rem; /* 100px */
  overflow-y: auto;
`;

export const JobIdBadge = styled(UIBadge)``;
