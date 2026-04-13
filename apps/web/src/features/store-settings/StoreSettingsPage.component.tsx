import {
  DataTable,
  Icon,
  IconButton,
  Button,
  ModernSelect,
  ModernTextInput,
  PageHeader,
  SettingsCard,
  Text,
  Toggle,
} from '@repo/ui';
import React from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { BlacklistCard } from './components/BlacklistCard';
import * as S from './StoreSettingsPage.style';
import { StoreSettingsPageProps } from './StoreSettingsPage.types';

export const StoreSettingsPageComponent = ({
  settings,
  onSave,
  onStoreChange,
  availableStores,
  form,
  newKeyword,
  setNewKeyword,
  newScope,
  setNewScope,
  onAddKeyword,
  onRemoveKeyword,
  pagedBlacklist,
  page,
  setPage,
  rowsPerPage,
  setRowsPerPage,
  onSort,
  sortColumn,
  sortDirection,
  blacklistCount,
}: StoreSettingsPageProps): React.ReactElement => {
  const { t } = useTranslation(['storeSettings', 'translation']);

  const { control, handleSubmit, watch } = form;

  const isGlobal = watch('isGlobal');

  const columns = [
    {
      key: 'keyword',
      header: t('storeSettings:storeSettings.blacklistKeyword'),
      sortable: true,
      render: (value: string) => (
        <Text weight="semibold" color="text.primary">
          {value}
        </Text>
      ),
    },
    {
      key: 'scope',
      header: t('storeSettings:storeSettings.scope'),
      sortable: true,
      render: (value: string) => (
        <S.BadgeWrapper>
          <S.StatusBadge status={value} size="sm">{t(`storeSettings:storeSettings.scope_${value}`).toUpperCase()}</S.StatusBadge>
        </S.BadgeWrapper>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (_: any, item: { keyword: string }) => (
        <IconButton variant="ghost" onClick={() => onRemoveKeyword(item.keyword)} aria-label={t('translation:common.delete')}>
          <Icon name="trash" size={18} />
        </IconButton>
      ),
    },
  ];

  const renderGridCard = (item: any) => (
    <BlacklistCard
      key={item.keyword}
      keyword={item.keyword}
      scope={item.scope }
      onRemove={() => onRemoveKeyword(item.keyword)}
    />
  );

  const blacklistToolbarLeft = (
    <S.BlacklistActionGroup>
      <S.BlacklistInputWrapper>
        <ModernTextInput
          name="newKeyword"
          label={t('storeSettings:storeSettings.blacklistKeyword')}
          value={newKeyword}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKeyword(e.target.value)}
          size="medium"
        />
      </S.BlacklistInputWrapper>
      <S.ScopeActionWrapper>
        <ModernSelect
          options={[
            { value: 'both', label: t('storeSettings:storeSettings.scope_both').toUpperCase() },
            { value: 'title', label: t('storeSettings:storeSettings.scope_title').toUpperCase() },
            {
              value: 'description',
              label: t('storeSettings:storeSettings.scope_description').toUpperCase(),
            },
          ]}
          value={newScope}
          onChange={(v) => setNewScope(v as any)}
          size="medium"
          searchPlaceholder={t('translation:common.search')}
          noResultsMessage={t('translation:common.noResults')}
        />
      </S.ScopeActionWrapper>
      <S.AddActionWrapper>
        <Button variant="primary" onClick={onAddKeyword} size="medium" iconLeft="plus" />
      </S.AddActionWrapper>
    </S.BlacklistActionGroup>
  );

  const pagination = blacklistCount > 0 ? {
    count: blacklistCount,
    page,
    rowsPerPage,
    onPageChange: setPage,
    onRowsPerPageChange: setRowsPerPage,
    labelRowsPerPage: t('translation:common.rowsPerPage'),
    labelInfo: t('translation:common.showing_info'),
  } : undefined;

  return (
    <S.Container>
      <PageHeader
        title={t('storeSettings:storeSettings.title')}
        subtitle={<Text color="text.secondary">{t('storeSettings:storeSettings.subtitle')}</Text>}
        actions={
          <Button variant="primary" size="medium" onClick={handleSubmit(onSave)} iconLeft="save">
            {t('translation:common.save')}
          </Button>
        }
      />

      <SettingsCard
        variant="panel"
        headerLeft={
          <S.SwitchGroup>
            <Controller
              name="isGlobal"
              control={control}
              render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} />}
            />
            <S.SwitchLabelContent>
              <Text weight="bold" color="text.primary">
                {t('storeSettings:storeSettings.globalSettings')}
              </Text>
              <Text variant="caption" color="text.secondary">
                {t('storeSettings:storeSettings.globalDescription').split('.')[0]}
              </Text>
            </S.SwitchLabelContent>
          </S.SwitchGroup>
        }
        headerRight={
          <S.StoreSelectWrapper $disabled={isGlobal}>
            <ModernSelect
              label={t('storeSettings:storeSettings.selectStore')}
              options={availableStores.map((s) => ({ value: s.id, label: s.name }))}
              value={settings.storeId || ''}
              onChange={(val) => onStoreChange(val as string)}
              fullWidth
              isDisabled={isGlobal}
              searchPlaceholder={t('translation:common.search')}
              noResultsMessage={t('translation:common.noResults')}
            />
          </S.StoreSelectWrapper>
        }
      />

      <S.GlobalGrid>
        <SettingsCard
          variant="section"
          header={{
            icon: 'map-pin',
            title: t('storeSettings:storeSettings.locationSectionTitle'),
            subtitle: t('storeSettings:storeSettings.locationSectionSubtitle'),
          }}
        >
          <S.LocationColumnGrid>
            <ModernSelect
              name="country"
              control={control}
              label={t('storeSettings:storeSettings.country')}
              options={[
                { value: 'TR', label: 'Turkey (TR)' },
                { value: 'US', label: 'United States (US)' },
              ]}
            />
            <ModernTextInput
              name="state"
              control={control}
              label={t('storeSettings:storeSettings.state')}
            />
            <ModernTextInput
              name="zipCode"
              control={control}
              label={t('storeSettings:storeSettings.zipCode')}
            />
          </S.LocationColumnGrid>
        </SettingsCard>

        <SettingsCard
          variant="section"
          header={{
            icon: 'check-list',
            title: t('storeSettings:storeSettings.validationSectionTitle'),
            subtitle: t('storeSettings:storeSettings.validationSectionSubtitle'),
          }}
        >
          <S.ValidationList>
            <Controller
              name="validateTitle"
              control={control}
              render={({ field }) => (
                <S.SwitchItem>
                  <S.SwitchLabelContent>
                    <Text weight="semibold">{t('storeSettings:storeSettings.validateTitle')}</Text>
                    <Text variant="caption" color="text.secondary">
                      {t('storeSettings:storeSettings.validateTitleDesc')}
                    </Text>
                  </S.SwitchLabelContent>
                  <Toggle checked={field.value} onChange={field.onChange} />
                </S.SwitchItem>
              )}
            />
            <Controller
              name="validateDescription"
              control={control}
              render={({ field }) => (
                <S.SwitchItem>
                  <S.SwitchLabelContent>
                    <Text weight="semibold">{t('storeSettings:storeSettings.validateDescription')}</Text>
                    <Text variant="caption" color="text.secondary">
                      {t('storeSettings:storeSettings.validateDescriptionDesc')}
                    </Text>
                  </S.SwitchLabelContent>
                  <Toggle checked={field.value} onChange={field.onChange} />
                </S.SwitchItem>
              )}
            />
          </S.ValidationList>
        </SettingsCard>
      </S.GlobalGrid>

      <SettingsCard
        variant="panel"
        headerLeft={
          <S.BlacklistTitleColumn>
            <S.HeaderIconWrapper $type="blacklist">
              <Icon name="block" size={20} />
            </S.HeaderIconWrapper>
            <S.SectionTitleContent>
              <S.SectionTitle variant="h3" weight="bold">{t('storeSettings:storeSettings.blacklistSectionTitle')}</S.SectionTitle>
              <Text variant="caption" color="text.secondary">
                {t('storeSettings:storeSettings.blacklistSubtitle')}
              </Text>
            </S.SectionTitleContent>
          </S.BlacklistTitleColumn>
        }
      >
        <DataTable
          columns={columns}
          data={pagedBlacklist}
          renderGridCard={renderGridCard}
          emptyMessage={t('storeSettings:storeSettings.noKeywords')}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={onSort}
          toolbarLeft={blacklistToolbarLeft}
          pagination={pagination}
        />
      </SettingsCard>
    </S.Container>
  );
};
