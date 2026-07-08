import type React from 'react';

import { Icon, type IconName } from '../../atoms/Icon';

import * as S from './Toast.style';
import type { ToastComponentProps } from './Toast.types';

const toastIcons: Record<string, IconName> = {
  success: 'check-circle',
  error: 'x-circle',
  warning: 'alert-triangle',
  info: 'info',
};

export const ToastComponent = ({ toast, onClose }: ToastComponentProps): React.ReactElement => {
  return (
    <S.ToastContainer $type={toast.type}>
      <S.ToastIconWrapper $type={toast.type}>
        <Icon name={toastIcons[toast.type]} size="sm" />
      </S.ToastIconWrapper>
      <S.ToastMessage>{toast.message}</S.ToastMessage>
      <S.ToastCloseButton onClick={onClose}>
        <Icon name="x" size="sm" />
      </S.ToastCloseButton>
    </S.ToastContainer>
  );
};

ToastComponent.displayName = 'ToastComponent';
