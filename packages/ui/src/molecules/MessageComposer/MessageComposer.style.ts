import { Theme } from '@emotion/react';
import styled from '@emotion/styled';

import { controlFocusShadow, type ControlSize } from '../../styles/formControl';
import { tkn } from '../../theme/tkn';

import type { MessageComposerSize } from './MessageComposer.types';

interface ComposerShellProps {
  $size: ControlSize;
  $fullWidth: boolean;
  $isDisabled: boolean;
}

const sizeToControl = (size: MessageComposerSize): ControlSize => size;

/**
 * Outer shell — wraps the textarea + action row. Uses the same surface /
 * border / focus treatment as TextInput / SearchField so the composer reads
 * as one control, not a textarea + button cluster.
 */
export const ComposerShell = styled.div<ComposerShellProps>`
  display: flex;
  flex-direction: column;
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  background-color: ${({ theme, $isDisabled }) =>
    $isDisabled ? theme.colors.background.tertiary : theme.colors.surface.primary};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.md')};
  transition:
    border-color ${tkn('transitions.fast')},
    box-shadow ${tkn('transitions.fast')};
  cursor: ${({ $isDisabled }) => ($isDisabled ? 'not-allowed' : 'text')};

  &:hover {
    border-color: ${({ $isDisabled, theme }) =>
      !$isDisabled ? theme.colors.text.tertiary : undefined};
  }

  &:focus-within {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: ${({ theme }) => controlFocusShadow(theme.colors.brand.primary)};
  }
`;

const textareaPaddingAndSize = (size: ControlSize, theme: Theme): string => {
  const t = (path: Parameters<typeof tkn>[0]) => tkn(path)({ theme });
  const vertical = size === 'small' ? t('spacing.xs') : size === 'large' ? t('spacing.sm-md+') : t('spacing.sm');
  const horizontal = size === 'small' ? t('spacing.sm') : t('spacing.md');
  const minHeight = size === 'small' ? '2.5rem' : size === 'large' ? '4.5rem' : '3.5rem';
  const fontSize = size === 'small' ? t('typography.fontSize.sm') : t('typography.fontSize.md');
  return `
    min-height: ${minHeight};
    padding: ${vertical} ${horizontal};
    font-size: ${fontSize};
  `;
};

export const ComposerTextarea = styled.textarea<{ $size: MessageComposerSize }>`
  width: 100%;
  box-sizing: border-box;
  border: none;
  outline: none;
  background: transparent;
  resize: vertical;
  line-height: ${tkn('typography.lineHeight.normal')};
  color: ${tkn('colors.text.primary')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-weight: ${tkn('typography.fontWeight.normal')};

  ${({ $size, theme }) => textareaPaddingAndSize(sizeToControl($size), theme)}

  &::placeholder {
    color: ${tkn('colors.text.tertiary')};
  }

  &:disabled {
    cursor: not-allowed;
    color: ${tkn('colors.text.disabled')};
  }
`;

export const ActionRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')} ${tkn('spacing.sm')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const CounterSlot = styled.span`
  margin-right: auto;
  color: ${tkn('colors.text.tertiary')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-variant-numeric: tabular-nums;
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
`;

export const CounterOver = styled.span`
  color: ${tkn('colors.semantic.error')};
  font-weight: ${tkn('typography.fontWeight.medium')};
`;
