import type { FieldValues } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Select } from '../../atoms/Select';
import { Text } from '../../atoms/Text';
import * as S from '../TextInput/TextInput.style'; // Reusing TextInput styles for container/label
import type { SelectInputProps } from './SelectInput.types';

export const SelectInput = <TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  label,
  options,
  placeholder,
  disabled,
  required,
  fullWidth = true,
  id,
}: SelectInputProps<TFieldValues>) => {
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
          <Select
            {...field}
            id={inputId}
            options={options}
            placeholder={placeholder}
            disabled={disabled}
            hasError={!!error}
            fullWidth={fullWidth}
          />
          {error && <S.ErrorText>{error.message}</S.ErrorText>}
        </S.Container>
      )}
    />
  );
};

SelectInput.displayName = 'SelectInput';
