import { Button, Icon, Text } from '@repo/ui';
import React from 'react';

import * as S from './DemoBanner.style';
import type { DemoBannerProps } from './DemoBanner.types';

export const DemoBannerComponent = ({
  label,
  description,
  exitLabel,
  signUpLabel,
  onExit,
  onSignUp,
}: DemoBannerProps): React.ReactElement => (
  <S.Bar role="status">
    <S.Marker>
      <Icon name="eye" size={12} />
      {label}
    </S.Marker>
    <Text variant="body-sm" color="secondary">
      {description}
    </Text>
    <S.Actions>
      <Button variant="tertiary" size="small" onClick={onExit}>
        <Text variant="body-sm">{exitLabel}</Text>
      </Button>
      <Button variant="primary" size="small" onClick={onSignUp}>
        <Text variant="body-sm">{signUpLabel}</Text>
      </Button>
    </S.Actions>
  </S.Bar>
);
