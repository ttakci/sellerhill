import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Controller, type FieldError, type FieldPath, type FieldValues } from 'react-hook-form';

import { Icon } from '../../atoms/Icon';

import * as S from './TextInput.style';
import type { TextInputProps, TextInputSize } from './TextInput.types';

interface InnerFieldProps {
  name: string;
  value: string;
  onChange: (...event: unknown[]) => void;
  onBlur: () => void;
}

interface ModernTextInputInnerProps {
  field: InnerFieldProps;
  error?: FieldError;
  label?: string;
  iconLeft?: string;
  iconRight?: string;
  isDisabled?: boolean;
  fullWidth?: boolean;
  type?: string;
  autoFocus?: boolean;
  maxLength?: number;
  id?: string;
  autoComplete?: string;
  onPressIcon?: () => void;
  size?: TextInputSize;
  suffixText?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const ModernTextInputInner = forwardRef<HTMLInputElement, ModernTextInputInnerProps>((props, ref) => {
  const {
    field,
    error,
    label,
    iconLeft,
    iconRight,
    isDisabled,
    fullWidth,
    type = 'text',
    autoFocus,
    maxLength,
    id,
    autoComplete,
    onPressIcon: _onPressIcon,
    size = 'medium',
    suffixText,
    onKeyDown,
    ...rest
  } = props;

  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPassword = type === 'password';
  const effectiveType = isPassword ? (isPasswordVisible ? 'text' : 'password') : type;
  const effectiveIconRight = isPassword ? (isPasswordVisible ? 'eye-off' : 'eye') : iconRight;

  // Expose the input element for refs
  useImperativeHandle(ref, () => inputRef.current!);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    void e;
  };

  const handleBlur = () => {
    setIsFocused(false);
    field.onBlur();
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const hasValue = field.value !== undefined && field.value !== null && field.value !== '';

  return (
    <S.Container $fullWidth={fullWidth}>
      <S.FieldWrapper
        $isFocused={isFocused}
        $hasError={!!error}
        $isDisabled={!!isDisabled}
        $fullWidth={fullWidth}
        $size={size}
        onClick={handleContainerClick}
      >
        {iconLeft && (
          <S.DecorationWrapper $side="left" $size={size}>
            <Icon name={iconLeft} size={size === 'small' ? 16 : 20} />
          </S.DecorationWrapper>
        )}

        <S.Input
          {...field}
          {...rest}
          ref={inputRef}
          id={id}
          type={effectiveType}
          disabled={isDisabled}
          autoFocus={autoFocus}
          maxLength={maxLength}
          autoComplete={autoComplete}
          onFocus={handleFocus}
          onBlur={handleBlur}
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
                setIsPasswordVisible(!isPasswordVisible);
              }}
            >
              <Icon name={effectiveIconRight } size={size === 'small' ? 16 : 20} />
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

ModernTextInputInner.displayName = 'ModernTextInputInner';

export const TextInput = <TFieldValues extends FieldValues = FieldValues>(
  props: TextInputProps<TFieldValues>
) => {
  const { name, control, rules, ...rest } = props;

  // Manual usage support
  if (!control) {
    const { value, onChange, onBlur } = props;
    const manualField: InnerFieldProps = {
      name,
      value: value ?? '',
      onChange: (e: unknown) => onChange?.(e as React.ChangeEvent<HTMLInputElement>),
      onBlur: () => onBlur?.({} as React.FocusEvent<HTMLInputElement>),
    };
    return <ModernTextInputInner {...rest} field={manualField} />;
  }

  return (
    <Controller
      name={name as FieldPath<TFieldValues>}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => {
        const adaptedField: InnerFieldProps = {
          name: field.name,
          value: field.value ?? '',
          onChange: (...args: unknown[]) => field.onChange(...args),
          onBlur: field.onBlur,
        };
        return <ModernTextInputInner {...rest} field={adaptedField} error={error} />;
      }}
    />
  );
};

TextInput.displayName = 'ModernTextInput';
