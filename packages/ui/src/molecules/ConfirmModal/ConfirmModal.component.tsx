import React from 'react';

import { Button } from '../../atoms/Button';
import { Modal } from '../../atoms/Modal';
import { Text } from '../../atoms/Text';

import * as S from './ConfirmModal.style';
import type { ConfirmModalProps } from './ConfirmModal.types';

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'primary',
  isLoading = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <S.FooterWrapper>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </S.FooterWrapper>
      }
    >
      <Text variant="body">{description}</Text>
    </Modal>
  );
};
