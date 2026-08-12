import React from 'react';

import * as S from './JobProgressRing.style';
import type { JobProgressRingProps } from './JobProgressRing.types';

export const JobProgressRing: React.FC<JobProgressRingProps> = ({ percent }) => (
  <S.Ring $percent={percent} role="img" aria-label={`${percent}%`}>
    <S.RingValue variant="body-sm" weight="semibold" numeric>
      {percent}%
    </S.RingValue>
  </S.Ring>
);

JobProgressRing.displayName = 'JobProgressRing';
