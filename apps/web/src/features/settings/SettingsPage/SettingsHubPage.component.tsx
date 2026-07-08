/**
 * SettingsHubPage Component (Presentation)
 * Single scrolling page consolidating all settings sections.
 */

import {
  Button,
  Card,
  CardBody,
  Icon,
  PageHeader,
  SettingsCard,
  StatusBadge,
  Text,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  AmazonAccountDrawer,
  ApiAccessDrawer,
  ChangePasswordDrawer,
  EbayAccountDrawer,
  LanguageDrawer,
  ListingGroupDrawer,
  NotificationsDrawer,
  ProfileDrawer,
  StoreConfigDrawer,
  TwoFactorDrawer,
} from '../drawers';

import * as S from './SettingsHubPage.style';
import type { SettingsHubPageComponentProps } from './SettingsHubPage.types';

const AmazonAccountsSection = ({
  accounts,
  onAdd,
}: {
  accounts: SettingsHubPageComponentProps['amazonAccounts'];
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
      headerRight={
        <Button variant="text" onClick={onAdd}>
          <Text>{t('translation:settingsHub.sections.amazon.add')}</Text>
        </Button>
      }
    >
      {accounts.length > 0 ? (
        accounts.slice(0, 3).map((acc) => (
          <S.AccountRow key={acc.id}>
            <S.AccountRowInfo>
              <Text variant="body-sm" weight="medium">{acc.label || acc.email}</Text>
              {acc.label && <Text variant="caption" color="text.tertiary">{acc.email}</Text>}
            </S.AccountRowInfo>
            <StatusBadge status={acc.status} size="sm" />
          </S.AccountRow>
        ))
      ) : (
        <Text variant="body-sm" color="text.secondary">{t('translation:settingsHub.sections.amazon.noAccounts')}</Text>
      )}
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
            <Button variant="text" size="sm" onClick={() => onEdit(g.id)}>
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

const AccountSecuritySection = ({ onAction }: { onAction: (key: 'password' | 'twoFactor' | 'apiAccess' | 'language') => void }): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  const items: Array<{ key: 'password' | 'twoFactor' | 'apiAccess' | 'language'; icon: string; labelKey: string }> = [
    { key: 'password', icon: 'lock', labelKey: 'translation:settingsHub.sections.account.changePassword' },
    { key: 'twoFactor', icon: 'shield-check', labelKey: 'translation:settingsHub.sections.account.twoFactor' },
    { key: 'apiAccess', icon: 'key', labelKey: 'translation:settingsHub.sections.account.apiAccess' },
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
        <S.AccountActionRow key={key} onClick={() => onAction(key)}>
          <S.AccountActionRowInfo>
            <Icon name={icon as never} size={18} color="text.secondary" />
            <Text variant="body-sm" weight="medium">{t(labelKey)}</Text>
          </S.AccountActionRowInfo>
          <Icon name="chevron-right" size={18} color="text.tertiary" />
        </S.AccountActionRow>
      ))}
    </SettingsCard>
  );
};

const PlanSection = ({ onManage }: { onManage: () => void }): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        icon: 'star',
        title: t('translation:settingsHub.sections.plan.title'),
        subtitle: t('translation:settingsHub.sections.plan.subtitle'),
      }}
      headerRight={
        <Button variant="text" onClick={onManage}>
          <Text>{t('translation:settingsHub.sections.plan.manage')}</Text>
        </Button>
      }
    >
      <S.MetaGrid>
        <S.MetaItem>
          <Text variant="caption" color="text.tertiary">{t('translation:settingsHub.sections.plan.currentPlan')}</Text>
          <Text variant="body-sm" weight="semibold">{t('translation:settingsHub.sections.profile.plan')}</Text>
        </S.MetaItem>
      </S.MetaGrid>
    </SettingsCard>
  );
};

const DangerZoneSection = ({ onDeactivate }: { onDeactivate: () => void }): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <S.DangerNotice>
      <Text variant="body-sm" weight="semibold" color="semantic.error">
        {t('translation:settingsHub.sections.danger.title')}
      </Text>
      <Text variant="caption" color="text.secondary">
        {t('translation:settingsHub.sections.danger.subtitle')}
      </Text>
      <div>
        <Button variant="danger" onClick={onDeactivate}>
          <Text>{t('translation:settingsHub.sections.danger.deactivate')}</Text>
        </Button>
      </div>
    </S.DangerNotice>
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

      {/* Profile Hero */}
      <S.ProfileHeroCard>
        <S.Avatar>{initials}</S.Avatar>
        <S.ProfileHeroInfo>
          <Text variant="h1" weight="bold">{displayName || t('translation:settingsHub.sections.profile.title')}</Text>
          {profile?.email && <Text variant="body-sm" color="text.secondary">{profile.email}</Text>}
        </S.ProfileHeroInfo>
        <S.ProfileHeroActions>
          <S.ProfileNavItem
            type="button"
            onClick={() => onOpenDrawer('profile')}
            aria-label={t('translation:settingsHub.sections.profile.tabs.personalInfo')}
          >
            <Text>{t('translation:settingsHub.sections.profile.tabs.personalInfo')}</Text>
            <Icon name="chevron-right" size={22} color="brand.primary" />
          </S.ProfileNavItem>
          <S.ProfileNavItem
            type="button"
            onClick={() => onOpenDrawer('ebay')}
            aria-label={t('translation:settingsHub.sections.ebay.title')}
          >
            <Text>{t('translation:settingsHub.sections.ebay.title')}</Text>
            <Icon name="chevron-right" size={22} color="brand.primary" />
          </S.ProfileNavItem>
        </S.ProfileHeroActions>
      </S.ProfileHeroCard>

      {/* Amazon row (eBay moved to profile hero nav item) */}
      <AmazonAccountsSection accounts={amazonAccounts} onAdd={() => onOpenDrawer('amazonAdd')} />

      {/* Store config + Listing groups row */}
      <S.TwoColGrid>
        <SettingsCard
          variant="section"
          header={{
            icon: 'map-pin',
            title: t('translation:settingsHub.sections.storeConfig.title'),
            subtitle: t('translation:settingsHub.sections.storeConfig.subtitle'),
          }}
          headerRight={
            <Button variant="text" onClick={() => onOpenDrawer('storeConfig')}>
              <Text>{t('translation:settingsHub.sections.storeConfig.edit')}</Text>
            </Button>
          }
        >
          <Text variant="body-sm" color="text.secondary">
            {t('translation:settingsHub.sections.storeConfig.subtitle')}
          </Text>
        </SettingsCard>

        <ListingGroupsSection
          groups={listingGroups}
          onNew={() => onOpenDrawer('listingGroupNew')}
          onEdit={onEditListingGroup}
        />
      </S.TwoColGrid>

      {/* Account & Security + Notifications */}
      <S.TwoColGrid>
        <AccountSecuritySection onAction={(key) => onOpenDrawer(key)} />
        <SettingsCard
          variant="section"
          header={{
            icon: 'bell',
            title: t('translation:settingsHub.sections.notifications.title'),
            subtitle: t('translation:settingsHub.sections.notifications.subtitle'),
          }}
          headerRight={
            <Button variant="text" onClick={() => onOpenDrawer('notifications')}>
              <Text>{t('translation:settingsHub.sections.notifications.edit')}</Text>
            </Button>
          }
        >
          <Text variant="body-sm" color="text.secondary">
            {t('translation:settingsHub.sections.notifications.subtitle')}
          </Text>
        </SettingsCard>
      </S.TwoColGrid>

      {/* Plan + Danger */}
      <S.TwoColGrid>
        <PlanSection onManage={() => onOpenDrawer('apiAccess')} />
        <Card variant="bordered">
          <CardBody>
            <DangerZoneSection onDeactivate={() => onOpenDrawer('apiAccess')} />
          </CardBody>
        </Card>
      </S.TwoColGrid>

      {/* Drawers */}
      <ProfileDrawer isOpen={activeDrawer === 'profile'} onClose={onCloseDrawer} profile={profile} />
      <EbayAccountDrawer
        isOpen={activeDrawer === 'ebay'}
        onClose={onCloseDrawer}
        accounts={ebayAccounts}
        onConnect={onNavigateToEbayConnect}
      />
      <AmazonAccountDrawer isOpen={activeDrawer === 'amazonAdd'} onClose={onCloseDrawer} />
      <StoreConfigDrawer isOpen={activeDrawer === 'storeConfig'} onClose={onCloseDrawer} />
      <ListingGroupDrawer
        isOpen={activeDrawer === 'listingGroupNew' || activeDrawer === 'listingGroupEdit'}
        onClose={onCloseDrawer}
        editingId={activeDrawer === 'listingGroupEdit' ? editingListingGroupId : null}
      />
      <ChangePasswordDrawer isOpen={activeDrawer === 'password'} onClose={onCloseDrawer} />
      <TwoFactorDrawer isOpen={activeDrawer === 'twoFactor'} onClose={onCloseDrawer} />
      <ApiAccessDrawer isOpen={activeDrawer === 'apiAccess'} onClose={onCloseDrawer} />
      <LanguageDrawer isOpen={activeDrawer === 'language'} onClose={onCloseDrawer} />
      <NotificationsDrawer isOpen={activeDrawer === 'notifications'} onClose={onCloseDrawer} />
    </S.Container>
  );
};

SettingsHubPageComponent.displayName = 'SettingsHubPageComponent';
