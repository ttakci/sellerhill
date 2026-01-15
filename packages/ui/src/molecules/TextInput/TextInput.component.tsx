import React, { useState } from 'react';
import {
  Controller,
  type ControllerRenderProps,
  type FieldError,
  type FieldValues,
} from 'react-hook-form';

import { Icon, type IconName } from '../../atoms/Icon';
import { Input } from '../../atoms/Input';

import * as S from './TextInput.style';
import type { TextInputProps } from './TextInput.types';

interface TextInputInnerProps<TFieldValues extends FieldValues> {
  field: ControllerRenderProps<TFieldValues, any>;
  error?: FieldError;
  label: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  id?: string;
  type?: string;
  disabled?: boolean;
}

const TextInputInner = <TFieldValues extends FieldValues>({
  field,
  error,
  label,
  leftIcon,
  rightIcon,
  prefix,
  suffix,
  size,
  fullWidth,
  autoFocus,
  maxLength,
  id,
  type,
  disabled,
}: TextInputInnerProps<TFieldValues>) => {
  const [isFocused, setIsFocused] = useState(false);
  
  const hasValue = field.value !== undefined && field.value !== null && field.value !== '';
  const isFloating = isFocused || hasValue;

  return (
    <S.Container>
      <S.InputGroup $hasError={!!error} $isFloating={isFloating}>
        <S.FloatingLabel 
          $isFloating={isFloating} 
          $hasError={!!error}
          $hasLeftIcon={!!leftIcon || !!prefix}
        >
          {label}
        </S.FloatingLabel>

        {prefix && <S.Addon side="left">{prefix}</S.Addon>}
        {leftIcon && (
          <S.IconWrapper side="left">
            <Icon name={leftIcon} size={20} />
          </S.IconWrapper>
        )}
        
        <Input
          {...field}
          id={id}
          type={type}
          placeholder="" // Always empty because label is the placeholder
          disabled={disabled}
          hasError={!!error}
          size={size}
          fullWidth={fullWidth}
          autoFocus={autoFocus}
          maxLength={maxLength}
          variant="default"
          onFocus={() => {
            setIsFocused(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            field.onBlur();
          }}
          style={{ 
            border: 'none', 
            backgroundColor: 'transparent',
            paddingLeft: leftIcon || prefix ? '0' : '16px',
            paddingRight: rightIcon || suffix ? '0' : '16px',
            paddingTop: isFloating ? '28px' : '0',
            paddingBottom: isFloating ? '6px' : '0',
            height: '100%',
            transition: 'all 0.2s ease',
            flex: 1,
            zIndex: 12
          }}
        />

        {rightIcon && (
          <S.IconWrapper side="right">
            <Icon name={rightIcon} size={20} />
          </S.IconWrapper>
        )}
        {suffix && <S.Addon side="right">{suffix}</S.Addon>}
      </S.InputGroup>

      {error && <S.ErrorText>{error.message}</S.ErrorText>}
    </S.Container>
  );
};

export const TextInput = <TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  label,
  type = 'text',
  disabled = false,
  size = 'md',
  fullWidth = true,
  autoFocus = false,
  maxLength,
  id,
  leftIcon,
  rightIcon,
  prefix,
  suffix,
}: TextInputProps<TFieldValues>) => {
  const inputId = id || name;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <TextInputInner
          field={field}
          error={error}
          label={label}
          leftIcon={leftIcon}
          rightIcon={rightIcon}
          prefix={prefix}
          suffix={suffix}
          size={size}
          fullWidth={fullWidth}
          autoFocus={autoFocus}
          maxLength={maxLength}
          id={inputId}
          type={type}
          disabled={disabled}
        />
      )}
    />
  );
};

TextInput.displayName = 'TextInput';
