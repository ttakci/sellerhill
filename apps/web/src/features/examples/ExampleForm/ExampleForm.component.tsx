import { zodResolver } from '@hookform/resolvers/zod';
import { createExampleFormDataSchema, EMPTY_STRING, type CreateExampleFormData } from '@repo/shared';
import { Button, TextInput } from '@repo/ui';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import * as S from './ExampleForm.style';
import { type ExampleFormProps } from './ExampleForm.types';

export const ExampleForm = (props: ExampleFormProps): React.ReactElement => {
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
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
        <TextInput
          name="name"
          control={control}
          label={t('example.nameLabel')}
          placeholder={t('example.namePlaceholder')}
          required
          fullWidth
          size="md"
        />
        <S.HelperText>{t('example.nameHelper')}</S.HelperText>
      </S.FormGroup>

      <S.ButtonGroup>
        <Button variant="primary" disabled={isSubmitting} type="submit" size="md">
          {isSubmitting ? t('example.creatingButton') : t('example.createButton')}
        </Button>
      </S.ButtonGroup>
    </S.Form>
  );
};
