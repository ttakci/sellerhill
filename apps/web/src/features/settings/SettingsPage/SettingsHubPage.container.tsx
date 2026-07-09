/**
 * SettingsHubPage Container (Smart Component)
 * Consolidates profile, ebay, amazon, store-config, blacklist, listing groups,
 * account/security, notifications, plan, and danger zone into single page.
 */

import { useLoading, useUI } from '@repo/ui';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { SettingsHubPageComponent } from './SettingsHubPage.component';
import type { SettingsDrawerKey } from './SettingsHubPage.types';

import { useGetAmazonAccountsQuery } from '@/features/amazon/api/amazon.api';
import { useGetMeQuery } from '@/features/auth/api/authApi';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { useGetListingSettingsGroupsQuery } from '@/features/listing-settings-groups/api/listing-settings-group.api';
import { useGetProfileQuery } from '@/features/profile/api/profileApi';
import { useGetAllStoreSettingsQuery } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';


const DRAWER_PARAM = 'drawer';
const EDIT_GROUP_PARAM = 'editGroup';

export const SettingsHubPageContainer = (): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  const { showMessage, closeMessage } = useUI();
  const { localeNavigate } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeDrawer = (searchParams.get(DRAWER_PARAM) as SettingsDrawerKey) ?? null;
  const editingListingGroupId = searchParams.get(EDIT_GROUP_PARAM);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);

  const { data: user, isLoading: isUserLoading, error: userError } = useGetMeQuery();
  const { data: profile, isLoading: isProfileLoading, error: profileError } = useGetProfileQuery();
  const { data: ebayData, isLoading: isEbayLoading, error: ebayError } = useGetEbayAccountsQuery();
  const { data: amazonData, isLoading: isAmazonLoading, error: amazonError } = useGetAmazonAccountsQuery();
  const { data: listingGroupsData, isLoading: isGroupsLoading, error: groupsError } = useGetListingSettingsGroupsQuery();
  const { data: storeConfigsData, isLoading: isStoreConfigsLoading, error: storeConfigsError } = useGetAllStoreSettingsQuery();

  useLoading(isUserLoading || isProfileLoading || isEbayLoading || isAmazonLoading || isGroupsLoading || isStoreConfigsLoading);

  useEffect(() => {
    const error = userError || profileError || ebayError || amazonError || groupsError || storeConfigsError;
    if (!error) {return;}
    if ('status' in error && error.status === 401) {return;}
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: getErrorI18nKey(error),
        primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
      },
      t,
    );
  }, [userError, profileError, ebayError, amazonError, groupsError, storeConfigsError, showMessage, closeMessage, t]);

  const handleOpenDrawer = (drawer: SettingsDrawerKey): void => {
    const next = new URLSearchParams(searchParams);
    if (drawer) {
      next.set(DRAWER_PARAM, drawer);
    } else {
      next.delete(DRAWER_PARAM);
    }
    setSearchParams(next, { replace: true });
  };

  const handleCloseDrawer = (): void => {
    const next = new URLSearchParams(searchParams);
    next.delete(DRAWER_PARAM);
    next.delete(EDIT_GROUP_PARAM);
    setSearchParams(next, { replace: true });
  };

  const handleEditListingGroup = (id: string): void => {
    const next = new URLSearchParams(searchParams);
    next.set(EDIT_GROUP_PARAM, id);
    next.set(DRAWER_PARAM, 'listingGroupEdit');
    setSearchParams(next, { replace: true });
  };

  const handleNavigateToEbayConnect = (): void => {
    handleCloseDrawer();
    localeNavigate('/ebay/connect');
  };

  const handleOpenDeactivateModal = (): void => setIsDeactivateModalOpen(true);
  const handleCloseDeactivateModal = (): void => setIsDeactivateModalOpen(false);

  const isImpersonatingAdmin = useMemo(() => Boolean(user) && (user as unknown as { role?: string }).role === 'admin', [user]);

  const storeConfigs = useMemo(() => storeConfigsData ?? [], [storeConfigsData]);
  const availableStores = useMemo(
    () =>
      (ebayData?.items ?? []).map((acc) => ({
        id: acc.id,
        name: acc.storeName || acc.sellerId,
      })),
    [ebayData],
  );

  return (
    <SettingsHubPageComponent
      profile={profile ?? null}
      ebayAccounts={ebayData?.items ?? []}
      amazonAccounts={amazonData ?? []}
      listingGroups={listingGroupsData ?? []}
      activeDrawer={activeDrawer}
      onOpenDrawer={handleOpenDrawer}
      onCloseDrawer={handleCloseDrawer}
      editingListingGroupId={editingListingGroupId}
      onEditListingGroup={handleEditListingGroup}
      onNavigateToEbayConnect={handleNavigateToEbayConnect}
      isImpersonatingAdmin={isImpersonatingAdmin}
      isDeactivateModalOpen={isDeactivateModalOpen}
      onOpenDeactivateModal={handleOpenDeactivateModal}
      onCloseDeactivateModal={handleCloseDeactivateModal}
      storeConfigs={storeConfigs}
      availableStores={availableStores}
    />
  );
};
