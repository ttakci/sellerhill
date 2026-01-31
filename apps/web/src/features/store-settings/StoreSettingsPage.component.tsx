import {
  Icon,
  ModernButton,
  ModernSelect,
  ModernTextInput,
  SettingsCard,
  TablePagination,
  Text,
  Toggle,
  useTheme,
} from '@repo/ui';
import React from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import * as S from './StoreSettingsPage.style';
import { StoreSettingsPageProps } from './StoreSettingsPage.types';
import { BlacklistCard } from './components/BlacklistCard';

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
  const { theme } = useTheme();

  const { control, handleSubmit, watch } = form;

  const isGlobal = watch('isGlobal');

  return (
    <S.Container>
      <S.Header>
        <S.HeaderContent>
          <S.PageTitle>{t('storeSettings:storeSettings.title')}</S.PageTitle>
          <Text color="text.secondary">{t('storeSettings:storeSettings.subtitle')}</Text>
        </S.HeaderContent>
        <S.Actions>
          <ModernButton variant="primary" size="medium" onClick={handleSubmit(onSave)} iconLeft="save">
            {t('translation:common.save')}
          </ModernButton>
        </S.Actions>
      </S.Header>

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
              placeholder={t('storeSettings:storeSettings.statePlaceholder')}
            />
            <ModernTextInput
              name="zipCode"
              control={control}
              label={t('storeSettings:storeSettings.zipCode')}
              placeholder={t('storeSettings:storeSettings.zipCodePlaceholder')}
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
              <S.SectionTitle>{t('storeSettings:storeSettings.blacklistSectionTitle')}</S.SectionTitle>
              <Text variant="caption" color="text.secondary">
                {t('storeSettings:storeSettings.blacklistSubtitle')}
              </Text>
            </S.SectionTitleContent>
          </S.BlacklistTitleColumn>
        }
        headerRight={
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
                  { value: 'description', label: t('storeSettings:storeSettings.scope_description').toUpperCase() },
                ]}
                value={newScope}
                onChange={(v) => setNewScope(v as any)}
                size="medium"
                searchPlaceholder={t('translation:common.search')}
                noResultsMessage={t('translation:common.noResults')}
              />
            </S.ScopeActionWrapper>
            <S.AddActionWrapper>
              <ModernButton variant="primary" onClick={onAddKeyword} size="medium" iconLeft="plus" />
            </S.AddActionWrapper>
          </S.BlacklistActionGroup>
        }
      >
        <S.BlacklistContainer>
          <S.BlacklistGrid>
            {pagedBlacklist.map((item) => (
              <BlacklistCard
                key={item.keyword}
                keyword={item.keyword}
                scope={item.scope as any}
                onRemove={() => onRemoveKeyword(item.keyword)}
              />
            ))}
            {pagedBlacklist.length === 0 && (
              <Text color="text.secondary" style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '2rem' }}>
                {t('storeSettings:storeSettings.noKeywords')}
              </Text>
            )}
          </S.BlacklistGrid>

          {blacklistCount > 0 && (
            <TablePagination
              count={blacklistCount}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={setPage}
              onRowsPerPageChange={setRowsPerPage}
              labelRowsPerPage={t('translation:common.rowsPerPage')}
              labelInfo={t('translation:common.showing_info')}
            />
          )}
        </S.BlacklistContainer>
      </SettingsCard>

      <S.Footer>
        <S.FooterLinks>
          <a href="#">{t('translation:menu.support').toUpperCase()}</a>
          <a href="#">{t('translation:common.privacy').toUpperCase()}</a>
          <a href="#">{t('translation:common.support').toUpperCase()}</a>
        </S.FooterLinks>
        <S.Copyright>{t('storeSettings:storeSettings.copyright', { year: new Date().getFullYear() })}</S.Copyright>
      </S.Footer>
    </S.Container>
  );
};
