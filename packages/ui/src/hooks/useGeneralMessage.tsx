import { useState, useCallback } from 'react';

import { GeneralMessage } from '../molecules/GeneralMessage/GeneralMessage.component';
import type { MessageType, GeneralMessageButton } from '../molecules/GeneralMessage/GeneralMessage.types';

interface MessageState {
  isOpen: boolean;
  type: MessageType;
  header: string;
  description: string;
  primaryButton?: GeneralMessageButton;
  secondaryButton?: GeneralMessageButton;
}

interface ShowMessageOptions {
  type: MessageType;
  headerKey: string;
  descriptionKey: string;
  descriptionParams?: Record<string, string | number>;
  primaryButton?: {
    labelKey: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  secondaryButton?: {
    labelKey: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
}

/**
 * Reusable hook for managing GeneralMessage modal state
 *
 * @param t - Translation function from i18next
 * @returns {object} - Message state and control functions
 *
 * @example
 * ```typescript
 * const { messageState, showMessage, closeMessage } = useGeneralMessage(t);
 *
 * showMessage({
 *   type: 'success',
 *   headerKey: 'message.success.header',
 *   descriptionKey: 'example.createSuccess',
 *   primaryButton: {
 *     labelKey: 'message.success.ok',
 *     onClick: closeMessage,
 *   },
 * });
 * ```
 */
export const useGeneralMessage = (t: (key: string, params?: Record<string, string | number>) => string) => {
  const [messageState, setMessageState] = useState<MessageState>({
    isOpen: false,
    type: 'info',
    header: '',
    description: '',
  });

  const showMessage = useCallback(
    (options: ShowMessageOptions) => {
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
    [t]
  );

  const closeMessage = useCallback(() => {
    setMessageState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const GeneralMessageComponent = (
    <GeneralMessage
      type={messageState.type}
      isOpen={messageState.isOpen}
      header={messageState.header}
      description={messageState.description}
      primaryButton={messageState.primaryButton}
      secondaryButton={messageState.secondaryButton}
      onClose={closeMessage}
    />
  );

  return {
    showMessage,
    closeMessage,
    GeneralMessageComponent,
  };
};
