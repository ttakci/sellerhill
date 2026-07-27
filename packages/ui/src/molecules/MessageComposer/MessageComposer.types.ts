import type React from 'react';

import type { ButtonVariant } from '../../atoms/Button';
import type { IconName } from '../../atoms/Icon';

/**
 * Composer size — aligns with shared form-control geometry so a compact
 * composer matches SearchField / Select / TextInput toolbars.
 */
export type MessageComposerSize = 'small' | 'medium' | 'large';

/**
 * Send-trigger strategy.
 * - `enter`        — Enter sends, Shift+Enter inserts a newline (default; chat UX).
 * - `explicit`     — only the Send button triggers onSend (form-style).
 */
export type MessageComposerSubmitMode = 'enter' | 'explicit';

export interface MessageComposerSendAction {
  /** Click/keyboard handler for the primary Send button. */
  onSend: () => void;
  /** Localized label for the Send button (i18n). */
  label: string;
  /** Optional icon override (defaults to `send`). */
  icon?: IconName;
  variant?: ButtonVariant;
  isLoading?: boolean;
}

export interface MessageComposerCancelAction {
  onCancel: () => void;
  /** Localized label for the Cancel button (i18n). */
  label: string;
  variant?: ButtonVariant;
  disabled?: boolean;
}

/**
 * Props for the MessageComposer molecule.
 *
 * Controlled input — the caller owns `value` and `onChange`. The composer does
 * NOT hold the draft in internal state; it only manages transient IME
 * composition state and focus for accessibility.
 */
export interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  /** Localized placeholder text (i18n). */
  placeholder?: string;
  onSend: () => void;
  /** Optional Cancel action; when omitted, no Cancel button is rendered. */
  cancelAction?: MessageComposerCancelAction;
  /** Optional Send-action override (icon/variant/loading). When omitted, a
   * default Send action with `send` icon + primary variant is used. */
  sendAction?: Omit<MessageComposerSendAction, 'onSend' | 'label'> & { label?: string };
  submitMode?: MessageComposerSubmitMode;
  size?: MessageComposerSize;
  /** Disables the textarea + all action buttons. */
  disabled?: boolean;
  /** When true, the Send button shows a loading state and is disabled. */
  sending?: boolean;
  /** Hard cap on draft length (chars). When set, a counter is shown. */
  maxLength?: number;
  fullWidth?: boolean;
  className?: string;
  id?: string;
  /** Localized "Send" label used when `sendAction.label` is omitted (i18n). */
  sendLabel?: string;
  /** Accessible label for the textarea (i18n). */
  'aria-label'?: string;
  /** Auto-focus the textarea on mount. */
  autoFocus?: boolean;
  /** Min visible rows for the textarea. */
  rows?: number;
}

/**
 * Props passed from the container (logic) to the component (markup only).
 * The component must NOT derive behavior — only render what the container
 * hands it.
 */
export interface MessageComposerComponentProps {
  value: string;
  placeholder?: string;
  onTextAreaChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onTextAreaKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onTextAreaCompositionStart: () => void;
  onTextAreaCompositionEnd: (e: React.CompositionEvent<HTMLTextAreaElement>) => void;
  onSendClick: () => void;
  onCancelClick?: () => void;
  size: MessageComposerSize;
  disabled: boolean;
  sending: boolean;
  maxLength?: number;
  fullWidth: boolean;
  id?: string;
  sendLabel: string;
  sendIcon?: IconName;
  sendVariant?: ButtonVariant;
  cancelLabel?: string;
  cancelVariant?: ButtonVariant;
  'aria-label'?: string;
  autoFocus?: boolean;
  rows?: number;
  className?: string;
}
