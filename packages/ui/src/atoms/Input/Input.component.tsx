import { forwardRef, type ChangeEvent } from 'react';

import { S } from './Input.style';
import type { InputProps } from './Input.types';

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      value,
      onChange,
      onBlur,
      onFocus,
      placeholder,
      size = 'md',
      variant = 'default',
      error,
      hasError,
      success,
      fullWidth = true,
      disabled = false,
      readOnly = false,
      type = 'text',
      name,
      id,
      autoFocus,
      maxLength,
      leftIcon,
      rightIcon,
      style,
    },
    ref
  ) => {
    const computedVariant = error || hasError ? 'error' : success ? 'success' : variant;
    const helperText = error || success;

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        // Support both React Hook Form (event) and direct usage (value)
        // TypeScript will handle the overload
        (onChange as (event: ChangeEvent<HTMLInputElement>) => void)(e);
      }
    };

    const inputContent = (
      <S.ControlWrapper $fullWidth={fullWidth}>
        {leftIcon && (
          <S.IconWrapper $position="left" $size={size}>
            {leftIcon}
          </S.IconWrapper>
        )}
        <S.InputField
          ref={ref}
          value={value ?? ''}
          onChange={handleChange}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          type={type}
          name={name}
          id={id}
          autoFocus={autoFocus}
          maxLength={maxLength}
          style={style}
          $size={size}
          $variant={computedVariant}
          $fullWidth={fullWidth}
          $hasLeftIcon={!!leftIcon}
          $hasRightIcon={!!rightIcon}
        />
        {rightIcon && (
          <S.IconWrapper $position="right" $size={size}>
            {rightIcon}
          </S.IconWrapper>
        )}
      </S.ControlWrapper>
    );

    if (helperText) {
      return (
        <S.InputWrapper>
          {inputContent}
          <S.HelperText $variant={error ? 'error' : 'success'}>{helperText}</S.HelperText>
        </S.InputWrapper>
      );
    }

    return inputContent;
  }
);

Input.displayName = 'Input';
