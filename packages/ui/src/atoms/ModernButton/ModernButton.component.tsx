import { Icon } from '../Icon';
import * as S from './ModernButton.style';
import { ModernButtonProps } from './ModernButton.types';

export const ModernButton = ({
  children,
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  iconLeft,
  iconRight,
  iconColor,
  fullWidth = false,
  disabled,
  ...props
}: ModernButtonProps) => {
  return (
    <S.ActionSurface
      $variant={variant}
      $size={size}
      $fullWidth={fullWidth}
      $isLoading={isLoading}
      $iconColor={iconColor}
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
        {children}
        {iconRight && <Icon name={iconRight} size={size === 'xsmall' ? 16 : 20} color={iconColor} />}
      </S.ButtonLabel>
    </S.ActionSurface>
  );
};

ModernButton.displayName = 'ModernButton';
