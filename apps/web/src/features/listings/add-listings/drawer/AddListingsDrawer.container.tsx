import { zodResolver } from '@hookform/resolvers/zod';
import {
  PolicyType,
  createListingsSchema,
  parseAsins,
  type CreateListingsFormData,
  type CreateListingsRequest,
} from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useCreateListingsMutation, useGetBusinessPoliciesQuery } from '../../api/listings.api';

import { AddListingsDrawerComponent } from './AddListingsDrawer.component';
import type { AddListingsDrawerProps, AddListingsDrawerStep } from './AddListingsDrawer.types';

import { useGetListingSettingsGroupsQuery } from '@/features/listing-settings-groups/api/listing-settings-group.api';

export const AddListingsDrawer: React.FC<AddListingsDrawerProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation(['listings', 'translation']);
  const { showMessage, closeMessage } = useUI();

  const [currentStep, setCurrentStep] = useState<AddListingsDrawerStep>(0);
  const lastSubmittedAsDraft = useRef(false);

  const { data: listingSettingsGroups = [], isLoading: isLoadingSettings } = useGetListingSettingsGroupsQuery();
  const { data: policiesMap = [], isLoading: isLoadingPolicies } = useGetBusinessPoliciesQuery();

  const [
    createListings,
    { isLoading: isSubmitting, isSuccess, error: submitError, data: submitData, reset: resetMutation },
  ] = useCreateListingsMutation();

  const isLoading = isLoadingSettings || isLoadingPolicies;
  /* useLoading is for BLOCKING MUTATIONS only. The initial query flags used
     to be folded in here, so the global overlay covered the whole app on
     first paint of this page instead of the page showing its own state. */
  useLoading(isSubmitting);

  const form = useForm<CreateListingsFormData>({
    resolver: zodResolver(createListingsSchema(t)) as never,
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: {
      asins: '',
      listingSettingsGroupId: '',
      paymentPolicyId: '',
      shippingPolicyId: '',
      returnPolicyId: '',
      asDraft: false,
    },
  });

  const { reset, control, handleSubmit: rhfSubmit, clearErrors } = form;

  // Reset step + form when drawer opens
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setCurrentStep(0);
      clearErrors();
      reset({
        asins: '',
        listingSettingsGroupId: '',
        paymentPolicyId: '',
        shippingPolicyId: '',
        returnPolicyId: '',
        asDraft: false,
      });
    }
  }

  React.useEffect(() => {
    if (isSuccess && submitData) {
      const wasDraft = lastSubmittedAsDraft.current;
      resetMutation();
      showMessage(
        {
          type: 'info',
          headerKey: 'translation:message.success.header',
          descriptionKey: wasDraft
            ? 'listings:listings.success.queuedDraft'
            : 'listings:listings.success.queued',
          descriptionParams: { count: submitData.totalAsins },
          primaryButton: {
            labelKey: 'translation:message.success.ok',
            onClick: () => {
              closeMessage();
              onClose();
              onSuccess({ asDraft: wasDraft });
            },
          },
        },
        t
      );
    }
  }, [isSuccess, submitData, showMessage, closeMessage, t, onClose, onSuccess, resetMutation]);

  React.useEffect(() => {
    if (submitError) {
      const errorMsg =
        (submitError as { data?: { message?: string } })?.data?.message || 'listings:listings.errors.createFailed';
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

  const businessPolicies = useMemo(
    () => ({
      payment: policiesMap.filter((p) => p.type === PolicyType.PAYMENT),
      shipping: policiesMap.filter((p) => p.type === PolicyType.SHIPPING),
      return: policiesMap.filter((p) => p.type === PolicyType.RETURN),
    }),
    [policiesMap]
  );

  const watchedAsins = useWatch({ control, name: 'asins' });
  const asinCount = useMemo(() => {
    if (!watchedAsins?.trim()) {
      return 0;
    }
    return parseAsins(watchedAsins).length;
  }, [watchedAsins]);

  const handleAsinChange = (value: string) => {
    form.setValue('asins', value, { shouldValidate: false, shouldDirty: true });
  };

  // Soft gate per step — no red field errors until final submit
  const watchedValues = useWatch({ control });
  const canProceed = useMemo(() => {
    if (currentStep === 0) {
      return Boolean(
        watchedValues.listingSettingsGroupId &&
          watchedValues.paymentPolicyId &&
          watchedValues.shippingPolicyId &&
          watchedValues.returnPolicyId
      );
    }
    return asinCount > 0;
  }, [currentStep, watchedValues, asinCount]);

  const handleNext = () => {
    if (currentStep < 1 && canProceed) {
      setCurrentStep(1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(0);
    } else {
      onClose();
    }
  };

  const handleSubmit = () => {
    void rhfSubmit((data: CreateListingsFormData) => {
      lastSubmittedAsDraft.current = Boolean(data.asDraft);
      const cleanData: CreateListingsRequest = {
        asins: parseAsins(data.asins),
        listingSettingsGroupId: data.listingSettingsGroupId,
        paymentPolicyId: data.paymentPolicyId,
        shippingPolicyId: data.shippingPolicyId,
        returnPolicyId: data.returnPolicyId,
        asDraft: Boolean(data.asDraft),
      };
      void createListings(cleanData);
    })();
  };

  return (
    <AddListingsDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      currentStep={currentStep}
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
