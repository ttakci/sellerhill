import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { Toast as ToastComponent, ToastListContainer } from '../molecules/Toast';
import type { ToastItem, ToastType } from '../molecules/Toast';

export interface ToastContextValue {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
  };
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastCounter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `toast-${++toastCounter}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const value = useMemo(
    () => ({
      toast: {
        success: (message: string) => addToast('success', message),
        error: (message: string) => addToast('error', message),
        warning: (message: string) => addToast('warning', message),
        info: (message: string) => addToast('info', message),
      },
    }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <ToastListContainer>
          {toasts.map((t) => (
            <ToastComponent key={t.id} toast={t} onClose={removeToast} />
          ))}
        </ToastListContainer>
      )}
    </ToastContext.Provider>
  );
};

export const useToastContext = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
};
