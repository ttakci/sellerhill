/**
 * SettingsHubPage Container (Smart Component)
 * Consolidates profile, ebay, amazon, store-config, blacklist, listing groups,
 * account/security, notifications, plan, and danger zone into single page.
 */

import { AmazonAccountStatus, EBAY_MARKETPLACE } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { GLOBAL_SCOPE } from '../drawers/storeScope';

import { SettingsHubPageComponent } from './SettingsHubPage.component';
import type { SettingsDrawerKey } from './SettingsHubPage.types';

import { useGetAmazonAccountsQuery } from '@/features/amazon/api/amazon.api';
import { useGetMeQuery } from '@/features/auth/api/authApi';
import { useGetBuyerMessageTemplatesQuery } from '@/features/buyer-messaging/api/buyer-messaging.api';
import { useGetEbayAccountsQuery, useLazyGetEbayConnectUrlQuery } from '@/features/ebay/api/ebayApi';
import {
  useGetListingSettingsGroupsQuery,
  useGetPredefinedTemplatesQuery,
} from '@/features/listing-settings-groups/api/listing-settings-group.api';
import { useGetProfileQuery } from '@/features/profile/api/profileApi';
import { useGetAllStoreSettingsQuery } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';


const DRAWER_PARAM = 'drawer';

export const SettingsHubPageContainer = (): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  const { showMessage, closeMessage } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeDrawer = (searchParams.get(DRAWER_PARAM) as SettingsDrawerKey) ?? null;
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingAmazonId, setEditingAmazonId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  // Shared store-settings scope — hub + nested blacklist drawer stay in sync via this.
  const [storeScope, setStoreScope] = useState<string>(GLOBAL_SCOPE);

  const { data: user, error: userError } = useGetMeQuery();
  const { data: profile, error: profileError } = useGetProfileQuery();
  const { data: ebayData, error: ebayError } = useGetEbayAccountsQuery();
  const {
    data: amazonData,
    error: amazonError,
    refetch: refetchAmazonAccounts,
  } = useGetAmazonAccountsQuery();

  // While any Amazon account is mid-verification, poll so the card resolves
  // to active/invalid without a manual refresh.
  const amazonHasVerifying = amazonData?.some(
    (a) => a.status === AmazonAccountStatus.VERIFYING,
  );
  useEffect(() => {
    if (!amazonHasVerifying) {
      return;
    }
    const id = setInterval(() => {
      void refetchAmazonAccounts();
    }, 5000);
    return () => clearInterval(id);
  }, [amazonHasVerifying, refetchAmazonAccounts]);
  const { data: listingGroupsData, error: groupsError } = useGetListingSettingsGroupsQuery();
  // Reuses the RTK-Query-cached predefined templates (same hook the edit form uses);
  // resolves each group's predefinedTemplateId to its display name. Not a new endpoint.
  const { data: predefinedTemplatesData } = useGetPredefinedTemplatesQuery();
  const { data: storeConfigsData, error: storeConfigsError } = useGetAllStoreSettingsQuery();
  const { data: buyerMessageTemplatesData, error: buyerMessageTemplatesError } = useGetBuyerMessageTemplatesQuery();
  // Lazy: only fires when the user clicks "Connect". Fetches the eBay OAuth consent URL.
  const [getConnectUrl, { isLoading: isConnectLoading, error: connectError }] = useLazyGetEbayConnectUrlQuery();

  /* useLoading is for BLOCKING MUTATIONS only. The initial query flags used
     to be folded in here, so the global overlay covered the whole app on
     first paint of this page instead of the page showing its own state. */
  useLoading(isConnectLoading);

  useEffect(() => {
    const error = userError || profileError || ebayError || amazonError || groupsError || storeConfigsError || connectError || buyerMessageTemplatesError;
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
  }, [userError, profileError, ebayError, amazonError, groupsError, storeConfigsError, connectError, buyerMessageTemplatesError, showMessage, closeMessage, t]);

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
    setSearchParams(next, { replace: true });
  };

  // Listing groups — open the list drawer (cards inside); create/edit open
  // their own drawer flows. The single activeDrawer param closes this list
  // automatically when edit/create opens.
  const handleViewAllListingGroups = (): void => {
    handleOpenDrawer('listingGroupList');
  };

  const handleCreateListingGroup = (): void => {
    setEditingGroupId(null);
    handleOpenDrawer('listingGroupCreate');
  };

  const handleEditListingGroup = (id: string): void => {
    setEditingGroupId(id);
    handleOpenDrawer('listingGroupEdit');
  };

  // Amazon accounts — open the list drawer (cards inside); clicking a card opens
  // the edit flow, the "Add" action opens the create flow. Back from edit/create
  // returns to the list. The single activeDrawer param closes the list when the
  // edit/create drawer opens, and vice-versa.
  const handleEditAmazon = (id: string): void => {
    setEditingAmazonId(id);
    handleOpenDrawer('amazonEdit');
  };

  const handleBackToAmazonList = (): void => {
    setEditingAmazonId(null);
    handleOpenDrawer('amazonList');
  };

  // Buyer message templates — open the list drawer (cards inside); create/edit
  // open their own drawer flow. The single activeDrawer param closes this list
  // automatically when edit/create opens.
  const handleManageBuyerMessageTemplates = (): void => {
    handleOpenDrawer('buyerMessageTemplateList');
  };

  const handleCreateBuyerMessageTemplate = (): void => {
    setEditingTemplateId(null);
    handleOpenDrawer('buyerMessageTemplateCreate');
  };

  const handleEditBuyerMessageTemplate = (id: string): void => {
    setEditingTemplateId(id);
    handleOpenDrawer('buyerMessageTemplateEdit');
  };

  const handleBackToBuyerMessageTemplateList = (): void => {
    setEditingTemplateId(null);
    handleOpenDrawer('buyerMessageTemplateList');
  };

  // Store settings flow: hub (location/validation) → nested blacklist management.
  // The shared storeScope is preserved across the navigation so both drawers
  // operate on the same scope.
  const handleManageBlacklist = (): void => {
    handleOpenDrawer('storeBlacklist');
  };

  const handleBackToStoreSettings = (): void => {
    handleOpenDrawer('storeSettings');
  };

  // Connect directly from settings — no intermediate page. Same inline pattern as
  // OnboardingEbayPage: fetch eBay OAuth consent URL, redirect the browser there.
  const handleConnectEbay = (): void => {
    handleCloseDrawer();
    void getConnectUrl({ marketplaceId: EBAY_MARKETPLACE.US })
      .unwrap()
      .then((result) => {
        window.location.href = result.url;
      });
  };

  const handleOpenDeactivateModal = (): void => setIsDeactivateModalOpen(true);
  const handleCloseDeactivateModal = (): void => setIsDeactivateModalOpen(false);

  const isImpersonatingAdmin = useMemo(() => Boolean(user) && (user as unknown as { role?: string }).role === 'admin', [user]);

  const storeConfigs = useMemo(() => storeConfigsData ?? [], [storeConfigsData]);
  const predefinedTemplateNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tpl of predefinedTemplatesData ?? []) {
      map[tpl.id] = tpl.name;
    }
    return map;
  }, [predefinedTemplatesData]);
  const availableStores = useMemo(
    () =>
      (ebayData?.items ?? []).map((acc) => ({
        id: acc.id,
        name: acc.storeName || acc.sellerId,
      })),
    [ebayData],
  );
  const editingAmazonAccount = useMemo(
    () => (amazonData ?? []).find((acc) => acc.id === editingAmazonId) ?? null,
    [amazonData, editingAmazonId],
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
      onEditListingGroup={handleEditListingGroup}
      onEditAmazon={handleEditAmazon}
      onViewAllListingGroups={handleViewAllListingGroups}
      onCreateListingGroup={handleCreateListingGroup}
      onConnectEbay={handleConnectEbay}
      isImpersonatingAdmin={isImpersonatingAdmin}
      isDeactivateModalOpen={isDeactivateModalOpen}
      onOpenDeactivateModal={handleOpenDeactivateModal}
      onCloseDeactivateModal={handleCloseDeactivateModal}
      storeConfigs={storeConfigs}
      availableStores={availableStores}
      predefinedTemplateNames={predefinedTemplateNames}
      editingGroupId={editingGroupId}
      editingAmazonAccount={editingAmazonAccount}
      onBackToAmazonList={handleBackToAmazonList}
      storeScope={storeScope}
      onSelectStoreScope={setStoreScope}
      onManageBlacklist={handleManageBlacklist}
      onBackToStoreSettings={handleBackToStoreSettings}
      buyerMessageTemplates={buyerMessageTemplatesData ?? []}
      editingTemplateId={editingTemplateId}
      onManageBuyerMessageTemplates={handleManageBuyerMessageTemplates}
      onCreateBuyerMessageTemplate={handleCreateBuyerMessageTemplate}
      onEditBuyerMessageTemplate={handleEditBuyerMessageTemplate}
      onBackToBuyerMessageTemplateList={handleBackToBuyerMessageTemplateList}
    />
  );
};
