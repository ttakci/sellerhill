import React from 'react';

import * as S from './PageHeader.style';
import type { PageHeaderProps } from './PageHeader.types';

export const PageHeader = ({
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps): React.ReactElement => {
  return (
    <S.HeaderWrapper className={className}>
      <S.TitleArea>
        <S.Title>{title}</S.Title>
        {subtitle && <S.Subtitle>{subtitle}</S.Subtitle>}
      </S.TitleArea>
      {actions && <S.ActionsArea>{actions}</S.ActionsArea>}
    </S.HeaderWrapper>
  );
};

PageHeader.displayName = 'PageHeader';
