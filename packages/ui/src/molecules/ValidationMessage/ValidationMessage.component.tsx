import React from 'react';

import { Icon } from '../../atoms/Icon';

import * as S from './ValidationMessage.style';
import type { ValidationMessageProps } from './ValidationMessage.types';

export const ValidationMessage = ({ children, id, className }: ValidationMessageProps): React.ReactElement => (
  <S.Container id={id} className={className} role="alert">
    <S.IconWrapper>
      <Icon name="triangle-info" size={18} />
    </S.IconWrapper>
    {children}
  </S.Container>
);

ValidationMessage.displayName = 'ValidationMessage';
