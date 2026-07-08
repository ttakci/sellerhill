export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ToastProps {
  toast: ToastItem;
  onClose: (id: string) => void;
}

export interface ToastComponentProps {
  toast: ToastItem;
  onClose: () => void;
}
