import { parseAsins, PolicyType, type CreateListingsRequest } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useGetListingSettingsGroupsQuery } from '../../listing-settings-groups/api/listing-settings-group.api';
import { useCreateListingsMutation, useGetBusinessPoliciesQuery } from '../api/listings.api';

import { AddListingsPageComponent } from './AddListingsPage.component';

export const AddListingsPageContainer: React.FC = () => {
  const { t } = useTranslation(['listings', 'translation']);
  const navigate = useNavigate();
  const { showMessage, closeMessage } = useUI();
  const [asins, setAsins] = useState('');
  
  // API Queries
  const { data: listingSettingsGroups = [], isLoading: isLoadingSettings } = useGetListingSettingsGroupsQuery();
  const { data: policiesMap = [], isLoading: isLoadingPolicies } = useGetBusinessPoliciesQuery();
  
  // Create listings mutation
  const [createListings, { isLoading: isSubmitting, isSuccess, error: submitError, data: submitData }] = useCreateListingsMutation();
  
  // Handle success
  React.useEffect(() => {
    if (isSuccess && submitData) {
      showMessage({
        type: 'info',
        headerKey: 'translation:message.success.header',
        descriptionKey: 'listings:listings.success.queued',
        descriptionParams: { count: submitData.totalAsins },
        primaryButton: {
          labelKey: 'translation:message.success.ok',
          onClick: closeMessage,
        },
      }, t);
      // Navigate to listing jobs
      navigate('/listings/jobs');
    }
  }, [isSuccess, submitData, showMessage, closeMessage, t, navigate]);

  // Handle error
  React.useEffect(() => {
    if (submitError) {
      console.error('Failed to create listings:', submitError);
      const errorMsg = (submitError as any)?.data?.message || 'listings:listings.errors.createFailed';
      showMessage({
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: errorMsg,
        primaryButton: {
          labelKey: 'translation:message.error.close',
          onClick: closeMessage,
        },
      }, t);
    }
  }, [submitError, showMessage, closeMessage, t]);
  
  // Transform business policies into structured object
  const businessPolicies = useMemo(() => ({
    payment: policiesMap.filter(p => p.type === PolicyType.PAYMENT),
    shipping: policiesMap.filter(p => p.type === PolicyType.SHIPPING),
    return: policiesMap.filter(p => p.type === PolicyType.RETURN),
  }), [policiesMap]);
  
  const isLoading = isLoadingSettings || isLoadingPolicies;
  
  useLoading(isLoading || isSubmitting);
  
  const asinCount = useMemo(() => {
    if (!asins.trim()) {return 0;}
    const lines = asins.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    return new Set(lines).size;
  }, [asins]);
  
  const handleSubmit = (formData: any) => {
    const data: CreateListingsRequest = {
      ...formData,
      asins: parseAsins(formData.asins),
    };
    void createListings(data);
  };
  
  const handleAsinChange = (value: string) => {
    setAsins(value);
  };
  
  const handleCancel = () => {
    navigate('/listings');
  };

  return (
    <AddListingsPageComponent
      asins={asins}
      asinCount={asinCount}
      listingSettingsGroups={listingSettingsGroups}
      businessPolicies={businessPolicies}
      isLoading={isLoading}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
      onAsinChange={handleAsinChange}
      onCancel={handleCancel}
    />
  );
};
