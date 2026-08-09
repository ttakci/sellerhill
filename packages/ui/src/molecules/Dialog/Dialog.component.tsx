import React from 'react';

import { Button, type ButtonVariant } from '../../atoms/Button';
import { Icon, type IconName } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';
import type { MessageType } from '../../context';

import * as S from './Dialog.style';
import type { DialogProps } from './Dialog.types';

/**
 * Error uses the same triangle-and-exclamation glyph as `ValidationMessage`, so
 * a failure looks the same whether it surfaces under a field or in a dialog. A
 * crossed circle reads as "closed / cancelled", not "something went wrong".
 */
const iconsByType: Record<MessageType, IconName> = {
  success: 'check-circle',
  error: 'triangle-info',
  warning: 'alert-triangle',
  info: 'info',
};

/** English fallbacks when no localized `typeTitles` / `title` are provided */
export const DEFAULT_DIALOG_TYPE_TITLES: Record<MessageType, string> = {
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
};

/**
 * Dialog actions always use brand blue: filled primary + outline secondary.
 * Never red danger buttons — icon disc may still use semantic type color.
 */
const resolveFilledVariant = (variant?: ButtonVariant): ButtonVariant => {
  if (variant === 'secondary' || variant === 'tertiary' || variant === 'text') {
    return variant;
  }
  // primary | danger | undefined → solid brand primary
  return 'primary';
};

const resolveOutlineVariant = (variant?: ButtonVariant): ButtonVariant => {
  if (variant === 'primary' || variant === 'danger') {
    return 'secondary';
  }
  return variant ?? 'secondary';
};

/**
 * Canonical app dialog — single visual system for alerts, confirms, and form prompts.
 * Layout: solid icon disc + **type title** (Uyarı / Bilgi / …) + description;
 * secondary (outline) above primary (filled).
 * All system popups (MessageModal / ConfirmModal / feature Dialogs) share this molecule.
 */
export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  type = 'info',
  title,
  typeTitles,
  description,
  children,
  primaryAction,
  secondaryAction,
  showCloseButton = false,
}) => {
  const primaryVariant = resolveFilledVariant(primaryAction.variant);
  const secondaryVariant = resolveOutlineVariant(secondaryAction?.variant);
  // Prefer explicit title (form dialogs); else localized type title; else English default
  const displayTitle =
    title?.trim() ||
    typeTitles?.[type] ||
    DEFAULT_DIALOG_TYPE_TITLES[type];

  return (
    <S.Shell isOpen={isOpen} onClose={onClose} title="" size="md" showCloseButton={showCloseButton} showDivider={false}>
      <S.Content>
        <S.IconCircle $type={type}>
          <Icon name={iconsByType[type]} size={24} color="text.inverse" />
        </S.IconCircle>

        <S.Title variant="h1" weight="semibold" color="brand.primary">
          {displayTitle}
        </S.Title>

        {description ? (
          <S.Description>
            {typeof description === 'string' ? (
              <Text variant="body" color="text.secondary">
                {description}
              </Text>
            ) : (
              description
            )}
          </S.Description>
        ) : null}

        {children ? <S.BodySlot>{children}</S.BodySlot> : null}

        <S.ButtonStack>
          {/* Outline first (matches reference: secondary on top, primary filled below) */}
          {secondaryAction ? (
            <Button
              variant={secondaryVariant}
              size="medium"
              fullWidth
              isLoading={secondaryAction.isLoading}
              disabled={secondaryAction.disabled || secondaryAction.isLoading || primaryAction.isLoading}
              onClick={secondaryAction.onClick}
            >
              <Text variant="body" weight="semibold">
                {secondaryAction.label}
              </Text>
            </Button>
          ) : null}
          <Button
            variant={primaryVariant}
            size="medium"
            fullWidth
            isLoading={primaryAction.isLoading}
            disabled={primaryAction.disabled || primaryAction.isLoading}
            onClick={primaryAction.onClick}
          >
            <Text variant="body" weight="semibold">
              {primaryAction.label}
            </Text>
          </Button>
        </S.ButtonStack>
      </S.Content>
    </S.Shell>
  );
};

Dialog.displayName = 'Dialog';
