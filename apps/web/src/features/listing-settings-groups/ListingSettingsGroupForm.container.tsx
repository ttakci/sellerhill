import { ListingSettingsGroupFormData } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ListingSettingsGroupFormComponent } from './ListingSettingsGroupForm.component';
import {
    useCreateListingSettingsGroupMutation,
    useGetListingSettingsGroupByIdQuery,
    useGetPredefinedTemplatesQuery,
    useUpdateListingSettingsGroupMutation
} from './api/listing-settings-group.api';

export const ListingSettingsGroupFormContainer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('listingSettingsGroup');
  const { showMessage } = useUI();
  const isEdit = !!id;

  const { data: group, isLoading: isGroupLoading } = useGetListingSettingsGroupByIdQuery(id!, { skip: !isEdit });
  const { data: templates = [], isLoading: isTemplatesLoading } = useGetPredefinedTemplatesQuery();
  const [createListingSettingsGroup, { isLoading: isCreating, isSuccess: createSuccess, isError: createError }] = useCreateListingSettingsGroupMutation();
  const [updateListingSettingsGroup, { isLoading: isUpdating, isSuccess: updateSuccess, isError: updateError }] = useUpdateListingSettingsGroupMutation();

  useLoading(isGroupLoading || isTemplatesLoading);

  // Handle success
  React.useEffect(() => {
    if (createSuccess || updateSuccess) {
      showMessage({
        type: 'success',
        headerKey: 'translation:message.success.header',
        descriptionKey: createSuccess ? 'listingSettingsGroup:listingSettingsGroup.success.created' : 'listingSettingsGroup:listingSettingsGroup.success.updated',
      }, t);
      navigate('/settings/listing-groups');
    }
  }, [createSuccess, updateSuccess, showMessage, t, navigate]);

  // Handle error
  React.useEffect(() => {
    if (createError || updateError) {
      showMessage({
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: 'listingSettingsGroup:listingSettingsGroup.errors.saveFailed',
      }, t);
    }
  }, [createError, updateError, showMessage, t]);

  const handleSubmit = (data: ListingSettingsGroupFormData) => {
    if (isEdit) {
      void updateListingSettingsGroup({ id: id!, data });
    } else {
      void createListingSettingsGroup(data);
    }
  };

  const handleCancel = () => {
    navigate('/settings/listing-groups');
  };

  return (
    <ListingSettingsGroupFormComponent
      isEdit={isEdit}
      defaultValues={group}
      predefinedTemplates={templates}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isLoading={isCreating || isUpdating}
    />
  );
};
