import type { FieldValues } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Checkbox } from '../../atoms/Checkbox';
import { Text } from '../../atoms/Text';
import * as S from '../TextInput/TextInput.style';
import * as LocalS from './CheckboxGroup.style';
import type { CheckboxGroupProps } from './CheckboxGroup.types';

export const CheckboxGroup = <TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  label,
  options,
  direction = 'vertical',
  required,
  disabled,
}: CheckboxGroupProps<TFieldValues>) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value = [], onChange }, fieldState: { error } }) => {
        const selectedValues = Array.isArray(value) ? (value as string[]) : [];
        
        const handleCheckboxChange = (optionValue: string, checked: boolean) => {
          const newValue = checked
            ? [...selectedValues, optionValue]
            : selectedValues.filter((v: string) => v !== optionValue);
          onChange(newValue);
        };

        return (
          <S.Container>
            {label && (
              <S.LabelText>
                <Text variant="body" weight="medium">
                  {label}
                  {required && <span style={{ color: 'red', marginLeft: 4 }}>*</span>}
                </Text>
              </S.LabelText>
            )}
            <LocalS.OptionsContainer direction={direction}>
              {options.map((option) => (
                <Checkbox
                  key={option.value}
                  label={option.label}
                  checked={selectedValues.includes(option.value)}
                  onChange={(checked) => handleCheckboxChange(option.value, checked)}
                  disabled={disabled}
                />
              ))}
            </LocalS.OptionsContainer>
            {error && <S.ErrorText>{error.message}</S.ErrorText>}
          </S.Container>
        );
      }}
    />
  );
};

CheckboxGroup.displayName = 'CheckboxGroup';
