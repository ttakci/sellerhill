import React from 'react';

import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';
import { Modal } from '../../atoms/Modal';
import { Text } from '../../atoms/Text';
import type { MessageType } from '../../context';

import * as S from './MessageModal.style';
import type { MessageModalProps } from './MessageModal.types';

const messageIcons: Record<MessageType, string> = {
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="sm"
      showCloseButton={false}
      showDivider={false}
      footer={
        <S.FooterWrapper>
          {secondaryButton && (
            <Button
              variant="secondary"
              onClick={() => {
                secondaryButton.onClick();
                onClose();
              }}
            >
              {secondaryButton.label}
            </Button>
          )}
          <Button
            variant={primaryButton.variant || (type === 'error' ? 'danger' : 'primary')}
            onClick={() => {
              primaryButton.onClick();
              onClose();
            }}
          >
            {primaryButton.label}
          </Button>
        </S.FooterWrapper>
      }
    >
      <S.ContentWrapper>
        <S.IconWrapper>
          <Icon name={iconName as any} size={48} color={iconColor} />
        </S.IconWrapper>
        <S.TitleWrapper>
          <Text variant="h3" weight="bold">
            {title}
          </Text>
        </S.TitleWrapper>
        <Text variant="body" color="text.secondary">
          {description}
        </Text>
      </S.ContentWrapper>
    </Modal>
  );
};

MessageModal.displayName = 'MessageModal';
