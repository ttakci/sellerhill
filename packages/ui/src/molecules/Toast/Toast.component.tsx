import React, { useCallback, useEffect } from 'react';

import { Icon } from '../../atoms/Icon';
import * as S from './Toast.style';
import type { ToastProps } from './Toast.types';

const toastIcons: Record<string, string> = {
  success: 'check-circle',
  error: 'x-circle',
  warning: 'alert-triangle',
  info: 'info',
};

export const Toast = ({ toast, onClose }: ToastProps): React.ReactElement => {
  const handleClose = useCallback(() => {
    onClose(toast.id);
  }, [onClose, toast.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 4000);

    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  return (
    <S.ToastContainer $type={toast.type}>
      <S.ToastIconWrapper $type={toast.type}>
        <Icon name={toastIcons[toast.type] as any} size="sm" />
      </S.ToastIconWrapper>
      <S.ToastMessage>{toast.message}</S.ToastMessage>
      <S.ToastCloseButton onClick={handleClose}>
        <Icon name="x" size="sm" />
      </S.ToastCloseButton>
    </S.ToastContainer>
  );
};

Toast.displayName = 'Toast';
