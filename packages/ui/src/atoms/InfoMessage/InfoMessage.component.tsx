import React from 'react';

import { Icon } from '../Icon';
import { Text } from '../Text';

import * as S from './InfoMessage.style';
import type { InfoMessageProps } from './InfoMessage.types';

export const InfoMessage = ({ children, className }: InfoMessageProps): React.ReactElement => (
  <S.Container className={className} role="note">
    <S.IconWell>
      <Icon name="triangle-info" size={18} color="semantic.info" />
    </S.IconWell>
    <S.Content>
      <Text variant="caption" color="text.primary">
        {children}
      </Text>
    </S.Content>
  </S.Container>
);

InfoMessage.displayName = 'InfoMessage';
