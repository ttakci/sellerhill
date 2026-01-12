import React from 'react';

import * as S from './GeneralLoading.style';
import type { GeneralLoadingProps } from './GeneralLoading.types';

export const GeneralLoading: React.FC<GeneralLoadingProps> = ({ isLoading, size = 'medium', overlay = false }) => {
  if (!isLoading) {
    return null;
  }

  const content = (
    <S.Container>
      <S.Spinner size={size} />
    </S.Container>
  );

  if (overlay) {
    return <S.Overlay $overlay={overlay}>{content}</S.Overlay>;
  }

  return content;
};
