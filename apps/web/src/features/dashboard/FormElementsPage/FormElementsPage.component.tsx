import {
    CheckboxGroup,
    RadioGroup,
    SelectInput,
    Text,
    TextInput,
    TextareaInput,
    ToggleInput,
} from '@repo/ui';
import React from 'react';
import * as S from './FormElementsPage.style';
import type { FormElementsPageProps } from './FormElementsPage.types';

export const FormElementsPageComponent: React.FC<FormElementsPageProps> = ({ control }) => {
  return (
    <S.Container>
      <Text variant="h3" weight="bold">
        Form Elements
      </Text>

      <S.Grid>
        {/* Input Fields */}
        <S.Card>
          <S.CardHeader>
            <Text variant="body" weight="medium">
              Input Fields
            </Text>
          </S.CardHeader>
          <S.CardBody>
            <TextInput
              name="textDefault"
              control={control}
              label="Default Input"
              placeholder="Default Input"
            />
            <TextInput
              name="textActive"
              control={control}
              label="Active Input"
              placeholder="Active Input"
            />
            <TextInput
              name="textDisabled"
              control={control}
              label="Disabled Input"
              placeholder="Disabled Input"
              disabled
            />
          </S.CardBody>
        </S.Card>

        {/* Toggle switch */}
        <S.Card>
          <S.CardHeader>
            <Text variant="body" weight="medium">
              Toggle switch
            </Text>
          </S.CardHeader>
          <S.CardBody>
            <ToggleInput name="toggleDefault" control={control} label="Toggle Switch 1" />
            <ToggleInput name="toggleSelected" control={control} label="Toggle Switch 2" />
            <ToggleInput name="toggleDisabled" control={control} label="Toggle Switch 3" disabled />
          </S.CardBody>
        </S.Card>

        {/* Select Input */}
        <S.Card>
          <S.CardHeader>
            <Text variant="body" weight="medium">
              Select Input
            </Text>
          </S.CardHeader>
          <S.CardBody>
            <SelectInput
              name="selectCountry"
              control={control}
              label="Select Country"
              options={[
                { label: 'USA', value: 'usa' },
                { label: 'UK', value: 'uk' },
                { label: 'Canada', value: 'canada' },
              ]}
              placeholder="Select your country"
            />
            <SelectInput
              name="selectDisabled"
              control={control}
              label="Disabled Select"
              options={[]}
              disabled
              placeholder="Disabled"
            />
          </S.CardBody>
        </S.Card>

        {/* Checkbox and Radio */}
        <S.Card>
          <S.CardHeader>
            <Text variant="body" weight="medium">
              Checkbox and Radio
            </Text>
          </S.CardHeader>
          <S.CardBody>
            <CheckboxGroup
              name="checkboxDefault"
              control={control}
              label="Checkbox Group"
              options={[
                { label: 'Option 1', value: '1' },
                { label: 'Option 2', value: '2' },
                { label: 'Option 3', value: '3' },
              ]}
              direction="horizontal"
            />
            <RadioGroup
              name="radioDefault"
              control={control}
              label="Radio Group"
              options={[
                { label: 'Option 1', value: '1' },
                { label: 'Option 2', value: '2' },
                { label: 'Option 3', value: '3' },
              ]}
              direction="horizontal"
            />
          </S.CardBody>
        </S.Card>

        {/* Textarea */}
        <S.Card>
          <S.CardHeader>
            <Text variant="body" weight="medium">
              Textarea
            </Text>
          </S.CardHeader>
          <S.CardBody>
            <TextareaInput
              name="textareaDefault"
              control={control}
              label="Default Textarea"
              placeholder="Enter your message"
            />
            <TextareaInput
              name="textareaDisabled"
              control={control}
              label="Disabled Textarea"
              placeholder="Disabled"
              disabled
            />
          </S.CardBody>
        </S.Card>

        {/* Input Groups */}
        <S.Card>
          <S.CardHeader>
            <Text variant="body" weight="medium">
              Input Groups
            </Text>
          </S.CardHeader>
          <S.CardBody>
            <TextInput
              name="textIconLeft"
              control={control}
              label="Left Icon"
              placeholder="Icon Left"
              leftIcon="user"
            />
            <TextInput
              name="textIconRight"
              control={control}
              label="Right Icon"
              placeholder="Icon Right"
              rightIcon="eye"
            />
            <TextInput
              name="textPrefix"
              control={control}
              label="Prefix"
              placeholder="Prefix"
              prefix="HTTPS://"
            />
            <TextInput
              name="textSuffix"
              control={control}
              label="Suffix"
              placeholder="Suffix"
              suffix=".com"
            />
          </S.CardBody>
        </S.Card>
      </S.Grid>
    </S.Container>
  );
};
