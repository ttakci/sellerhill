import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: ${tkn('spacing.xl')};
  background-color: ${tkn('colors.background.primary')};
`;

export const ErrorIcon = styled.div`
  font-size: ${tkn('spacing.xxxl')};
  margin-bottom: ${tkn('spacing.lg')};
`;

export const TitleWrapper = styled.div`
  margin-bottom: ${tkn('spacing.md')};
`;

export const MessageWrapper = styled.div`
  margin-bottom: ${tkn('spacing.xl')};
  max-width: 31.25rem; /* 500px */
`;

export const Details = styled.details`
  margin-top: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.md')};
  background-color: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.md')};
  max-width: 37.5rem; /* 600px */
  width: 100%;
`;

export const Summary = styled.summary`
  cursor: pointer;
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.secondary')};
  margin-bottom: ${tkn('spacing.sm')};

  &:hover {
    color: ${tkn('colors.text.primary')};
  }
`;

export const ErrorStack = styled.pre`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.semantic.error')};
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
`;

export const ButtonGroup = styled.div`
  display: flex;
  gap: ${tkn('spacing.md')};
  margin-top: ${tkn('spacing.lg')};
`;
