import { ListingSettingsGroupFormData } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
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
  const [createListingSettingsGroup, { isLoading: isCreating }] = useCreateListingSettingsGroupMutation();
  const [updateListingSettingsGroup, { isLoading: isUpdating }] = useUpdateListingSettingsGroupMutation();

  useLoading(isGroupLoading || isTemplatesLoading);

  const handleSubmit = async (data: ListingSettingsGroupFormData) => {
    try {
      if (isEdit) {
        await updateListingSettingsGroup({ id: id!, data }).unwrap();
        showMessage({ type: 'success', content: t('listingSettingsGroup.success.updated') });
      } else {
        await createListingSettingsGroup(data).unwrap();
        showMessage({ type: 'success', content: t('listingSettingsGroup.success.created') });
      }
      navigate('/settings/listing-groups');
    } catch (error) {
      console.error('Failed to save group:', error);
      showMessage({ type: 'error', content: t('listingSettingsGroup.errors.saveFailed') });
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
