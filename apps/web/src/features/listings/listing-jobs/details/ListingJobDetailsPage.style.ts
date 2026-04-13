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
  margin-bottom: 1.5rem; /* 24px */
`;

export const HeaderRowTitle = styled.div`
  margin-bottom: 2rem; /* 32px */
`;


export const AsinText = styled(UIText)``;

export const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem; /* 4px */
  max-width: 25rem; /* 400px */
`;

export const ErrorText = styled.div`
  font-size: 0.75rem; /* 12px */
  color: ${tkn('colors.semantic.error')};
  font-weight: 500;
`;

export const ExceptionBadge = styled.div`
  font-size: 0.625rem; /* 10px */
  font-family: ui-monospace, monospace;
  background: ${tkn('colors.background.tertiary')};
  color: ${tkn('colors.semantic.error')};
  padding: 0.25rem 0.5rem; /* 4px 8px */
  border-radius: 0.25rem; /* 4px */
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 6.25rem; /* 100px */
  overflow-y: auto;
`;

export const JobIdBadge = styled(UIBadge)``;
