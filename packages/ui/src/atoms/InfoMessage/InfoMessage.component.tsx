import React from 'react';

import type { MessageType } from '../../context';
import { Button } from '../Button';
import { Icon, type IconName } from '../Icon';
import { Text } from '../Text';

import * as S from './InfoMessage.style';
import type { InfoMessageProps } from './InfoMessage.types';

/**
 * The same glyph per type as `Dialog`, so a warning note and the dialog that
 * reports the same condition cannot drift apart. `info` keeps the outlined
 * triangle it has always drawn.
 */
const iconsByType: Record<MessageType, IconName> = {
  success: 'check-circle',
  error: 'triangle-info',
  warning: 'alert-triangle',
  info: 'triangle-info',
};

export const InfoMessage = ({
  children,
  type = 'info',
  action,
  onAction,
  isActionLoading,
  className,
}: InfoMessageProps): React.ReactElement => (
  <S.Container
    className={className}
    // A note is passive; anything louder is a consequence of what the user
    // just changed, so it is announced rather than left to be discovered.
    role={type === 'info' ? 'note' : 'alert'}
    $type={type}
  >
    <S.IconWell $type={type}>
      <Icon
        name={iconsByType[type]}
        size={18}
        color={type === 'info' ? 'semantic.info' : 'text.inverse'}
      />
    </S.IconWell>
    <S.Content>
      <Text variant="caption" color="text.primary">
        {children}
      </Text>
    </S.Content>
    {action && onAction ? (
      <S.ActionSlot>
        <Button variant="secondary" size="small" onClick={onAction} isLoading={isActionLoading}>
          <Text variant="body-sm">{action}</Text>
        </Button>
      </S.ActionSlot>
    ) : null}
  </S.Container>
);

InfoMessage.displayName = 'InfoMessage';
