import { useLoading, useUI } from '@repo/ui';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ListingSettingsGroupPageComponent } from './ListingSettingsGroupPage.component';
import {
    useDeleteListingSettingsGroupMutation,
    useGetListingSettingsGroupsQuery
} from './api/listing-settings-group.api';

export const ListingSettingsGroupPageContainer = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showMessage, closeMessage } = useUI();

  const { data: groups = [], isLoading: isGroupsLoading } = useGetListingSettingsGroupsQuery();
  const [deleteListingSettingsGroup, { isLoading: isDeleting }] = useDeleteListingSettingsGroupMutation();

  useLoading(isGroupsLoading || isDeleting);

  const handleCreateGroup = () => {
    navigate('/settings/listing-groups/new');
  };

  const handleEditGroup = (id: string) => {
    navigate(`/settings/listing-groups/${id}/edit`);
  };

  const handleDeleteGroup = (id: string) => {
    showMessage({
      type: 'error',
      headerKey: 'listingSettingsGroup.confirmDelete',
      descriptionKey: 'listingSettingsGroup.confirmDeleteMessage',
      primaryButton: {
        labelKey: 'common.delete',
        onClick: async () => {
          try {
            await deleteListingSettingsGroup(id).unwrap();
            closeMessage();
            showMessage({
              type: 'success',
              headerKey: 'message.success.header',
              descriptionKey: 'listingSettingsGroup.success.deleted',
              primaryButton: {
                labelKey: 'message.success.ok',
                onClick: closeMessage,
              },
            }, t);
          } catch (error) {
            console.error('Failed to delete group:', error);
          }
        },
      },
      secondaryButton: {
        labelKey: 'common.cancel',
        onClick: closeMessage,
      },
    }, t);
  };

  return (
    <ListingSettingsGroupPageComponent
      groups={groups}
      onCreateGroup={handleCreateGroup}
      onEditGroup={handleEditGroup}
      onDeleteGroup={handleDeleteGroup}
    />
  );
};
