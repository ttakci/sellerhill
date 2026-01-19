import { parseAsins, type CreateListingsRequest } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useGetListingSettingsGroupsQuery } from '../listing-settings-groups/api/listing-settings-group.api';
import { AddListingsPageComponent } from './AddListingsPage.component';
import { useCreateListingsMutation, useGetBusinessPoliciesQuery } from './api/listings.api';

export const AddListingsPageContainer: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showMessage, closeMessage } = useUI();
  const [asins, setAsins] = useState('');
  
  // API Queries
  const { data: listingSettingsGroups = [], isLoading: isLoadingSettings } = useGetListingSettingsGroupsQuery();
  const { data: policiesMap = [], isLoading: isLoadingPolicies } = useGetBusinessPoliciesQuery();
  
  // Create listings mutation
  const [createListings, { isLoading: isSubmitting }] = useCreateListingsMutation();
  
  // Transform business policies into structured object
  const businessPolicies = useMemo(() => ({
    payment: policiesMap.filter(p => p.type === 'payment'),
    shipping: policiesMap.filter(p => p.type === 'shipping'),
    return: policiesMap.filter(p => p.type === 'return'),
  }), [policiesMap]);
  
  const isLoading = isLoadingSettings || isLoadingPolicies;
  
  useLoading(isLoading || isSubmitting);
  
  const asinCount = useMemo(() => {
    if (!asins.trim()) return 0;
    const lines = asins.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    return new Set(lines).size;
  }, [asins]);
  
  const handleSubmit = async (formData: any) => {
    try {
      const data: CreateListingsRequest = {
        ...formData,
        asins: parseAsins(formData.asins),
      };
      const result = await createListings(data).unwrap();
      showMessage({
        type: 'success',
        headerKey: 'message.success.header',
        descriptionKey: 'listings.success.queued',
        descriptionParams: { count: result.totalAsins },
        primaryButton: {
          labelKey: 'message.success.ok',
          onClick: closeMessage,
        },
      }, t);
      // Navigate to listings
      navigate('/listings');
    } catch (error: any) {
      console.error('Failed to create listings:', error);
      showMessage({
        type: 'error',
        headerKey: 'message.error.header',
        descriptionKey: error?.data?.message || 'listings.errors.createFailed',
        primaryButton: {
          labelKey: 'message.error.close',
          onClick: closeMessage,
        },
      }, t);
    }
  };
  
  const handleAsinChange = (value: string) => {
    setAsins(value);
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
    />
  );
};
