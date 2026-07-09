/**
 * SettingsHubPage Component (Presentation)
 * Single scrolling page consolidating all settings sections.
 */

import {
  Button,
  Icon,
  PageHeader,
  SettingsActionRow,
  SettingsCard,
  Text,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { DeactivateAccountModal } from '../components/DeactivateAccountModal';
import {
  AmazonAccountDrawer,
  AmazonAccountsDrawer,
  BlacklistAddDrawer,
  BlacklistListDrawer,
  ChangePasswordDrawer,
  EbayAccountDrawer,
  LanguageDrawer,
  ListingGroupDrawer,
  ProfileDrawer,
  StoreSettingsDrawer,
} from '../drawers';

import * as S from './SettingsHubPage.style';
import type { SettingsHubPageComponentProps } from './SettingsHubPage.types';

const AmazonAccountsSection = ({
  onView,
  onAdd,
}: {
  onView: () => void;
  onAdd: () => void;
}): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        icon: 'amazon',
        title: t('translation:settingsHub.sections.amazon.title'),
        subtitle: t('translation:settingsHub.sections.amazon.subtitle'),
      }}
    >
      <SettingsActionRow
        icon="list"
        label={t('translation:settingsHub.sections.amazon.manage.title')}
        onClick={onView}
      />
      <SettingsActionRow
        icon="plus"
        label={t('translation:settingsHub.sections.amazon.add')}
        onClick={onAdd}
      />
    </SettingsCard>
  );
};

const StoreManagementSection = ({
  onAction,
}: {
  onAction: (key: 'storeSettings' | 'blacklistAdd' | 'blacklistList') => void;
}): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  const items: Array<{
    key: 'storeSettings' | 'blacklistAdd' | 'blacklistList';
    icon: string;
    labelKey: string;
  }> = [
    { key: 'storeSettings', icon: 'settings', labelKey: 'translation:settingsHub.sections.storeManagement.storeSettings' },
    { key: 'blacklistAdd', icon: 'plus', labelKey: 'translation:settingsHub.sections.storeManagement.blacklistAdd' },
    { key: 'blacklistList', icon: 'list', labelKey: 'translation:settingsHub.sections.storeManagement.blacklistList' },
  ];
  return (
    <SettingsCard
      variant="section"
      header={{
        icon: 'store',
        title: t('translation:settingsHub.sections.storeManagement.title'),
        subtitle: t('translation:settingsHub.sections.storeManagement.subtitle'),
      }}
    >
      {items.map(({ key, icon, labelKey }) => (
        <SettingsActionRow key={key} icon={icon as never} label={t(labelKey)} onClick={() => onAction(key)} />
      ))}
    </SettingsCard>
  );
};

const ListingGroupsSection = ({
  groups,
  onNew,
  onEdit,
}: {
  groups: SettingsHubPageComponentProps['listingGroups'];
  onNew: () => void;
  onEdit: (id: string) => void;
}): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        icon: 'layers',
        title: t('translation:settingsHub.sections.listingGroups.title'),
        subtitle: t('translation:settingsHub.sections.listingGroups.subtitle'),
      }}
      headerRight={
        <Button variant="text" onClick={onNew}>
          <Text>{t('translation:settingsHub.sections.listingGroups.new')}</Text>
        </Button>
      }
    >
      {groups.length > 0 ? (
        groups.slice(0, 5).map((g) => (
          <S.AccountRow key={g.id}>
            <S.AccountRowInfo>
              <Text variant="body-sm" weight="medium">{g.name}</Text>
              {g.description && <Text variant="caption" color="text.tertiary">{g.description}</Text>}
            </S.AccountRowInfo>
            <Button variant="text" onClick={() => onEdit(g.id)}>
              <Text>{t('translation:settingsHub.sections.listingGroups.edit')}</Text>
            </Button>
          </S.AccountRow>
        ))
      ) : (
        <Text variant="body-sm" color="text.secondary">{t('translation:settingsHub.sections.listingGroups.noGroups')}</Text>
      )}
    </SettingsCard>
  );
};

const AccountSecuritySection = ({
  onAction,
  onDeactivate,}: {
  onAction: (key: 'password' | 'language') => void;
  onDeactivate: () => void;
}): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  const items: Array<{ key: 'password' | 'language'; icon: string; labelKey: string }> = [
    { key: 'password', icon: 'lock', labelKey: 'translation:settingsHub.sections.account.changePassword' },
    { key: 'language', icon: 'globe', labelKey: 'translation:settingsHub.sections.account.language' },
  ];
  return (
    <SettingsCard
      variant="section"
      header={{
        icon: 'shield-check',
        title: t('translation:settingsHub.sections.account.title'),
        subtitle: t('translation:settingsHub.sections.account.subtitle'),
      }}
    >
      {items.map(({ key, icon, labelKey }) => (
        <SettingsActionRow key={key} icon={icon as never} label={t(labelKey)} onClick={() => onAction(key)} />
      ))}
      {/* Deactivate (merged danger zone) — same row geometry as the rows above */}
      <SettingsActionRow
        icon="trash"
        variant="danger"
        label={t('translation:settingsHub.sections.danger.deactivate')}
        onClick={onDeactivate}
      />
    </SettingsCard>
  );
};

const EbaySection = ({
  onConnect,
  onView,
}: {
  onConnect: () => void;
  onView: () => void;
}): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        icon: 'storefront',
        title: t('translation:settingsHub.sections.ebay.title'),
        subtitle: t('translation:settingsHub.sections.ebay.subtitle'),
      }}
    >
      {/* View connected stores */}
      <SettingsActionRow
        icon="list"
        label={t('translation:settingsHub.sections.ebay.manageStores.title')}
        onClick={onView}
      />
      {/* Connect a new eBay store */}
      <SettingsActionRow
        icon="plus"
        label={t('translation:settingsHub.sections.ebay.connectNew.title')}
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
  editingListingGroupId,
  onEditListingGroup,
  onNavigateToEbayConnect,
  isDeactivateModalOpen,
  onOpenDeactivateModal,
  onCloseDeactivateModal,
  storeConfigs,
  availableStores,
}: SettingsHubPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  const displayName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';
  const initials = displayName
    ? displayName.split(' ').slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')
    : '?';

  return (
    <S.Container>
      <PageHeader
        title={t('translation:settingsHub.title')}
        subtitle={t('translation:settingsHub.subtitle')}
      />

      {/* Profile Hero — split: profile left, edit right */}
      <S.ProfileHeroCard>
        <S.ProfileHeroLeft>
          <S.Avatar>{initials}</S.Avatar>
          <S.ProfileHeroInfo>
            <Text variant="h1" weight="bold">{displayName || t('translation:settingsHub.sections.profile.title')}</Text>
            {profile?.email && <Text variant="body-sm" color="text.secondary">{profile.email}</Text>}
          </S.ProfileHeroInfo>
        </S.ProfileHeroLeft>
        <S.ProfileHeroRight
          type="button"
          onClick={() => onOpenDrawer('profile')}
          aria-label={t('translation:settingsHub.sections.profile.tabs.personalInfo')}
        >
          <Text>{t('translation:settingsHub.sections.profile.tabs.personalInfo')}</Text>
          <Icon name="chevron-right" size={18} color="brand.primary" />
        </S.ProfileHeroRight>
      </S.ProfileHeroCard>

      {/* eBay + Amazon accounts — two columns on desktop, single column on mobile */}
      <S.TwoColGrid>
        {/* eBay — connect new store + view existing stores */}
        <EbaySection
          onConnect={onNavigateToEbayConnect}
          onView={() => onOpenDrawer('ebay')}
        />

        {/* Amazon — view connected accounts + add new */}
        <AmazonAccountsSection
          onView={() => onOpenDrawer('amazonList')}
          onAdd={() => onOpenDrawer('amazonAdd')}
        />
      </S.TwoColGrid>

      {/* Listing groups */}
      <ListingGroupsSection
        groups={listingGroups}
        onNew={() => onOpenDrawer('listingGroupNew')}
        onEdit={onEditListingGroup}
      />

      {/* Store configuration — settings, add blacklist, view blacklist */}
      <StoreManagementSection onAction={(key) => onOpenDrawer(key)} />

      {/* Account & Security — change password, language, and deactivate (merged) */}
      <AccountSecuritySection
        onAction={(key) => onOpenDrawer(key)}
        onDeactivate={onOpenDeactivateModal}
      />

      {/* Drawers */}
      <ProfileDrawer isOpen={activeDrawer === 'profile'} onClose={onCloseDrawer} profile={profile ?? undefined} />
      <EbayAccountDrawer
        isOpen={activeDrawer === 'ebay'}
        onClose={onCloseDrawer}
        accounts={ebayAccounts}
        onConnect={onNavigateToEbayConnect}
      />
      <AmazonAccountDrawer isOpen={activeDrawer === 'amazonAdd'} onClose={onCloseDrawer} />
      <AmazonAccountsDrawer
        isOpen={activeDrawer === 'amazonList'}
        onClose={onCloseDrawer}
        accounts={amazonAccounts}
        onAdd={() => onOpenDrawer('amazonAdd')}
      />
      <StoreSettingsDrawer
        isOpen={activeDrawer === 'storeSettings'}
        onClose={onCloseDrawer}
        availableStores={availableStores}
        storeConfigs={storeConfigs}
      />
      <BlacklistAddDrawer
        isOpen={activeDrawer === 'blacklistAdd'}
        onClose={onCloseDrawer}
        availableStores={availableStores}
        storeConfigs={storeConfigs}
      />
      <BlacklistListDrawer
        isOpen={activeDrawer === 'blacklistList'}
        onClose={onCloseDrawer}
        availableStores={availableStores}
        storeConfigs={storeConfigs}
      />
      <ListingGroupDrawer
        isOpen={activeDrawer === 'listingGroupNew' || activeDrawer === 'listingGroupEdit'}
        onClose={onCloseDrawer}
        editingId={activeDrawer === 'listingGroupEdit' ? editingListingGroupId : null}
      />
      <ChangePasswordDrawer isOpen={activeDrawer === 'password'} onClose={onCloseDrawer} />
      <LanguageDrawer isOpen={activeDrawer === 'language'} onClose={onCloseDrawer} />

      {/* Deactivate modal */}
      <DeactivateAccountModal isOpen={isDeactivateModalOpen} onClose={onCloseDeactivateModal} />
    </S.Container>
  );
};

SettingsHubPageComponent.displayName = 'SettingsHubPageComponent';
