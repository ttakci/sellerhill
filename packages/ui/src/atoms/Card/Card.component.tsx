import React from 'react';

import * as S from './Card.style';
import type { CardBodyProps, CardFooterProps, CardHeaderProps, CardProps, CardStatProps } from './Card.types';

export const Card = ({
  children,
  variant = 'default',
  padding,
  hoverable = false,
  className,
  style,
  ...rest
}: CardProps): React.ReactElement => {
  return (
    <S.CardContainer
      $variant={variant}
      $padding={padding ?? 'none'}
      $hoverable={hoverable}
      className={className}
      // eslint-disable-next-line design-system/no-inline-styles -- pass-through style prop for consumer overrides
      style={style}
      {...rest}
    >
      {children}
    </S.CardContainer>
  );
};

export const CardHeader = ({ children, icon, description, actions, className }: CardHeaderProps): React.ReactElement => {
  return (
    <S.CardHeaderContainer className={className}>
      <S.CardHeaderContent>
        {icon}
        <S.CardHeaderTextContent>
          {children}
          {description && <S.CardHeaderDescription>{description}</S.CardHeaderDescription>}
        </S.CardHeaderTextContent>
      </S.CardHeaderContent>
      {actions && <S.CardHeaderActions>{actions}</S.CardHeaderActions>}
    </S.CardHeaderContainer>
  );
};

export const CardBody = ({ children, className }: CardBodyProps): React.ReactElement => {
  return <S.CardBodyContainer className={className}>{children}</S.CardBodyContainer>;
};

export const CardFooter = ({ children, className }: CardFooterProps): React.ReactElement => {
  return <S.CardFooterContainer className={className}>{children}</S.CardFooterContainer>;
};

export const CardStat = ({
  icon,
  label,
  value,
  subtitle,
  trend = 'neutral',
  trendValue,
  className,
  ...rest
}: CardStatProps): React.ReactElement => {
  return (
    <S.CardStatContainer $trend={trend} className={className} {...rest}>
      <div className="card-stat-header">
        <span className="card-stat-label">{label}</span>
        {icon && <div className="card-stat-icon">{icon}</div>}
      </div>
      <div className="card-stat-value">{value}</div>
      {(trendValue || subtitle) && (
        <div className="card-stat-footer">
          {trendValue && <span className="card-stat-trend">{trendValue}</span>}
          {subtitle && <span className="card-stat-subtitle">{subtitle}</span>}
        </div>
      )}
    </S.CardStatContainer>
  );
};

Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardBody.displayName = 'CardBody';
CardFooter.displayName = 'CardFooter';
CardStat.displayName = 'CardStat';
