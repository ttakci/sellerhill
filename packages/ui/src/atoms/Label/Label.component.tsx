import React from 'react';

import { S } from './Label.style';
import type { LabelProps } from './Label.types';

export const Label = ({
  children,
  size = 'md',
  required = false,
  disabled = false,
}: LabelProps): React.ReactElement => {
  return (
    <S.LabelText $size={size} $disabled={disabled}>
      {children}
      {required && <S.RequiredIndicator>*</S.RequiredIndicator>}
    </S.LabelText>
  );
};
