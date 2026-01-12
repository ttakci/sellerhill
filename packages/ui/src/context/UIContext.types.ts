import type { LoadingSize } from '../molecules/GeneralLoading/GeneralLoading.types';
import type { MessageType, GeneralMessageButton } from '../molecules/GeneralMessage/GeneralMessage.types';

export interface MessageState {
  isOpen: boolean;
  type: MessageType;
  header: string;
  description: string;
  primaryButton?: GeneralMessageButton;
  secondaryButton?: GeneralMessageButton;
}

export interface LoadingState {
  isLoading: boolean;
  size?: LoadingSize;
  overlay?: boolean;
}

export interface ShowMessageOptions {
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

export interface ShowLoadingOptions {
  size?: LoadingSize;
  overlay?: boolean;
}

export interface UIContextValue {
  messageState: MessageState;
  loadingState: LoadingState;
  showMessage: (
    options: ShowMessageOptions,
    t: (key: string, params?: Record<string, string | number>) => string
  ) => void;
  closeMessage: () => void;
  showLoading: (options?: ShowLoadingOptions) => void;
  hideLoading: () => void;
}
