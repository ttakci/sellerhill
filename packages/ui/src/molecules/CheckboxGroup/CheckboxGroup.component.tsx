import styled from '@emotion/styled';
import { type FieldValues, Controller } from 'react-hook-form';

import { Checkbox } from '../../atoms/Checkbox';
import { Text } from '../../atoms/Text';
import * as S from '../../styles/Form.style';
import { tkn } from '../../theme/tkn';

import * as LocalS from './CheckboxGroup.style';
import type { CheckboxGroupProps } from './CheckboxGroup.types';

const RequiredAsterisk = styled.span`
  color: ${tkn('colors.semantic.error')};
  margin-left: ${tkn('spacing.xs')};
`;

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
                  {required && <RequiredAsterisk>*</RequiredAsterisk>}
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
