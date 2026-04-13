import { useLoading, useUI } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
    useDeleteListingSettingsGroupMutation,
    useGetListingSettingsGroupsQuery
} from './api/listing-settings-group.api';
import { ListingSettingsGroupPageComponent } from './ListingSettingsGroupPage.component';

export const ListingSettingsGroupPageContainer = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['listingSettingsGroup', 'translation']);
  const { showMessage, closeMessage } = useUI();

  const { data: groups = [], isLoading: isGroupsLoading } = useGetListingSettingsGroupsQuery();
  const [deleteListingSettingsGroup, { isLoading: isDeleting, isSuccess: deleteSuccess }] = useDeleteListingSettingsGroupMutation();

  useLoading(isGroupsLoading || isDeleting);

  // Handle delete success
  React.useEffect(() => {
    if (deleteSuccess) {
      showMessage({
        type: 'success',
        headerKey: 'translation:message.success.header',
        descriptionKey: 'listingSettingsGroup:listingSettingsGroup.success.deleted',
        primaryButton: {
          labelKey: 'translation:message.success.ok',
          onClick: closeMessage,
        },
      }, t);
    }
  }, [deleteSuccess, showMessage, closeMessage, t]);

  const handleCreateGroup = () => {
    navigate('/settings/listing-groups/new');
  };

  const handleEditGroup = (id: string) => {
    navigate(`/settings/listing-groups/${id}/edit`);
  };

  const handleDeleteGroup = (id: string) => {
    showMessage({
      type: 'error',
      headerKey: 'listingSettingsGroup:listingSettingsGroup.confirmDelete',
      descriptionKey: 'listingSettingsGroup:listingSettingsGroup.confirmDeleteMessage',
      primaryButton: {
        labelKey: 'translation:common.delete',
        onClick: () => {
          void deleteListingSettingsGroup(id);
          closeMessage();
        },
      },
      secondaryButton: {
        labelKey: 'translation:common.cancel',
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
