/**
 * SettingsHubPage Component (Presentation)
 * Single scrolling page consolidating all settings sections.
 */

import { PageHeader, SettingsActionRow, SettingsCard } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { DeactivateAccountModal } from '../components/DeactivateAccountModal';
import {
  AmazonAccountDrawer,
  AmazonAccountsDrawer,
  BlacklistDrawer,
  ChangePasswordDrawer,
  EbayAccountDrawer,
  ListingGroupDrawer,
  ListingGroupsDrawer,
  ProfileDrawer,
  StoreSettingsDrawer,
} from '../drawers';

import * as S from './SettingsHubPage.style';
import type { SettingsHubPageComponentProps } from './SettingsHubPage.types';

const AmazonAccountsSection = ({ onView, onAdd }: { onView: () => void; onAdd: () => void }): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        title: t('translation:settingsHub.sections.amazon.title'),
      }}
    >
      <SettingsActionRow
        icon="list"
        label={t('translation:settingsHub.sections.amazon.manage.title')}
        subtitle={t('translation:settingsHub.sections.amazon.manage.subtitle')}
        onClick={onView}
      />
      <SettingsActionRow
        icon="plus"
        label={t('translation:settingsHub.sections.amazon.add')}
        subtitle={t('translation:settingsHub.sections.amazon.addSubtitle')}
        onClick={onAdd}
      />
    </SettingsCard>
  );
};

const StoreManagementSection = ({ onOpenStoreSettings }: { onOpenStoreSettings: () => void }): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        title: t('translation:settingsHub.sections.storeManagement.title'),
      }}
    >
      {/* Single entry — opens the store settings hub drawer; blacklist is managed
          as a nested flow from within the hub. */}
      <SettingsActionRow
        icon="settings"
        label={t('translation:settingsHub.sections.storeManagement.storeSettings')}
        subtitle={t('translation:settingsHub.sections.storeManagement.storeSettingsSubtitle')}
        onClick={onOpenStoreSettings}
      />
    </SettingsCard>
  );
};

const ListingGroupsSection = ({
  onManage,
  onCreate,
}: {
  onManage: () => void;
  onCreate: () => void;
}): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        title: t('translation:settingsHub.sections.listingGroups.title'),
      }}
    >
      {/* View / manage existing groups — opens the list drawer */}
      <SettingsActionRow
        icon="list"
        label={t('translation:settingsHub.sections.listingGroups.manage')}
        subtitle={t('translation:settingsHub.sections.listingGroups.manageSubtitle')}
        onClick={onManage}
      />
      {/* Create a new group */}
      <SettingsActionRow
        icon="plus"
        label={t('translation:settingsHub.sections.listingGroups.create')}
        subtitle={t('translation:settingsHub.sections.listingGroups.createSubtitle')}
        onClick={onCreate}
      />
    </SettingsCard>
  );
};

const AccountSecuritySection = ({
  onAction,
  onPersonalInfo,
  onDeactivate,
}: {
  onAction: (key: 'password') => void;
  onPersonalInfo: () => void;
  onDeactivate: () => void;
}): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  const items: Array<{ key: 'password'; icon: string; labelKey: string; subtitleKey: string }> = [
    {
      key: 'password',
      icon: 'lock',
      labelKey: 'translation:settingsHub.sections.account.changePassword',
      subtitleKey: 'translation:settingsHub.sections.account.changePasswordSubtitle',
    },
  ];
  return (
    <SettingsCard
      variant="section"
      header={{
        title: t('translation:settingsHub.sections.account.title'),
      }}
    >
      {/* Personal info — opens the profile drawer */}
      <SettingsActionRow
        icon="user"
        label={t('translation:settingsHub.sections.profile.tabs.personalInfo')}
        subtitle={t('translation:settingsHub.sections.profile.tabs.personalInfoSubtitle')}
        onClick={onPersonalInfo}
      />
      {items.map(({ key, icon, labelKey, subtitleKey }) => (
        <SettingsActionRow
          key={key}
          icon={icon as never}
          label={t(labelKey)}
          subtitle={t(subtitleKey)}
          onClick={() => onAction(key)}
        />
      ))}
      {/* Deactivate (merged danger zone) — same row geometry as the rows above */}
      <SettingsActionRow
        icon="trash"
        variant="danger"
        label={t('translation:settingsHub.sections.danger.deactivate')}
        subtitle={t('translation:settingsHub.sections.danger.deactivateDescription')}
        onClick={onDeactivate}
      />
    </SettingsCard>
  );
};

const EbaySection = ({ onConnect, onView }: { onConnect: () => void; onView: () => void }): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        title: t('translation:settingsHub.sections.ebay.title'),
      }}
    >
      {/* View connected stores */}
      <SettingsActionRow
        icon="list"
        label={t('translation:settingsHub.sections.ebay.manageStores.title')}
        subtitle={t('translation:settingsHub.sections.ebay.manageStores.subtitle')}
        onClick={onView}
      />
      {/* Connect a new eBay store */}
      <SettingsActionRow
        icon="plus"
        label={t('translation:settingsHub.sections.ebay.connectNew.title')}
        subtitle={t('translation:settingsHub.sections.ebay.connectNew.subtitle')}
        onClick={onConnect}
      />
    </SettingsCard>
  );
};

export const SettingsHubPageComponent = ({
  profile,
  ebayAccounts,
  amazonAccounts,
  listingGroups,
  activeDrawer,
  onOpenDrawer,
  onCloseDrawer,
  onEditAmazon,
  onEditListingGroup,
  onViewAllListingGroups,
  onCreateListingGroup,
  onConnectEbay,
  isDeactivateModalOpen,
  onOpenDeactivateModal,
  onCloseDeactivateModal,
  storeConfigs,
  availableStores,
  predefinedTemplateNames,
  editingGroupId,
  editingAmazonAccount,
  onBackToAmazonList,
  storeScope,
  onSelectStoreScope,
  onManageBlacklist,
  onBackToStoreSettings,
}: SettingsHubPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['translation']);

  return (
    <S.Container>
      <PageHeader
        noMargin
        title={t('translation:settingsHub.title')}
        subtitle={t('translation:settingsHub.subtitle')}
      />

      {/* eBay + Amazon accounts — two columns on desktop, single column on mobile */}
      <S.TwoColGrid>
        {/* eBay — connect new store + view existing stores */}
        <EbaySection onConnect={onConnectEbay} onView={() => onOpenDrawer('ebay')} />

        {/* Amazon — view connected accounts + add new */}
        <AmazonAccountsSection onView={() => onOpenDrawer('amazonList')} onAdd={() => onOpenDrawer('amazonAdd')} />
      </S.TwoColGrid>

      {/* Store configuration (left) + Listing groups (right) — two columns, stacked on mobile */}
      <S.TwoColGrid>
        <StoreManagementSection onOpenStoreSettings={() => onOpenDrawer('storeSettings')} />
        <ListingGroupsSection onManage={onViewAllListingGroups} onCreate={onCreateListingGroup} />
      </S.TwoColGrid>

      {/* Account & Security — personal info, change password, and deactivate (merged) */}
      <AccountSecuritySection
        onAction={(key) => onOpenDrawer(key)}
        onPersonalInfo={() => onOpenDrawer('profile')}
        onDeactivate={onOpenDeactivateModal}
      />

      {/* Drawers */}
      <ProfileDrawer isOpen={activeDrawer === 'profile'} onClose={onCloseDrawer} profile={profile ?? undefined} />
      <EbayAccountDrawer isOpen={activeDrawer === 'ebay'} onClose={onCloseDrawer} accounts={ebayAccounts} />
      <AmazonAccountDrawer
        isOpen={activeDrawer === 'amazonAdd' || activeDrawer === 'amazonEdit'}
        onClose={onCloseDrawer}
        editingAccount={activeDrawer === 'amazonEdit' ? editingAmazonAccount : null}
        onBack={onBackToAmazonList}
      />
      <AmazonAccountsDrawer
        isOpen={activeDrawer === 'amazonList'}
        onClose={onCloseDrawer}
        accounts={amazonAccounts}
        onEdit={onEditAmazon}
      />
      <StoreSettingsDrawer
        isOpen={activeDrawer === 'storeSettings'}
        onClose={onCloseDrawer}
        availableStores={availableStores}
        storeConfigs={storeConfigs}
        selectedScope={storeScope}
        onSelectScope={onSelectStoreScope}
        onManageBlacklist={onManageBlacklist}
      />
      <BlacklistDrawer
        isOpen={activeDrawer === 'storeBlacklist'}
        onClose={onCloseDrawer}
        onBack={onBackToStoreSettings}
        availableStores={availableStores}
        storeConfigs={storeConfigs}
        selectedScope={storeScope}
      />
      <ChangePasswordDrawer isOpen={activeDrawer === 'password'} onClose={onCloseDrawer} />

      <ListingGroupDrawer
        isOpen={activeDrawer === 'listingGroupCreate' || activeDrawer === 'listingGroupEdit'}
        onClose={onCloseDrawer}
        editingGroupId={activeDrawer === 'listingGroupEdit' ? editingGroupId : null}
      />
      <ListingGroupsDrawer
        isOpen={activeDrawer === 'listingGroupList'}
        onClose={onCloseDrawer}
        groups={listingGroups}
        predefinedTemplateNames={predefinedTemplateNames}
        onEdit={onEditListingGroup}
      />

      {/* Deactivate modal */}
      <DeactivateAccountModal isOpen={isDeactivateModalOpen} onClose={onCloseDeactivateModal} />
    </S.Container>
  );
};

SettingsHubPageComponent.displayName = 'SettingsHubPageComponent';
