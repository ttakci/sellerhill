import { Icon } from '../Icon';

import * as S from './Button.style';
import { ButtonProps } from './Button.types';

export const Button = ({
  children,
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  iconLeft,
  iconRight,
  iconColor,
  fullWidth = false,
  iconOnly = false,
  disabled,
  ...props
}: ButtonProps) => {
  // iconLeft/iconRight/iconColor retained: 8 feature files pass iconLeft to <Button>.
  const isIconOnly = iconOnly || (!children && !!(iconLeft || iconRight));

  return (
    <S.ActionSurface
      $variant={variant}
      $size={size}
      $fullWidth={fullWidth}
      $isLoading={isLoading}
      $iconColor={iconColor}
      $iconOnly={isIconOnly}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <S.LoadingContainer className="loader">
          <S.LoadingDot $delay="0s" />
          <S.LoadingDot $delay="0.2s" />
          <S.LoadingDot $delay="0.4s" />
        </S.LoadingContainer>
      )}

      <S.ButtonLabel>
        {iconLeft && <Icon name={iconLeft} size={size === 'xsmall' ? 16 : 20} color={iconColor} />}
        {!isIconOnly && children}
        {iconRight && <Icon name={iconRight} size={size === 'xsmall' ? 16 : 20} color={iconColor} />}
      </S.ButtonLabel>
    </S.ActionSurface>
  );
};

Button.displayName = 'Button';
