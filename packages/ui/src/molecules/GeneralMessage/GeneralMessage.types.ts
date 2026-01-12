export type MessageType = 'info' | 'success' | 'warning' | 'error';

export interface GeneralMessageButton {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface GeneralMessageProps {
  type: MessageType;
  header?: string;
  description: string;
  icon?: React.ReactNode;
  primaryButton?: GeneralMessageButton;
  secondaryButton?: GeneralMessageButton;
  onClose?: () => void;
  isOpen: boolean;
}
