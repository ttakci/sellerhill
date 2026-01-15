import type { FieldValues } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Text } from '../../atoms/Text';
import { Toggle } from '../../atoms/Toggle';
import * as S from '../TextInput/TextInput.style';
import type { ToggleInputProps } from './ToggleInput.types';

export const ToggleInput = <TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  label,
  required,
  disabled,
}: ToggleInputProps<TFieldValues>) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value, onChange }, fieldState: { error } }) => (
        <S.Container>
          {label && (
            <S.LabelText>
              <Text variant="body" weight="medium">
                {label}
                {required && <span style={{ color: 'red', marginLeft: 4 }}>*</span>}
              </Text>
            </S.LabelText>
          )}
          <Toggle
            checked={value}
            onChange={onChange}
            disabled={disabled}
          />
          {error && <S.ErrorText>{error.message}</S.ErrorText>}
        </S.Container>
      )}
    />
  );
};

ToggleInput.displayName = 'ToggleInput';
