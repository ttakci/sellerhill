export type MessageType = 'success' | 'warning' | 'error' | 'info';
export type LoadingSize = 'sm' | 'md' | 'lg';

export interface MessageState {
  isOpen: boolean;
  type: MessageType;
  header: string;
  description: string;
  primaryButton?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
  };
  secondaryButton?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
  };
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
    variant?: 'primary' | 'secondary' | 'danger';
  };
  secondaryButton?: {
    labelKey: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
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
