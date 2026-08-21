import React from 'react';

import { Button } from '../Button';
import { Icon } from '../Icon';
import { Text } from '../Text';

import * as S from './InfoMessage.style';
import type { InfoMessageProps } from './InfoMessage.types';

export const InfoMessage = ({
  children,
  action,
  onAction,
  isActionLoading,
  className,
}: InfoMessageProps): React.ReactElement => (
  <S.Container className={className} role="note">
    <S.IconWell>
      <Icon name="triangle-info" size={18} color="semantic.info" />
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
