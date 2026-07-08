import * as S from './Button.style';
import { ButtonProps } from './Button.types';

export const Button = ({
  children,
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  fullWidth = false,
  iconOnly = false,
  disabled,
  ...props
}: ButtonProps) => {
  const isIconOnly = iconOnly || !children;

  return (
    <S.ActionSurface
      $variant={variant}
      $size={size}
      $fullWidth={fullWidth}
      $isLoading={isLoading}
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

      <S.ButtonLabel>{!isIconOnly && children}</S.ButtonLabel>
    </S.ActionSurface>
  );
};

Button.displayName = 'Button';
