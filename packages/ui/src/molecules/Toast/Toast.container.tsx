import { useCallback, useEffect } from 'react';

import { ToastComponent } from './Toast.component';
import type { ToastProps } from './Toast.types';

export const Toast = ({ toast, onClose }: ToastProps) => {
  const handleClose = useCallback(() => {
    onClose(toast.id);
  }, [onClose, toast.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 4000);

    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  return <ToastComponent toast={toast} onClose={handleClose} />;
};

Toast.displayName = 'Toast';
