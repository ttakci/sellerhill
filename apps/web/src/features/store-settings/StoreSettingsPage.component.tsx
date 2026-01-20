import {
  Badge,
  Button,
  Card,
  CardBody,
  Icon,
  Select,
  Table,
  TablePagination,
  Text,
  TextInput,
  Toggle,
  useTheme
} from '@repo/ui';
import React from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

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
  const { theme } = useTheme();

  const {
    control,
    handleSubmit,
    watch,
  } = form;

  const isGlobal = watch('isGlobal');

  const blacklistColumns = [
    {
      key: 'keyword',
      header: t('storeSettings:storeSettings.keyword'),
      sortable: true,
      render: (value: any) => <Text weight="medium" color="text.primary">{value}</Text>,
    },
    {
      key: 'scope',
      header: t('storeSettings:storeSettings.scope'),
      sortable: true,
      render: (value: any) => {
        const variantMap: Record<string, 'primary' | 'secondary'> = {
          both: 'primary',
          title: 'secondary',
        };
        return (
          <Badge variant={variantMap[value] || 'secondary'} size="sm">
            {t(`storeSettings:storeSettings.scope_${value}`).toUpperCase()}
          </Badge>
        );
      },
    },
    {
      key: 'date',
      header: t('storeSettings:storeSettings.addedDate'),
      render: () => <Text variant="caption" color="text.secondary">12 May 2024</Text>,
    },
    {
      key: 'actions',
      header: t('storeSettings:storeSettings.actions'),
      align: 'right' as const,
      render: (_: any, __: any, index: number) => (
        <S.IconAction onClick={() => onRemoveKeyword(index)}>
          <Icon name="trash" size={18} />
        </S.IconAction>
      ),
    },
  ];

  return (
    <S.Container>
      <S.Header>
        <S.HeaderContent>
          <S.PageTitle>
            {t('storeSettings:storeSettings.title')}
          </S.PageTitle>
          <Text color="text.secondary">
            {t('storeSettings:storeSettings.subtitle')}
          </Text>
        </S.HeaderContent>
        <S.Actions>
          <Button variant="secondary" size="md">
            {t('translation:common.cancel')}
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit(onSave)}>
            <Icon name="check-circle" size={18} />
            {t('storeSettings:storeSettings.saveChanges')}
          </Button>
        </S.Actions>
      </S.Header>

      <S.GlobalSettingsCard>
        <S.GlobalBanner>
          <S.SwitchGroup>
            <Controller
              name="isGlobal"
              control={control}
              render={({ field }) => (
                <Toggle
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <S.SwitchLabelContent>
              <Text weight="bold" color="text.primary">{t('storeSettings:storeSettings.globalSettings')}</Text>
              <Text variant="caption" color="text.secondary">
                {t('storeSettings:storeSettings.globalDescription').split('.')[0]}
              </Text>
            </S.SwitchLabelContent>
          </S.SwitchGroup>

          <S.StoreSelectWrapper $disabled={isGlobal}>
            <S.StoreLabel>{t('storeSettings:storeSettings.selectStore').toUpperCase()}</S.StoreLabel>
            <Select
              options={availableStores.map(s => ({ value: s.id, label: s.name }))}
              value={settings.storeId || ''}
              onChange={(val) => onStoreChange(val)}
              fullWidth
              disabled={isGlobal}
              placeholder={t('storeSettings:storeSettings.selectStorePlaceholder')}
            />
          </S.StoreSelectWrapper>
        </S.GlobalBanner>
      </S.GlobalSettingsCard>

      <S.GlobalGrid>
        <Card variant="bordered" className="custom-shadow">
          <S.SectionHeader>
            <S.HeaderIconWrapper $type="location">
              <Icon name="map-pin" size={20} />
            </S.HeaderIconWrapper>
            <S.SectionTitleContent>
              <S.SectionTitle>{t('storeSettings:storeSettings.locationSectionTitle')}</S.SectionTitle>
              <Text variant="caption" color="text.secondary">{t('storeSettings:storeSettings.locationSectionSubtitle')}</Text>
            </S.SectionTitleContent>
          </S.SectionHeader>
          <CardBody>
            <S.PaddingContainer>
              <S.AddressGrid>
                <Controller
                  name="country"
                  control={control}
                  render={({ field }) => (
                    <S.InputGroup>
                      <S.InputLabel>{t('storeSettings:storeSettings.country')}</S.InputLabel>
                      <Select
                        options={[{ value: 'TR', label: 'Turkey (TR)' }, { value: 'US', label: 'United States (US)' }]}
                        value={field.value}
                        onChange={field.onChange}
                        fullWidth
                      />
                    </S.InputGroup>
                  )}
                />
                <TextInput
                  name="state"
                  control={control}
                  label={t('storeSettings:storeSettings.state')}
                  placeholder="İstanbul"
                />
              </S.AddressGrid>
              
              <TextInput
                name="zipCode"
                control={control}
                label={t('storeSettings:storeSettings.zipCode')}
                placeholder="34000"
              />

              <S.InputGroup>
                 <S.InputLabel>{t('storeSettings:storeSettings.address')}</S.InputLabel>
                 <S.TextArea placeholder={t('storeSettings:storeSettings.addressPlaceholder')} />
              </S.InputGroup>
            </S.PaddingContainer>
          </CardBody>
        </Card>

        <Card variant="bordered" className="custom-shadow">
          <S.SectionHeader>
            <S.HeaderIconWrapper $type="validation">
              <Icon name="validation" size={20} />
            </S.HeaderIconWrapper>
            <S.SectionTitleContent>
              <S.SectionTitle>{t('storeSettings:storeSettings.validationSectionTitle')}</S.SectionTitle>
              <Text variant="caption" color="text.secondary">{t('storeSettings:storeSettings.validationSectionSubtitle')}</Text>
            </S.SectionTitleContent>
          </S.SectionHeader>
          <CardBody>
            <S.PaddingContainer>
              <S.ValidationList>
                <Controller
                  name="validateTitle"
                  control={control}
                  render={({ field }) => (
                    <S.SwitchItem>
                      <S.SwitchLabelContent>
                        <Text weight="semibold">{t('storeSettings:storeSettings.validateTitle')}</Text>
                        <Text variant="caption" color="text.secondary">{t('storeSettings:storeSettings.validateTitleDesc')}</Text>
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
                        <Text variant="caption" color="text.secondary">{t('storeSettings:storeSettings.validateDescriptionDesc')}</Text>
                      </S.SwitchLabelContent>
                      <Toggle checked={field.value} onChange={field.onChange} />
                    </S.SwitchItem>
                  )}
                />
                <S.SwitchItem>
                  <S.SwitchLabelContent>
                    <Text weight="semibold">{t('storeSettings:storeSettings.priceLimit')}</Text>
                    <Text variant="caption" color="text.secondary">{t('storeSettings:storeSettings.priceLimitDesc')}</Text>
                  </S.SwitchLabelContent>
                  <Toggle checked={false} />
                </S.SwitchItem>
              </S.ValidationList>
            </S.PaddingContainer>
          </CardBody>
        </Card>
      </S.GlobalGrid>

      <S.BlacklistCard variant="bordered" className="custom-shadow">
        <S.SectionHeader>
          <S.BlacklistTitleColumn>
            <S.HeaderIconWrapper $type="blacklist">
              <Icon name="block" size={20} />
            </S.HeaderIconWrapper>
            <S.SectionTitleContent>
              <S.SectionTitle>{t('storeSettings:storeSettings.blacklistSectionTitle')}</S.SectionTitle>
              <Text variant="caption" color="text.secondary">{t('storeSettings:storeSettings.blacklistSubtitle')}</Text>
            </S.SectionTitleContent>
          </S.BlacklistTitleColumn>
          <S.BlacklistControls>
            <S.SearchContainer>
               <input 
                placeholder={t('storeSettings:storeSettings.addKeyword')} 
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
               />
               <S.SearchActions>
                  <S.MiniSelect>
                    <Select
                      options={[
                        { value: 'both', label: t('storeSettings:storeSettings.scope_both').toUpperCase() },
                        { value: 'title', label: t('storeSettings:storeSettings.scope_title').toUpperCase() },
                        { value: 'description', label: t('storeSettings:storeSettings.scope_description').toUpperCase() },
                      ]}
                      value={newScope}
                      onChange={(v) => setNewScope(v as any)}
                    />
                  </S.MiniSelect>
                  <Button variant="primary" size="sm" onClick={onAddKeyword} style={{ minWidth: '32px', padding: 0 }}>
                    <Icon name="plus" size={18} />
                  </Button>
               </S.SearchActions>
            </S.SearchContainer>
          </S.BlacklistControls>
        </S.SectionHeader>
        
        <Table
          columns={blacklistColumns}
          data={pagedBlacklist}
          emptyMessage={t('storeSettings:storeSettings.noKeywords')}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={onSort}
          footer={
            blacklistCount > 0 && (
              <TablePagination
                count={blacklistCount}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={setPage}
                onRowsPerPageChange={setRowsPerPage}
              />
            )
          }
        />
      </S.BlacklistCard>

      <S.Footer>
        <S.FooterLinks>
           <a href="#">{t('translation:menu.support').toUpperCase()}</a>
           <a href="#">{t('translation:common.privacy').toUpperCase()}</a>
           <a href="#">{t('translation:common.support').toUpperCase()}</a>
        </S.FooterLinks>
        <S.Copyright>
          {t('storeSettings:storeSettings.copyright', { year: new Date().getFullYear() })}
        </S.Copyright>
      </S.Footer>
    </S.Container>
  );
};
