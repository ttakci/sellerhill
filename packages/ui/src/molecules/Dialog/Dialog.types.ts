import type { ReactNode } from 'react';

import type { ButtonVariant } from '../../atoms/Button';
import type { IconName } from '../../atoms/Icon';
import type { MessageType } from '../../context';

export interface DialogAction {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
  isLoading?: boolean;
  disabled?: boolean;
}

/**
 * Shared alert / confirm / form dialog shell.
 * Visual contract: centered icon → title → description → optional body → stacked full-width actions.
 */
export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Drives default icon + tint (info | success | warning | error) */
  type?: MessageType;
  title: string;
  description?: ReactNode;
  /** Extra content under description (e.g. confirm email field) */
  children?: ReactNode;
  /** Override default type icon */
  icon?: IconName;
  primaryAction: DialogAction;
  /** Rendered below primary — full width stack */
  secondaryAction?: DialogAction;
  /** Hide X; default true for simple alerts */
  showCloseButton?: boolean;
}
