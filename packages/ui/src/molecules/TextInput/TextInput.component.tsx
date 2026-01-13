/**
 * TextInput Molecule
 * 
 * Purpose: Controller-wrapped Input with integrated Label and Error display
 * Pattern: Atomic Design - Molecule (Atom + Logic + Layout)
 * 
 * Features:
 * - React Hook Form Controller integration
 * - Automatic error display from form state
 * - Optional label with required indicator
 * - Type-safe field name binding
 */

import {
  Controller,
  type ControllerRenderProps,
  type FieldError,
  type FieldValues,
} from 'react-hook-form';

import { Input } from '../../atoms/Input';
import { Text } from '../../atoms/Text';

import * as S from './TextInput.style';
import type { TextInputProps } from './TextInput.types';

export const TextInput = <TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  label,
  type = 'text',
  placeholder,
  disabled = false,
  required = false,
  size = 'md',
  fullWidth = true,
  autoFocus = false,
  maxLength,
  id,
}: TextInputProps<TFieldValues>) => {
  const inputId = id || name;

  return (
    <Controller
      name={name}
      control={control}
      render={({
        field,
        fieldState: { error },
      }: {
        field: ControllerRenderProps<TFieldValues, typeof name>;
        fieldState: { error?: FieldError };
      }) => (
        <S.Container>
          {label && (
            <S.LabelText>
              <Text variant="body" weight="medium">
                {label}
                {required && <span style={{ color: 'red', marginLeft: 4 }}>*</span>}
              </Text>
            </S.LabelText>
          )}
          <Input
            {...field}
            id={inputId}
            type={type}
            placeholder={placeholder}
            disabled={disabled}
            hasError={!!error}
            size={size}
            fullWidth={fullWidth}
            autoFocus={autoFocus}
            maxLength={maxLength}
          />
          {error && <S.ErrorText>{error.message}</S.ErrorText>}
        </S.Container>
      )}
    />
  );
};

TextInput.displayName = 'TextInput';
