import React from 'react';

import { Button, type ButtonVariant } from '../../atoms/Button';
import { Icon, type IconName } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';
import type { MessageType } from '../../context';

import * as S from './Dialog.style';
import type { DialogProps } from './Dialog.types';

const defaultIcons: Record<MessageType, IconName> = {
  success: 'check-circle',
  error: 'error',
  warning: 'alert-triangle',
  info: 'info',
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
 * Layout: solid icon disc + title + description; secondary (outline) above primary (filled).
 * All system popups (MessageModal / ConfirmModal / feature Dialogs) share this molecule.
 */
export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  type = 'info',
  title,
  description,
  children,
  icon,
  primaryAction,
  secondaryAction,
  showCloseButton = false,
}) => {
  const iconName = icon ?? defaultIcons[type];
  const primaryVariant = resolveFilledVariant(primaryAction.variant);
  const secondaryVariant = resolveOutlineVariant(secondaryAction?.variant);

  return (
    <S.Shell isOpen={isOpen} onClose={onClose} title="" size="md" showCloseButton={showCloseButton} showDivider={false}>
      <S.Content>
        <S.IconCircle $type={type}>
          <Icon name={iconName} size={24} color="text.inverse" />
        </S.IconCircle>

        <S.Title variant="h1" weight="semibold" color="brand.primary">
          {title}
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
