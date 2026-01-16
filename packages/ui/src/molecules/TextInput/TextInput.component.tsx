import React from 'react';
import {
  Controller,
  type ControllerRenderProps,
  type FieldError,
  type FieldValues,
} from 'react-hook-form';

import { Icon, type IconName } from '../../atoms/Icon';

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
  autoFocus,
  maxLength,
  id,
  type,
  disabled,
}: TextInputInnerProps<TFieldValues>) => {
  return (
    <S.Container>
      {label && <S.LabelText htmlFor={id}>{label}</S.LabelText>}
      <S.InputGroup $hasError={!!error}>
        {leftIcon && (
          <S.IconWrapper side="left">
            <Icon name={leftIcon} size={18} />
          </S.IconWrapper>
        )}
        
        <S.InnerInput
          {...field}
          id={id}
          type={type}
          disabled={disabled}
          autoFocus={autoFocus}
          maxLength={maxLength}
          $hasLeftIcon={!!leftIcon}
          $hasRightIcon={!!rightIcon}
          value={field.value ?? ''}
          placeholder={label}
        />

        {rightIcon && (
          <S.IconWrapper side="right">
            <Icon name={rightIcon} size={18} />
          </S.IconWrapper>
        )}
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
