/**
 * SettingsHubPage Component (Presentation)
 * Single scrolling page consolidating all settings sections.
 * Section cards keep header icons; account rows keep row icons.
 */

import type { ProfileDto } from '@repo/shared';
import { InfoMessage, PageHeader, SettingsActionRow, SettingsCard, SettingsInfoRow } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { DeactivateAccountModal } from '../components/DeactivateAccountModal';
import {
  AmazonAccountDrawer,
  AmazonAccountsAllDrawer,
  AmazonAccountsDrawer,
  BlacklistDrawer,
  BuyerMessageTemplateDrawer,
  BuyerMessageTemplatesAllDrawer,
  BuyerMessageTemplatesDrawer,
  ChangePasswordDrawer,
  EbayAccountsAllDrawer,
  EbayAccountsDrawer,
  ListingGroupDrawer,
  ListingGroupsAllDrawer,
  ListingGroupsDrawer,
  ProfileDrawer,
  StoreSettingsDrawer,
} from '../drawers';

import * as S from './SettingsHubPage.style';
import type { SettingsHubPageComponentProps } from './SettingsHubPage.types';

const PersonalInfoSection = ({
  profile,
  onEdit,
}: {
  profile: ProfileDto | null;
  onEdit: () => void;
}): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  const editAriaLabel = t('translation:settingsHub.sections.profile.edit');
  const nameValue =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || t('translation:common.notProvided');
  const phoneValue = profile?.phoneNumber?.trim() || t('translation:common.notProvided');
  const emailValue = profile?.email || t('translation:common.notProvided');
  return (
    <SettingsCard
      variant="section"
      header={{
        title: t('translation:settingsHub.sections.profile.tabs.personalInfo'),
      }}
    >
      <SettingsInfoRow
        icon="user"
        label={t('translation:settingsHub.sections.profile.nameLabel')}
        value={nameValue}
        onEdit={onEdit}
        editAriaLabel={editAriaLabel}
      />
      <SettingsInfoRow
        icon="phone"
        label={t('translation:settingsHub.sections.profile.phoneLabel')}
        value={phoneValue}
        onEdit={onEdit}
        editAriaLabel={editAriaLabel}
      />
      <SettingsInfoRow
        icon="mail"
        label={t('translation:settingsHub.sections.profile.emailLabel')}
        value={emailValue}
        onEdit={onEdit}
        editAriaLabel={editAriaLabel}
      />
    </SettingsCard>
  );
};

const AccountsSection = ({
  onOpenEbay,
  onOpenAmazon,
}: {
  onOpenEbay: () => void;
  onOpenAmazon: () => void;
}): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        title: t('translation:settingsHub.sections.accounts.title'),
      }}
    >
      <SettingsActionRow
        icon="storefront"
        label={t('translation:settingsHub.sections.accounts.ebay.title')}
        subtitle={t('translation:settingsHub.sections.accounts.ebay.subtitle')}
        onClick={onOpenEbay}
      />
      <SettingsActionRow
        icon="shopping-bag"
        label={t('translation:settingsHub.sections.accounts.amazon.title')}
        subtitle={t('translation:settingsHub.sections.accounts.amazon.subtitle')}
        onClick={onOpenAmazon}
      />
    </SettingsCard>
  );
};

const StoreManagementSection = ({
  onOpenStoreSettings,
  onOpenMessageTemplates,
  onManageBlacklist,
}: {
  onOpenStoreSettings: () => void;
  onOpenMessageTemplates: () => void;
  onManageBlacklist: () => void;
}): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        title: t('translation:settingsHub.sections.storeManagement.title'),
      }}
    >
      <SettingsActionRow
        icon="message-circle"
        label={t('translation:settingsHub.sections.storeManagement.manageMessageTemplates')}
        subtitle={t('translation:settingsHub.sections.storeManagement.manageMessageTemplatesSubtitle')}
        onClick={onOpenMessageTemplates}
      />
      <SettingsActionRow
        icon="block"
        label={t('translation:settingsHub.sections.storeManagement.manageBlacklist')}
        subtitle={t('translation:settingsHub.sections.storeManagement.manageBlacklistSubtitle')}
        onClick={onManageBlacklist}
      />
      <SettingsActionRow
        icon="sliders-horizontal"
        label={t('translation:settingsHub.sections.storeManagement.storeSettings')}
        subtitle={t('translation:settingsHub.sections.storeManagement.storeSettingsSubtitle')}
        onClick={onOpenStoreSettings}
      />
      <S.SectionInfoMessage>
        <InfoMessage>{t('translation:settingsHub.sections.storeManagement.infoMessage')}</InfoMessage>
      </S.SectionInfoMessage>
    </SettingsCard>
  );
};

const ListingGroupsSection = ({ onManage }: { onManage: () => void }): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        title: t('translation:settingsHub.sections.listingGroups.title'),
      }}
    >
      <SettingsActionRow
        icon="layers"
        label={t('translation:settingsHub.sections.listingGroups.manage')}
        subtitle={t('translation:settingsHub.sections.listingGroups.manageSubtitle')}
        onClick={onManage}
      />
    </SettingsCard>
  );
};

const AccountSecuritySection = ({
  onAction,
  onDeactivate,
}: {
  onAction: (key: 'password') => void;
  onDeactivate: () => void;
}): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        title: t('translation:settingsHub.sections.account.title'),
      }}
    >
      <SettingsActionRow
        icon="lock"
        label={t('translation:settingsHub.sections.account.changePassword')}
        subtitle={t('translation:settingsHub.sections.account.changePasswordSubtitle')}
        onClick={() => onAction('password')}
      />
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
  ebayMarketplaceOptions,
  selectedEbayMarketplace,
  onEbayMarketplaceChange,
  isDeactivateModalOpen,
  onOpenDeactivateModal,
  onCloseDeactivateModal,
  storeConfigs,
  availableStores,
  predefinedTemplateNames,
  editingGroupId,
  editingAmazonAccount,
  storeScope,
  onSelectStoreScope,
  onManageBlacklist,
  onBackToStoreSettings,
  buyerMessageTemplates,
  editingTemplateId,
  onEditBuyerMessageTemplate,
}: SettingsHubPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['translation']);

  return (
    <S.Container>
      <PageHeader
        noMargin
        title={t('translation:settingsHub.title')}
        subtitle={t('translation:settingsHub.subtitle')}
      />

      <S.TwoColGrid>
        <PersonalInfoSection profile={profile ?? null} onEdit={() => onOpenDrawer('profile')} />
        <AccountsSection
          onOpenEbay={() => onOpenDrawer('ebayAccounts')}
          onOpenAmazon={() => onOpenDrawer('amazonAccounts')}
        />
      </S.TwoColGrid>

      <S.TwoColGrid>
        <StoreManagementSection
          onOpenStoreSettings={() => onOpenDrawer('storeSettings')}
          onOpenMessageTemplates={() => onOpenDrawer('buyerMessageTemplates')}
          onManageBlacklist={onManageBlacklist}
        />
        <S.ColumnStack>
          <ListingGroupsSection onManage={onViewAllListingGroups} />
          <AccountSecuritySection onAction={(key) => onOpenDrawer(key)} onDeactivate={onOpenDeactivateModal} />
        </S.ColumnStack>
      </S.TwoColGrid>

      <ProfileDrawer isOpen={activeDrawer === 'profile'} onClose={onCloseDrawer} profile={profile ?? undefined} />
      <EbayAccountsDrawer
        isOpen={activeDrawer === 'ebayAccounts'}
        onClose={onCloseDrawer}
        accounts={ebayAccounts}
        onConnectNew={onConnectEbay}
        onViewAll={() => onOpenDrawer('ebayAccountsAll')}
        marketplaceOptions={ebayMarketplaceOptions}
        selectedMarketplace={selectedEbayMarketplace}
        onMarketplaceChange={onEbayMarketplaceChange}
      />
      <EbayAccountsAllDrawer
        isOpen={activeDrawer === 'ebayAccountsAll'}
        onClose={onCloseDrawer}
        onBack={() => onOpenDrawer('ebayAccounts')}
        accounts={ebayAccounts}
      />
      <AmazonAccountDrawer
        isOpen={activeDrawer === 'amazonAdd' || activeDrawer === 'amazonEdit'}
        onClose={onCloseDrawer}
        editingAccount={activeDrawer === 'amazonEdit' ? editingAmazonAccount : null}
        onBack={() => onOpenDrawer('amazonAccounts')}
      />
      <AmazonAccountsDrawer
        isOpen={activeDrawer === 'amazonAccounts'}
        onClose={onCloseDrawer}
        accounts={amazonAccounts}
        onAddNew={() => onOpenDrawer('amazonAdd')}
        onViewAll={() => onOpenDrawer('amazonAccountsAll')}
        onEdit={onEditAmazon}
      />
      <AmazonAccountsAllDrawer
        isOpen={activeDrawer === 'amazonAccountsAll'}
        onClose={onCloseDrawer}
        onBack={() => onOpenDrawer('amazonAccounts')}
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
        onCreate={onCreateListingGroup}
        onViewAll={() => onOpenDrawer('listingGroupsAll')}
      />
      <ListingGroupsAllDrawer
        isOpen={activeDrawer === 'listingGroupsAll'}
        onClose={onCloseDrawer}
        onBack={() => onOpenDrawer('listingGroupList')}
        groups={listingGroups}
        predefinedTemplateNames={predefinedTemplateNames}
        onEdit={onEditListingGroup}
      />

      <BuyerMessageTemplateDrawer
        isOpen={activeDrawer === 'buyerMessageTemplateCreate' || activeDrawer === 'buyerMessageTemplateEdit'}
        onClose={onCloseDrawer}
        onBack={() => onOpenDrawer('buyerMessageTemplates')}
        editingTemplateId={activeDrawer === 'buyerMessageTemplateEdit' ? editingTemplateId : null}
      />
      <BuyerMessageTemplatesDrawer
        isOpen={activeDrawer === 'buyerMessageTemplates'}
        onClose={onCloseDrawer}
        templates={buyerMessageTemplates}
        onEdit={onEditBuyerMessageTemplate}
        onCreate={() => onOpenDrawer('buyerMessageTemplateCreate')}
        onViewAll={() => onOpenDrawer('buyerMessageTemplatesAll')}
      />
      <BuyerMessageTemplatesAllDrawer
        isOpen={activeDrawer === 'buyerMessageTemplatesAll'}
        onClose={onCloseDrawer}
        onBack={() => onOpenDrawer('buyerMessageTemplates')}
        templates={buyerMessageTemplates}
        onEdit={onEditBuyerMessageTemplate}
      />

      <DeactivateAccountModal isOpen={isDeactivateModalOpen} onClose={onCloseDeactivateModal} />
    </S.Container>
  );
};

SettingsHubPageComponent.displayName = 'SettingsHubPageComponent';
