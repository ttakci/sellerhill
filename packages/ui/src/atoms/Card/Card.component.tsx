import React from 'react';

import { Text } from '../Text';

import * as S from './Card.style';
import type { CardBodyProps, CardFooterProps, CardHeaderProps, CardProps, CardStatProps } from './Card.types';

/** Trend tone -> semantic colour path consumed by `Text`'s `color` prop. */
const TREND_COLOR: Record<NonNullable<CardStatProps['trend']>, string> = {
  up: 'semantic.success',
  down: 'semantic.error',
  neutral: 'text.tertiary',
};

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
          {description}
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
    <S.CardStatContainer className={className} {...rest}>
      <div className="card-stat-header">
        <Text variant="body-sm" weight="medium" color="text.secondary">
          {label}
        </Text>
        {icon && <div className="card-stat-icon">{icon}</div>}
      </div>
      <Text variant="metric" weight="semibold">
        {value}
      </Text>
      {(trendValue || subtitle) && (
        <div className="card-stat-footer">
          {trendValue && (
            <Text variant="caption" weight="medium" color={TREND_COLOR[trend]}>
              {trendValue}
            </Text>
          )}
          {subtitle && (
            <Text variant="caption" color="text.tertiary">
              {subtitle}
            </Text>
          )}
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
