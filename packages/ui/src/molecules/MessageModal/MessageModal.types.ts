import type { MessageType } from '../../context';

export interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: MessageType;
  /**
   * @deprecated Prefer type-based titles. When omitted, Dialog uses `typeTitles` / defaults.
   * Kept for backward compatibility — if set, overrides the type title.
   */
  title?: string;
  /** Localized short titles per type (Info / Warning / …). */
  typeTitles?: Partial<Record<MessageType, string>>;
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
