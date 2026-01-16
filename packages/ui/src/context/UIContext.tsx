import React, { createContext, useCallback, useMemo, useState } from 'react';

import type {
    LoadingState,
    MessageState,
    ShowLoadingOptions,
    ShowMessageOptions,
    UIContextValue,
} from './UIContext.types';

/**
 * UI Context for global UI state management
 * Manages: GeneralMessage, GeneralLoading
 * Platform-agnostic: Web & Mobile compatible
 */
export const UIContext = createContext<UIContextValue | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messageState, setMessageState] = useState<MessageState>({
    isOpen: false,
    type: 'info',
    header: '',
    description: '',
  });

  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
  });

  const showMessage = useCallback(
    (options: ShowMessageOptions, t: (key: string, params?: Record<string, string | number>) => string) => {
      setMessageState({
        isOpen: true,
        type: options.type,
        header: t(options.headerKey),
        description: t(options.descriptionKey, options.descriptionParams),
        primaryButton: options.primaryButton
          ? {
              label: t(options.primaryButton.labelKey),
              onClick: options.primaryButton.onClick,
              variant: options.primaryButton.variant,
            }
          : undefined,
        secondaryButton: options.secondaryButton
          ? {
              label: t(options.secondaryButton.labelKey),
              onClick: options.secondaryButton.onClick,
              variant: options.secondaryButton.variant,
            }
          : undefined,
      });
    },
    []
  );

  const closeMessage = useCallback(() => {
    setMessageState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const showLoading = useCallback((options?: ShowLoadingOptions) => {
    setLoadingState({
      isLoading: true,
      size: options?.size || 'md',
      overlay: options?.overlay ?? true,
    });
  }, []);

  const hideLoading = useCallback(() => {
    setLoadingState({
      isLoading: false,
    });
  }, []);

  const value = useMemo(
    () => ({
      messageState,
      loadingState,
      showMessage,
      closeMessage,
      showLoading,
      hideLoading,
    }),
    [messageState, loadingState, showMessage, closeMessage, showLoading, hideLoading]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};
