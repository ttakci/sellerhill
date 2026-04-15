import { type FieldValues, Controller } from 'react-hook-form';

import { Radio } from '../../atoms/Radio';
import { Text } from '../../atoms/Text';
import * as S from '../../styles/Form.style';
import * as LocalS from '../CheckboxGroup/CheckboxGroup.style'; // Reusing options container style

import type { RadioGroupProps } from './RadioGroup.types';

export const RadioGroup = <TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  label,
  options,
  direction = 'vertical',
  required,
  disabled,
}: RadioGroupProps<TFieldValues>) => {
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
                {required && <span style={{ color: 'red', marginLeft: '0.25rem' }}>*</span>}
              </Text>
            </S.LabelText>
          )}
          <LocalS.OptionsContainer direction={direction}>
            {options.map((option) => (
              <Radio
                key={option.value}
                label={option.label}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                disabled={disabled}
                name={name}
              />
            ))}
          </LocalS.OptionsContainer>
          {error && <S.ErrorText>{error.message}</S.ErrorText>}
        </S.Container>
      )}
    />
  );
};

RadioGroup.displayName = 'RadioGroup';
