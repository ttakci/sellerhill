import React from 'react';

import * as S from './Card.style';
import type { CardBodyProps, CardHeaderProps, CardProps } from './Card.types';

export const Card = ({
  children,
  variant = 'default',
  padding,
  className,
  style,
}: CardProps): React.ReactElement => {
  return (
    <S.CardContainer $variant={variant} $padding={padding} className={className} style={style}>
      {children}
    </S.CardContainer>
  );
};

export const CardHeader = ({
  children,
  icon,
  actions,
  className,
}: CardHeaderProps): React.ReactElement => {
  return (
    <S.CardHeaderContainer className={className}>
      <S.CardHeaderContent>
        {icon}
        {children}
      </S.CardHeaderContent>
      {actions && <S.CardHeaderActions>{actions}</S.CardHeaderActions>}
    </S.CardHeaderContainer>
  );
};

export const CardBody = ({
  children,
  className,
}: CardBodyProps): React.ReactElement => {
  return <S.CardBodyContainer className={className}>{children}</S.CardBodyContainer>;
};

Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardBody.displayName = 'CardBody';
