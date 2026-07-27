import type React from 'react';

import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';

import * as S from './MessageComposer.style';
import type { MessageComposerComponentProps, MessageComposerSize } from './MessageComposer.types';

const buttonSizeFor = (size: MessageComposerSize): 'small' | 'medium' => {
  if (size === 'small') {
    return 'small';
  }
  return 'medium';
};

export const MessageComposerComponent: React.FC<MessageComposerComponentProps> = ({
  value,
  placeholder,
  onTextAreaChange,
  onTextAreaKeyDown,
  onTextAreaCompositionStart,
  onTextAreaCompositionEnd,
  onSendClick,
  onCancelClick,
  size,
  disabled,
  sending,
  maxLength,
  fullWidth,
  id,
  sendLabel,
  sendIcon,
  sendVariant,
  cancelLabel,
  cancelVariant,
  'aria-label': ariaLabel,
  autoFocus,
  rows = 2,
  className,
}) => {
  const isSendDisabled = disabled || sending;
  const isOver = maxLength !== undefined && value.length > maxLength;
  const isAtLimit = maxLength !== undefined && value.length === maxLength;

  return (
    <S.ComposerShell
      $size={size}
      $fullWidth={fullWidth}
      $isDisabled={disabled}
      className={className}
    >
      <S.ComposerTextarea
        id={id}
        value={value}
        onChange={onTextAreaChange}
        onKeyDown={onTextAreaKeyDown}
        onCompositionStart={onTextAreaCompositionStart}
        onCompositionEnd={onTextAreaCompositionEnd}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        rows={rows}
        maxLength={maxLength}
        $size={size}
      />

      <S.ActionRow>
        {maxLength !== undefined ? (
          <S.CounterSlot>
            <Text variant="caption" color="text.tertiary">
              {value.length}
            </Text>
            <Text variant="caption" color="text.tertiary">
              {'/'}
            </Text>
            <Text
              variant="caption"
              color={isOver ? 'text.primary' : 'text.tertiary'}
              weight={isOver ? 'semibold' : 'regular'}
            >
              {maxLength}
            </Text>
            {isOver ? (
              <S.CounterOver>
                <Text variant="caption" color="semantic.error" weight="medium">
                  {'!'}
                </Text>
              </S.CounterOver>
            ) : isAtLimit ? (
              <Icon name="check" size={12} color="text.tertiary" />
            ) : null}
          </S.CounterSlot>
        ) : null}

        {onCancelClick && cancelLabel ? (
          <Button
            variant={cancelVariant ?? 'secondary'}
            size={buttonSizeFor(size)}
            disabled={disabled}
            onClick={onCancelClick}
          >
            <Text variant="body" weight="semibold">
              {cancelLabel}
            </Text>
          </Button>
        ) : null}

        <Button
          variant={sendVariant ?? 'primary'}
          size={buttonSizeFor(size)}
          isLoading={sending}
          disabled={isSendDisabled}
          onClick={onSendClick}
          aria-label={sendLabel}
        >
          <Text variant="body" weight="semibold">
            {sendLabel}
          </Text>
          {sendIcon ? <Icon name={sendIcon} size={16} color="text.inverse" /> : null}
        </Button>
      </S.ActionRow>
    </S.ComposerShell>
  );
};

MessageComposerComponent.displayName = 'MessageComposerComponent';
