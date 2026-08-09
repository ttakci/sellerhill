/**
 * SettingsHubPage Component (Presentation)
 * Single scrolling page consolidating all settings sections.
 * Section cards keep header icons; account rows keep row icons.
 */

import type { ProfileDto } from '@repo/shared';
import { PageHeader, SettingsActionRow, SettingsCard, SettingsInfoRow } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { DeactivateAccountModal } from '../components/DeactivateAccountModal';
import {
  AmazonAccountDrawer,
  AmazonAccountsDrawer,
  BuyerMessageTemplateDrawer,
  BuyerMessageTemplatesDrawer,
  ChangePasswordDrawer,
  EbayAccountDrawer,
  ListingGroupDrawer,
  ListingGroupsDrawer,
  ProfileDrawer,
  StoreSettingsDrawer,
} from '../drawers';

import * as S from './SettingsHubPage.style';
import type { SettingsHubPageComponentProps } from './SettingsHubPage.types';

import { BillingDrawer } from '@/features/billing';

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
        icon: 'user-cog',
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

const AmazonAccountsSection = ({ onView, onAdd }: { onView: () => void; onAdd: () => void }): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        icon: 'shopping-bag',
        title: t('translation:settingsHub.sections.amazon.title'),
      }}
    >
      <SettingsActionRow
        label={t('translation:settingsHub.sections.amazon.manage.title')}
        subtitle={t('translation:settingsHub.sections.amazon.manage.subtitle')}
        onClick={onView}
      />
      <SettingsActionRow
        label={t('translation:settingsHub.sections.amazon.add')}
        subtitle={t('translation:settingsHub.sections.amazon.addSubtitle')}
        onClick={onAdd}
      />
    </SettingsCard>
  );
};

const StoreManagementSection = ({
  onOpenStoreSettings,
  onManageMessageTemplates,
  onCreateMessageTemplate,
}: {
  onOpenStoreSettings: () => void;
  onManageMessageTemplates: () => void;
  onCreateMessageTemplate: () => void;
}): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        icon: 'sliders-horizontal',
        title: t('translation:settingsHub.sections.storeManagement.title'),
      }}
    >
      <SettingsActionRow
        label={t('translation:settingsHub.sections.storeManagement.manageMessageTemplates')}
        subtitle={t('translation:settingsHub.sections.storeManagement.manageMessageTemplatesSubtitle')}
        onClick={onManageMessageTemplates}
      />
      <SettingsActionRow
        label={t('translation:settingsHub.sections.storeManagement.createMessageTemplate')}
        subtitle={t('translation:settingsHub.sections.storeManagement.createMessageTemplateSubtitle')}
        onClick={onCreateMessageTemplate}
      />
      <SettingsActionRow
        label={t('translation:settingsHub.sections.storeManagement.storeSettings')}
        subtitle={t('translation:settingsHub.sections.storeManagement.storeSettingsSubtitle')}
        onClick={onOpenStoreSettings}
      />
    </SettingsCard>
  );
};

const BillingSection = ({ onManage }: { onManage: () => void }): React.ReactElement => {
  const { t } = useTranslation(['translation', 'billing']);
  return (
    <SettingsCard
      variant="section"
      header={{
        icon: 'receipt-text',
        title: t('billing:billing.settingsHub.title'),
      }}
    >
      <SettingsActionRow
        label={t('billing:billing.settingsHub.manage.title')}
        subtitle={t('billing:billing.settingsHub.manage.subtitle')}
        onClick={onManage}
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
        icon: 'layers',
        title: t('translation:settingsHub.sections.listingGroups.title'),
      }}
    >
      <SettingsActionRow
        label={t('translation:settingsHub.sections.listingGroups.manage')}
        subtitle={t('translation:settingsHub.sections.listingGroups.manageSubtitle')}
        onClick={onManage}
      />
      <SettingsActionRow
        label={t('translation:settingsHub.sections.listingGroups.create')}
        subtitle={t('translation:settingsHub.sections.listingGroups.createSubtitle')}
        onClick={onCreate}
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
        icon: 'shield-check',
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

const EbaySection = ({ onConnect, onView }: { onConnect: () => void; onView: () => void }): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        icon: 'storefront',
        title: t('translation:settingsHub.sections.ebay.title'),
      }}
    >
      <SettingsActionRow
        label={t('translation:settingsHub.sections.ebay.manageStores.title')}
        subtitle={t('translation:settingsHub.sections.ebay.manageStores.subtitle')}
        onClick={onView}
      />
      <SettingsActionRow
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
  buyerMessageTemplates,
  editingTemplateId,
  onManageBuyerMessageTemplates,
  onCreateBuyerMessageTemplate,
  onEditBuyerMessageTemplate,
  onBackToBuyerMessageTemplateList,
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
        <EbaySection onConnect={onConnectEbay} onView={() => onOpenDrawer('ebay')} />
      </S.TwoColGrid>

      <S.TwoColGrid>
        <AmazonAccountsSection onView={() => onOpenDrawer('amazonList')} onAdd={() => onOpenDrawer('amazonAdd')} />
        <StoreManagementSection
          onOpenStoreSettings={() => onOpenDrawer('storeSettings')}
          onManageMessageTemplates={onManageBuyerMessageTemplates}
          onCreateMessageTemplate={onCreateBuyerMessageTemplate}
        />
      </S.TwoColGrid>

      <S.TwoColGrid>
        <ListingGroupsSection onManage={onViewAllListingGroups} onCreate={onCreateListingGroup} />
        <BillingSection onManage={() => onOpenDrawer('billing')} />
      </S.TwoColGrid>

      <AccountSecuritySection onAction={(key) => onOpenDrawer(key)} onDeactivate={onOpenDeactivateModal} />

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
      />
      <ChangePasswordDrawer isOpen={activeDrawer === 'password'} onClose={onCloseDrawer} />
      <BillingDrawer isOpen={activeDrawer === 'billing'} onClose={onCloseDrawer} />

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

      <BuyerMessageTemplateDrawer
        isOpen={activeDrawer === 'buyerMessageTemplateCreate' || activeDrawer === 'buyerMessageTemplateEdit'}
        onClose={onCloseDrawer}
        onBack={activeDrawer === 'buyerMessageTemplateEdit' ? onBackToBuyerMessageTemplateList : undefined}
        editingTemplateId={activeDrawer === 'buyerMessageTemplateEdit' ? editingTemplateId : null}
      />
      <BuyerMessageTemplatesDrawer
        isOpen={activeDrawer === 'buyerMessageTemplateList'}
        onClose={onCloseDrawer}
        templates={buyerMessageTemplates}
        onEdit={onEditBuyerMessageTemplate}
      />

      <DeactivateAccountModal isOpen={isDeactivateModalOpen} onClose={onCloseDeactivateModal} />
    </S.Container>
  );
};

SettingsHubPageComponent.displayName = 'SettingsHubPageComponent';
