import React from 'react';
import { useForm } from 'react-hook-form';
import { FormElementsPageComponent } from './FormElementsPage.component';
import type { FormElementsFormValues } from './FormElementsPage.types';

const FormElementsPageContainer: React.FC = () => {
  const { control } = useForm<FormElementsFormValues>({
    defaultValues: {
      checkboxDefault: false,
      checkboxSelected: true,
      radioDefault: '1',
      toggleSelected: true,
      selectCountry: 'usa',
    },
  });

  return <FormElementsPageComponent control={control} />;
};

export default FormElementsPageContainer;
