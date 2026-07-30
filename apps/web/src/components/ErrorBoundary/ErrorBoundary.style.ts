import styled from '@emotion/styled';
import { Card, Text, tkn } from '@repo/ui';

/**
 * Centred failure screen. It used to be an emoji glyph over a stack of
 * margin-spaced wrappers — the only screen in the app that did not use the
 * shared EmptyState/Card language, so a crash looked like a different product.
 */
export const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: ${tkn('spacing.lg')};
  background: ${tkn('colors.background.primary')};
  box-sizing: border-box;
`;

export const Panel = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  width: 100%;
  max-width: 34rem;
`;

/** Dev-only stack trace. Never rendered in production builds. */
export const Details = styled.details`
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  padding-top: ${tkn('spacing.md')};
`;

export const Summary = styled.summary`
  cursor: pointer;
  color: ${tkn('colors.text.secondary')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  transition: color ${tkn('transitions.fast')};

  &:hover {
    color: ${tkn('colors.text.primary')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
    border-radius: ${tkn('radius.sm')};
  }
`;

export const ErrorStack = styled(Text)`
  display: block;
  margin-top: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm-md')};
  background: ${tkn('colors.semanticTint.error')};
  border: 0.0625rem solid ${tkn('colors.semanticTintBorder.error')};
  border-radius: ${tkn('radius.md')};
  max-height: 18rem;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
`;
