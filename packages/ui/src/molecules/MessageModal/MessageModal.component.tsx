import React from 'react';

import { Button } from '../../atoms/Button';
import { Icon, type IconName } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';
import type { MessageType } from '../../context';

import * as S from './MessageModal.style';
import type { MessageModalProps } from './MessageModal.types';

const messageIcons: Record<MessageType, IconName> = {
  success: 'info',
  error: 'error',
  warning: 'alert-circle',
  info: 'info',
};

const messageIconColors: Record<MessageType, string> = {
  success: 'semantic.success',
  error: 'semantic.error',
  warning: 'semantic.warning',
  info: 'semantic.info',
};

export const MessageModal: React.FC<MessageModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  description,
  primaryButton,
  secondaryButton,
}) => {
  const iconName = messageIcons[type];
  const iconColor = messageIconColors[type];

  return (
    <S.PopupModal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="sm"
      showCloseButton={false}
      showDivider={false}
    >
      <S.Content>
        <S.IconCircle $type={type}>
          <Icon name={iconName} size={32} color={iconColor} />
        </S.IconCircle>
        <Text variant="h3" weight="semibold">
          {title}
        </Text>
        <Text variant="body-sm" color="text.secondary">
          {description}
        </Text>
        <S.ButtonStack>
          <Button
            variant={primaryButton.variant || (type === 'error' ? 'danger' : 'primary')}
            fullWidth
            onClick={() => {
              primaryButton.onClick();
              onClose();
            }}
          >
            <Text>{primaryButton.label}</Text>
          </Button>
          {secondaryButton && (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                secondaryButton.onClick();
                onClose();
              }}
            >
              <Text>{secondaryButton.label}</Text>
            </Button>
          )}
        </S.ButtonStack>
      </S.Content>
    </S.PopupModal>
  );
};

MessageModal.displayName = 'MessageModal';
