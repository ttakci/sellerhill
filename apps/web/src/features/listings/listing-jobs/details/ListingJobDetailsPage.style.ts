import styled from '@emotion/styled';
import { Badge as UIBadge, Button, Text as UIText, tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  max-width: 90rem; /* 1440px */
  margin: 0 auto;
  display: flex;
  flex-direction: column;
`;

export const BackButton = styled(Button)`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem; /* 8px */
  margin-bottom: 0.5rem; /* 8px */
`;

export const RefreshButton = styled(Button)`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem; /* 8px */
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
