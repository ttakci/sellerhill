import type { FieldValues } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Text } from '../../atoms/Text';
import { Textarea } from '../../atoms/Textarea';
import * as S from '../TextInput/TextInput.style'; // Reusing TextInput styles for container/label
import type { TextareaInputProps } from './TextareaInput.types';

export const TextareaInput = <TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  label,
  placeholder,
  disabled,
  required,
  fullWidth = true,
  rows = 4,
  id,
}: TextareaInputProps<TFieldValues>) => {
  const inputId = id || name;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <S.Container>
          {label && (
            <S.LabelText>
              <Text variant="body" weight="medium">
                {label}
                {required && <span style={{ color: 'red', marginLeft: 4 }}>*</span>}
              </Text>
            </S.LabelText>
          )}
          <Textarea
            {...field}
            id={inputId}
            placeholder={placeholder}
            disabled={disabled}
            hasError={!!error}
            fullWidth={fullWidth}
            rows={rows}
          />
          {error && <S.ErrorText>{error.message}</S.ErrorText>}
        </S.Container>
      )}
    />
  );
};

TextareaInput.displayName = 'TextareaInput';
