import styled from '@emotion/styled';
import { Text as UIText, tkn } from '@repo/ui';

/**
 * Add listings drawer — 2-step flow on soft canvas + white cards.
 * Step 2: ASIN card fills drawer body; native textarea fills remaining card area.
 */
export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  align-self: stretch;
  min-height: 0;
  width: 100%;
  height: 100%;
  gap: ${tkn('spacing.lg')};
`;

/** Keep inactive steps mounted so RHF field values are not lost on step change. */
export const StepPanel = styled.div<{ $active: boolean; $fill?: boolean }>`
  display: ${({ $active }) => ($active ? 'flex' : 'none')};
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  width: 100%;
  min-height: 0;
  ${({ $fill }) =>
    $fill
      ? `
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    align-self: stretch;
  `
      : ''}
`;

export const Card = styled.div<{ $fill?: boolean }>`
  background: ${tkn('colors.surface.primary')};
  padding: ${tkn('spacing.lg')};
  border-radius: ${tkn('radius.sm')};
  border: none;
  box-shadow: ${tkn('shadows.sm')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-sizing: border-box;
  width: 100%;
  min-height: 0;
  ${({ $fill }) =>
    $fill
      ? `
    flex: 1 1 auto;
    height: 100%;
    min-height: calc(100dvh - 12.5rem);
  `
      : ''}
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${tkn('spacing.md')};
  padding-bottom: ${tkn('spacing.md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  flex-shrink: 0;
`;

/** Soft sections inside a single white card (step 0). */
export const SectionBlock = styled.div<{ $last?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  ${({ $last, theme }) =>
    $last
      ? ''
      : `
    padding-bottom: ${tkn('spacing.lg')({ theme })};
    border-bottom: 0.0625rem solid ${theme.colors.border.secondary};
  `}
`;

export const SectionTitle = styled(UIText)`
  margin: 0;
`;

export const DraftRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
`;

export const DraftCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
  flex: 1;
`;

export const PolicyGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  width: 100%;
`;

/**
 * Grows to fill remaining card height. Absolute child textarea is pinned
 * so height always matches the white card (not the default Textarea min-height).
 */
export const AsinInputWrapper = styled.div`
  position: relative;
  flex: 1 1 auto;
  width: 100%;
  min-height: 12rem;
  display: flex;
  flex-direction: column;
`;

export const AsinCounter = styled.div`
  background: ${tkn('colors.brand.secondary')};
  color: ${tkn('colors.brand.primary')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.sm')};
  border: 0.0625rem solid ${tkn('colors.brand.primary')}30;
  flex-shrink: 0;
`;

/**
 * Native textarea (not @repo/ui Textarea wrapper) so we can reliably
 * fill the remaining card area with position:absolute inset:0.
 */
export const AsinTextarea = styled.textarea<{ $hasError?: boolean }>`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  margin: 0;
  resize: none;
  overflow-y: auto;
  padding: ${tkn('spacing.sm-md+')} 1.125rem;
  background-color: ${tkn('colors.background.secondary')};
  border: 0.0625rem solid
    ${({ theme, $hasError }) =>
      $hasError ? theme.colors.semantic.error : theme.colors.border.primary};
  border-radius: ${tkn('radius.sm')};
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.md')};
  font-family: ${tkn('typography.fontFamily.body')};
  outline: none;
  transition:
    border-color ${tkn('transitions.normal')},
    box-shadow ${tkn('transitions.normal')};

  &::placeholder {
    color: ${tkn('colors.text.tertiary')};
  }

  &:hover:not(:disabled) {
    border-color: ${tkn('colors.border.focus')};
  }

  &:focus {
    border-color: ${tkn('colors.border.focus')};
    box-shadow: 0 0 0 0.25rem ${tkn('colors.brand.primary')}15;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
    background-color: ${tkn('colors.background.tertiary')};
  }
`;

export const Label = styled(UIText)`
  display: block;
  margin-bottom: ${tkn('spacing.xs')};
`;

export const RequiredStar = styled.span`
  color: ${tkn('colors.semantic.error')};
`;

export const FieldError = styled(UIText)`
  margin-top: ${tkn('spacing.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  flex-shrink: 0;
`;
