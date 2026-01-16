import { ListingSettingsGroupFormData } from '@repo/shared';
import { useLoading } from '@repo/ui';
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
  const { t } = useTranslation();
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
      } else {
        await createListingSettingsGroup(data).unwrap();
      }
      navigate('/settings/listing-groups');
    } catch (error) {
      console.error('Failed to save group:', error);
    }
  };

  const handleCancel = () => {
    navigate('/settings/listing-groups');
  };

  return (
    <ListingSettingsGroupFormComponent
      defaultValues={group}
      predefinedTemplates={templates}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isLoading={isCreating || isUpdating}
    />
  );
};
