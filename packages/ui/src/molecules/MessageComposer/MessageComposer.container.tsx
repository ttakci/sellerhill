import { useCallback, useState } from 'react';

import { MessageComposerComponent } from './MessageComposer.component';
import type {
  MessageComposerCancelAction,
  MessageComposerProps,
  MessageComposerSendAction,
} from './MessageComposer.types';

/**
 * Container (logic) for MessageComposer.
 *
 * Owns transient IME composition state + the keyboard-send gate. The draft
 * itself is controlled by the parent (`value` / `onChange`).
 *
 * IME guard: while a CJK/IME composition is in progress, Enter MUST insert a
 * newline (confirm the IME candidate) — it must NOT trigger `onSend`. We track
 * composition with `compositionstart` / `compositionend` and a
 * `compositionEndAt` timestamp because browsers fire `keydown(Enter)` BEFORE
 * `compositionend` on some platforms.
 */
export const MessageComposer = ({
  value,
  onChange,
  placeholder,
  onSend,
  cancelAction,
  sendAction,
  submitMode = 'enter',
  size = 'medium',
  disabled = false,
  sending = false,
  maxLength,
  fullWidth = true,
  className,
  id,
  sendLabel,
  'aria-label': ariaLabel,
  autoFocus,
  rows,
}: MessageComposerProps) => {
  const [isComposing, setIsComposing] = useState(false);
  // Set on `compositionend` — used to ignore the immediately-following Enter
  // `keydown` that some browsers emit after a composition commit.
  const [compositionEndedAt, setCompositionEndedAt] = useState(0);

  const handleTextAreaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      // Enforce maxLength even if the browser didn't (paste/drag IME).
      const capped = maxLength !== undefined && next.length > maxLength ? next.slice(0, maxLength) : next;
      onChange(capped);
    },
    [maxLength, onChange],
  );

  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      setIsComposing(false);
      setCompositionEndedAt(Date.now());
      // Some browsers do not fire a final `change` for the committed text —
      // sync the committed value through the same cap+onChange path.
      const next = e.currentTarget.value;
      const capped =
        maxLength !== undefined && next.length > maxLength ? next.slice(0, maxLength) : next;
      onChange(capped);
    },
    [maxLength, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (submitMode !== 'enter') {
        return;
      }
      if (e.key !== 'Enter') {
        return;
      }
      // Shift+Enter / Ctrl+Enter / Meta+Enter / Alt+Enter — always insert a
      // newline (or be left to the consumer). Default chat contract: only bare
      // Enter sends.
      if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      // IME: during active composition, Enter confirms the candidate — do not
      // send. Also ignore the Enter that fires within ~500ms after
      // `compositionend`, which some browsers emit as a separate keydown.
      if (isComposing) {
        return;
      }
      if (compositionEndedAt > 0 && Date.now() - compositionEndedAt < 500) {
        return;
      }
      e.preventDefault();
      onSend();
    },
    [submitMode, isComposing, compositionEndedAt, onSend],
  );

  const handleSendClick = useCallback(() => {
    onSend();
  }, [onSend]);

  const resolvedSend: Pick<MessageComposerSendAction, 'icon' | 'variant' | 'isLoading'> & {
    label: string;
  } = {
    label: sendAction?.label ?? sendLabel ?? '',
    icon: sendAction?.icon ?? 'send',
    variant: sendAction?.variant ?? 'primary',
    isLoading: sendAction?.isLoading ?? sending,
  };

  const resolvedCancel: MessageComposerCancelAction | undefined = cancelAction
    ? {
        onCancel: cancelAction.onCancel,
        label: cancelAction.label,
        variant: cancelAction.variant ?? 'secondary',
        disabled: cancelAction.disabled ?? disabled,
      }
    : undefined;

  return (
    <MessageComposerComponent
      value={value}
      placeholder={placeholder}
      onTextAreaChange={handleTextAreaChange}
      onTextAreaKeyDown={handleKeyDown}
      onTextAreaCompositionStart={handleCompositionStart}
      onTextAreaCompositionEnd={handleCompositionEnd}
      onSendClick={handleSendClick}
      onCancelClick={resolvedCancel?.onCancel}
      size={size}
      disabled={disabled}
      sending={sending}
      maxLength={maxLength}
      fullWidth={fullWidth}
      id={id}
      sendLabel={resolvedSend.label}
      sendIcon={resolvedSend.icon}
      sendVariant={resolvedSend.variant}
      cancelLabel={resolvedCancel?.label}
      cancelVariant={resolvedCancel?.variant}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      rows={rows}
      className={className}
    />
  );
};

MessageComposer.displayName = 'MessageComposer';
