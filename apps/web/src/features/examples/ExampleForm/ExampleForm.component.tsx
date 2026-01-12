import { zodResolver } from '@hookform/resolvers/zod';
import { createExampleFormDataSchema, type CreateExampleFormData, EMPTY_STRING } from '@repo/shared';
import { Button, Icon, Input, Label } from '@repo/ui';
import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import * as S from './ExampleForm.style';
import { type ExampleFormProps } from './ExampleForm.types';

export const ExampleForm = (props: ExampleFormProps): React.ReactElement => {
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateExampleFormData>({
    resolver: zodResolver(createExampleFormDataSchema(t)),
    defaultValues: props.defaultValues ?? {
      name: EMPTY_STRING,
    },
  });

  const onSubmit = (data: CreateExampleFormData): void => {
    void (async () => {
      await props.onSubmit(data);
      reset();
    })();
  };

  return (
    <S.Form
      onSubmit={(e) => {
        void handleSubmit(onSubmit)(e);
      }}
    >
      <S.FormGroup>
        <Label required>{t('example.nameLabel')}</Label>
        <S.InputWrapper>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="name"
                type="text"
                placeholder={t('example.namePlaceholder')}
                variant={errors.name ? 'error' : 'default'}
                fullWidth
                size="md"
              />
            )}
          />
        </S.InputWrapper>
        {errors.name ? (
          <S.ErrorMessage>
            <Icon name="alert-circle" size={16} strokeWidth={2} />
            {errors.name.message}
          </S.ErrorMessage>
        ) : (
          <S.HelperText>{t('example.nameHelper')}</S.HelperText>
        )}
      </S.FormGroup>

      <S.ButtonGroup>
        <Button variant="primary" disabled={isSubmitting} type="submit" size="md">
          {isSubmitting ? t('example.creatingButton') : t('example.createButton')}
        </Button>
      </S.ButtonGroup>
    </S.Form>
  );
};
