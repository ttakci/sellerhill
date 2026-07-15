import { zodResolver } from '@hookform/resolvers/zod';
import {
  PolicyType,
  createListingsSchema,
  parseAsins,
  type CreateListingsFormData,
  type CreateListingsRequest,
} from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useCreateListingsMutation, useGetBusinessPoliciesQuery } from '../../api/listings.api';

import { AddListingsDrawerComponent } from './AddListingsDrawer.component';
import type { AddListingsDrawerProps, AddListingsDrawerStep } from './AddListingsDrawer.types';

import { useGetListingSettingsGroupsQuery } from '@/features/listing-settings-groups/api/listing-settings-group.api';

const STEP_FIELDS: Record<AddListingsDrawerStep, string[]> = {
  0: ['listingSettingsGroupId', 'paymentPolicyId', 'shippingPolicyId', 'returnPolicyId'],
  1: ['asins'],
};

export const AddListingsDrawer: React.FC<AddListingsDrawerProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation(['listings', 'translation']);
  const { showMessage, closeMessage } = useUI();

  const [currentStep, setCurrentStep] = useState<AddListingsDrawerStep>(0);

  const { data: listingSettingsGroups = [], isLoading: isLoadingSettings } = useGetListingSettingsGroupsQuery();
  const { data: policiesMap = [], isLoading: isLoadingPolicies } = useGetBusinessPoliciesQuery();

  const [
    createListings,
    { isLoading: isSubmitting, isSuccess, error: submitError, data: submitData, reset: resetMutation },
  ] = useCreateListingsMutation();

  const isLoading = isLoadingSettings || isLoadingPolicies;
  useLoading(isLoading || isSubmitting);

  const form = useForm<CreateListingsFormData>({
    resolver: zodResolver(createListingsSchema(t)) as any,
    defaultValues: {
      asins: '',
      listingSettingsGroupId: '',
      paymentPolicyId: '',
      shippingPolicyId: '',
      returnPolicyId: '',
    },
  });

  const { reset, control, trigger, handleSubmit: rhfSubmit } = form;

  // Reset step when drawer opens
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setCurrentStep(0);
      reset({
        asins: '',
        listingSettingsGroupId: '',
        paymentPolicyId: '',
        shippingPolicyId: '',
        returnPolicyId: '',
      });
    }
  }

  // Handle success
  React.useEffect(() => {
    if (isSuccess && submitData) {
      resetMutation();
      showMessage(
        {
          type: 'info',
          headerKey: 'translation:message.success.header',
          descriptionKey: 'listings:listings.success.queued',
          descriptionParams: { count: submitData.totalAsins },
          primaryButton: {
            labelKey: 'translation:message.success.ok',
            onClick: () => {
              closeMessage();
              onClose();
              onSuccess();
            },
          },
        },
        t
      );
    }
  }, [isSuccess, submitData, showMessage, closeMessage, t, onClose, onSuccess, resetMutation]);

  // Handle error
  React.useEffect(() => {
    if (submitError) {
      const errorMsg = (submitError as any)?.data?.message || 'listings:listings.errors.createFailed';
      resetMutation();
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey: errorMsg,
          primaryButton: {
            labelKey: 'translation:message.error.close',
            onClick: closeMessage,
          },
        },
        t
      );
    }
  }, [submitError, showMessage, closeMessage, t, resetMutation]);

  // Transform business policies
  const businessPolicies = useMemo(
    () => ({
      payment: policiesMap.filter((p) => p.type === PolicyType.PAYMENT),
      shipping: policiesMap.filter((p) => p.type === PolicyType.SHIPPING),
      return: policiesMap.filter((p) => p.type === PolicyType.RETURN),
    }),
    [policiesMap]
  );

  // ASIN count
  const watchedAsins = useWatch({ control, name: 'asins' });
  const asinCount = useMemo(() => {
    if (!watchedAsins?.trim()) {
      return 0;
    }
    const parsed = parseAsins(watchedAsins);
    return parsed.length;
  }, [watchedAsins]);

  const handleAsinChange = (value: string) => {
    form.setValue('asins', value, { shouldValidate: true });
  };

  // Step validation
  const [canProceed, setCanProceed] = useState(true);
  const watchedValues = useWatch({ control });
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void (async () => {
      const fieldsToValidate = STEP_FIELDS[currentStep];
      const valid = await trigger(fieldsToValidate as any, { shouldFocus: false });
      setCanProceed(valid);
    })();
  }, [currentStep, watchedValues, trigger, isOpen]);

  const handleNext = () => {
    if (currentStep < 1) {
      setCurrentStep((currentStep + 1) as AddListingsDrawerStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((currentStep - 1) as AddListingsDrawerStep);
    } else {
      onClose();
    }
  };

  const handleStepChange = (step: AddListingsDrawerStep) => {
    setCurrentStep(step);
  };

  const handleSubmit = () => {
    void rhfSubmit((data: CreateListingsFormData) => {
      const cleanData: CreateListingsRequest = {
        ...data,
        asins: parseAsins(data.asins),
      };
      void createListings(cleanData);
    })();
  };

  return (
    <AddListingsDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      currentStep={currentStep}
      onStepChange={handleStepChange}
      isSubmitting={isSubmitting}
      isLoading={isLoading}
      form={form}
      listingSettingsGroups={listingSettingsGroups}
      businessPolicies={businessPolicies}
      asinCount={asinCount}
      onAsinChange={handleAsinChange}
      onNext={handleNext}
      onBack={handleBack}
      onSubmit={handleSubmit}
      canProceed={canProceed}
    />
  );
};
