import type { MessageType } from '../../context';

export interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: MessageType;
  title: string;
  description: string;
  primaryButton: {
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
