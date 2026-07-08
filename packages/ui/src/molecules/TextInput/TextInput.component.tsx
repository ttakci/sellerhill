import { forwardRef, useImperativeHandle } from 'react';

import { Icon } from '../../atoms/Icon';

import * as S from './TextInput.style';
import type { TextInputInnerComponentProps } from './TextInput.types';

export const TextInputInner = forwardRef<HTMLInputElement, TextInputInnerComponentProps>((props, ref) => {
  const {
    field,
    error,
    label,
    iconLeft,
    iconRight,
    isDisabled,
    fullWidth,
    type: _type,
    autoFocus,
    maxLength,
    id,
    autoComplete,
    onPressIcon: _onPressIcon,
    size = 'medium',
    suffixText,
    onKeyDown,
    isFocused,
    isPasswordVisible: _isPasswordVisible,
    inputRef,
    effectiveType,
    effectiveIconRight,
    isPassword,
    onFocus,
    onBlurField,
    onContainerClick,
    onTogglePasswordVisibility,
  } = props;

  const hasValue = field.value !== undefined && field.value !== null && field.value !== '';

  // Expose the input element for refs
  useImperativeHandle(ref, () => inputRef.current!);

  return (
    <S.Container $fullWidth={fullWidth}>
      <S.FieldWrapper
        $isFocused={isFocused}
        $hasError={!!error}
        $isDisabled={!!isDisabled}
        $fullWidth={fullWidth}
        $size={size}
        onClick={onContainerClick}
      >
        {iconLeft && (
          <S.DecorationWrapper $side="left" $size={size}>
            <Icon name={iconLeft} size={size === 'small' ? 16 : 20} />
          </S.DecorationWrapper>
        )}

        <S.Input
          {...field}
          ref={inputRef}
          id={id}
          type={effectiveType}
          disabled={isDisabled}
          autoFocus={autoFocus}
          maxLength={maxLength}
          autoComplete={autoComplete}
          onFocus={onFocus}
          onBlur={onBlurField}
          onKeyDown={onKeyDown}
          $hasIconLeft={!!iconLeft}
          $hasIconRight={!!effectiveIconRight}
          $hasLabel={!!label}
          $size={size}
          value={field.value ?? ''}
        />

        {label && (
          <S.FloatingLabel
            htmlFor={id}
            $isFocused={isFocused}
            $hasValue={hasValue}
            $isDisabled={!!isDisabled}
            $hasIconLeft={!!iconLeft}
            $hasError={!!error}
            $size={size}
          >
            {label}
          </S.FloatingLabel>
        )}

        {iconRight && !isPassword && (
          <S.DecorationWrapper $side="right" $size={size}>
            <Icon name={iconRight} size={size === 'small' ? 16 : 20} />
          </S.DecorationWrapper>
        )}

        {isPassword && effectiveIconRight && (
          <S.DecorationWrapper $side="right" $size={size}>
            <S.ToggleButton
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePasswordVisibility();
              }}
            >
              <Icon name={effectiveIconRight} size={size === 'small' ? 16 : 20} />
            </S.ToggleButton>
          </S.DecorationWrapper>
        )}

        {suffixText && (
          <S.DecorationWrapper $side="right" $size={size}>
            <S.SuffixText>{suffixText}</S.SuffixText>
          </S.DecorationWrapper>
        )}
      </S.FieldWrapper>

      {error && <S.ErrorText>{error.message}</S.ErrorText>}
    </S.Container>
  );
});

TextInputInner.displayName = 'ModernTextInputInner';
