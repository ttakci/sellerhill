import { zodResolver } from '@hookform/resolvers/zod';
import { StoreSettingsFormData, storeSettingsSchema } from '@repo/shared';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Icon,
  Select,
  SwitchRow,
  Table,
  TablePagination,
  Text,
  TextInput,
  Toggle,
  useTheme
} from '@repo/ui';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import * as S from './StoreSettingsPage.style';
import { StoreSettingsPageProps } from './StoreSettingsPage.types';

export const StoreSettingsPageComponent = ({
  settings,
  onSave,
  onStoreChange,
  availableStores,
}: StoreSettingsPageProps): React.ReactElement => {
  const { t } = useTranslation(['storeSettings', 'translation']);
  const { theme } = useTheme();
  const [newKeyword, setNewKeyword] = useState('');
  const [newScope, setNewScope] = useState<'title' | 'description' | 'both'>('both');

  const {
    control,
    handleSubmit,
    watch,
    setValue,
  } = useForm<StoreSettingsFormData>({
    resolver: zodResolver(storeSettingsSchema(t)),
    defaultValues: {
      isGlobal: settings.isGlobal,
      storeId: settings.storeId,
      country: settings.country,
      state: settings.state,
      zipCode: settings.zipCode,
      validateTitle: settings.validateTitle,
      validateDescription: settings.validateDescription,
      blacklist: settings.blacklist,
    },
  });

  const isGlobal = watch('isGlobal');
  const blacklist = watch('blacklist');

  // Pagination & Sorting State
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortColumn, setSortColumn] = useState<string | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: string) => {
    const isAsc = sortColumn === column && sortDirection === 'asc';
    setSortDirection(isAsc ? 'desc' : 'asc');
    setSortColumn(column);
  };

  const sortedBlacklist = React.useMemo(() => {
    if (!sortColumn) return blacklist;

    return [...blacklist].sort((a, b) => {
      const aValue = a[sortColumn as keyof typeof a];
      const bValue = b[sortColumn as keyof typeof b];

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [blacklist, sortColumn, sortDirection]);

  const pagedBlacklist = React.useMemo(() => {
    const startIndex = (page - 1) * rowsPerPage;
    return sortedBlacklist.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedBlacklist, page, rowsPerPage]);

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) {
      return;
    }
    const updatedBlacklist = [...blacklist, { keyword: newKeyword.trim(), scope: newScope }];
    setValue('blacklist', updatedBlacklist);
    setNewKeyword('');
  };

  const handleRemoveKeyword = (index: number) => {
    const updatedBlacklist = blacklist.filter((_, i) => i !== index);
    setValue('blacklist', updatedBlacklist);
  };

  const blacklistColumns = [
    {
      key: 'keyword',
      header: t('storeSettings:storeSettings.keyword'),
      sortable: true,
      render: (value: any) => <Text weight="semibold">{value}</Text>,
    },
    {
      key: 'scope',
      header: t('storeSettings:storeSettings.scope'),
      sortable: true,
      render: (value: any) => {
        const variantMap: Record<string, 'primary' | 'warning' | 'info'> = {
          both: 'primary',
          title: 'warning',
          description: 'info',
        };
        const labelMap: Record<string, string> = {
          both: 'storeSettings:storeSettings.scope_both',
          title: 'storeSettings:storeSettings.scope_title',
          description: 'storeSettings:storeSettings.scope_description',
        };
        return (
          <Badge variant={variantMap[value] || 'secondary'}>
            {t(labelMap[value])}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (_: any, __: any, index: number) => (
        <S.IconAction onClick={() => handleRemoveKeyword(index)}>
          <Icon name="trash" size={16} />
        </S.IconAction>
      ),
    },
  ];

  return (
    <S.Container>
      <S.Header>
        <S.HeaderContent>
          <S.HeaderTitleWrapper>
             <Icon name="store" size={28} color="brand.primary" />
             <S.PageTitle variant="h3" weight="bold">{t('storeSettings:storeSettings.title')}</S.PageTitle>
          </S.HeaderTitleWrapper>
          <Text variant="body" color="text.secondary">
            {t('storeSettings:storeSettings.subtitle')}
          </Text>
        </S.HeaderContent>
        <S.Actions>
          <Button variant="primary" size="md" onClick={handleSubmit(onSave)}>
            <Icon name="archive" size={18} />
            <Text variant="body" weight="medium" color="inherit">
              {t('storeSettings:storeSettings.saveChanges')}
            </Text>
          </Button>
        </S.Actions>
      </S.Header>

      <Card variant="bordered">
        <CardBody>
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
                <Text variant="body" weight="semibold">{t('storeSettings:storeSettings.globalSettings')}</Text>
                <S.DescriptionWrapper>
                  <S.DescriptionLine variant="caption" color="text.secondary">
                     {t('storeSettings:storeSettings.globalDescription').split('. ')[0]}.
                  </S.DescriptionLine>
                  <S.SecondaryDescriptionLine variant="caption" muted>
                     {t('storeSettings:storeSettings.globalDescription').split('. ')[1]}.
                  </S.SecondaryDescriptionLine>
                </S.DescriptionWrapper>
              </S.SwitchLabelContent>
            </S.SwitchGroup>

            <S.StoreSelectWrapper $disabled={isGlobal}>
              <S.StoreLabel>{t('storeSettings:storeSettings.selectStore')}</S.StoreLabel>
              <Select
                options={availableStores.map(s => ({ value: s.id, label: s.name }))}
                value={settings.storeId || ''}
                onChange={(val) => onStoreChange(val)}
                fullWidth
                disabled={isGlobal}
                placeholder={t('storeSettings:storeSettings.selectStorePlaceholder') || t('storeSettings:storeSettings.selectStore')}
              />
            </S.StoreSelectWrapper>
          </S.GlobalBanner>

          <S.GlobalGrid>
            <Card variant="bordered">
              <S.SectionHeader>
                <S.SectionTitleGroup>
                  <S.HeaderIconWrapper>
                    <Icon name="map-pin" size={24} color="text.primary" />
                  </S.HeaderIconWrapper>
                  <S.SectionTitleContent>
                    <S.SectionTitle variant="h4" weight="bold">{t('storeSettings:storeSettings.locationSectionTitle')}</S.SectionTitle>
                    <Text variant="caption" color="text.secondary">{t('storeSettings:storeSettings.locationSectionSubtitle')}</Text>
                  </S.SectionTitleContent>
                </S.SectionTitleGroup>
              </S.SectionHeader>
              <CardBody>
                <S.AddressGrid>
                  <Controller
                    name="country"
                    control={control}
                    render={({ field }) => (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <S.StoreLabel>{t('storeSettings:storeSettings.country')}</S.StoreLabel>
                        <Select
                          options={[
                            { value: 'US', label: 'United States (US)' },
                            { value: 'GB', label: 'United Kingdom (GB)' },
                            { value: 'DE', label: 'Germany (DE)' },
                            { value: 'FR', label: 'France (FR)' },
                            { value: 'IT', label: 'Italy (IT)' },
                            { value: 'ES', label: 'Spain (ES)' },
                            { value: 'CA', label: 'Canada (CA)' },
                            { value: 'AU', label: 'Australia (AU)' },
                            { value: 'CN', label: 'China (CN)' },
                            { value: 'JP', label: 'Japan (JP)' },
                            { value: 'TR', label: 'Turkey (TR)' },
                          ]}
                          value={field.value}
                          onChange={field.onChange}
                          fullWidth
                          placeholder={t('storeSettings:storeSettings.selectCountry') || 'Select Country'}
                        />
                      </div>
                    )}
                  />
                  <TextInput
                    name="state"
                    control={control}
                    label={t('storeSettings:storeSettings.state')}
                  />
                </S.AddressGrid>
                
                <TextInput
                  name="zipCode"
                  control={control}
                  label={t('storeSettings:storeSettings.zipCode')}
                />
              </CardBody>
            </Card>

            <Card variant="bordered">
              <S.SectionHeader>
                <S.SectionTitleGroup>
                  <S.HeaderIconWrapper>
                    <Icon name="check-list" size={24} color="text.primary" />
                  </S.HeaderIconWrapper>
                  <S.SectionTitleContent>
                     <S.SectionTitle variant="h4" weight="bold">{t('storeSettings:storeSettings.validationSectionTitle')}</S.SectionTitle>
                     <Text variant="caption" color="text.secondary">{t('storeSettings:storeSettings.validationSectionSubtitle')}</Text>
                  </S.SectionTitleContent>
                </S.SectionTitleGroup>
              </S.SectionHeader>
              <CardBody>
                <Controller
                  name="validateTitle"
                  control={control}
                  render={({ field }) => (
                    <SwitchRow
                      title={t('storeSettings:storeSettings.validateTitle')}
                      description={t('storeSettings:storeSettings.validateTitleDesc')}
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />

                <Controller
                  name="validateDescription"
                  control={control}
                  render={({ field }) => (
                    <SwitchRow
                      title={t('storeSettings:storeSettings.validateDescription')}
                      description={t('storeSettings:storeSettings.validateDescriptionDesc')}
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </CardBody>
            </Card>
          </S.GlobalGrid>

          <S.BlacklistCard variant="bordered">
            <S.SectionHeader>
              <S.BlacklistTitleColumn>
                <S.HeaderIconWrapper>
                   <Icon name="block" size={24} color="text.primary" />
                </S.HeaderIconWrapper>
                <S.SectionTitleContent>
                  <S.SectionTitle variant="h4" weight="bold">{t('storeSettings:storeSettings.blacklistSectionTitle')}</S.SectionTitle>
                  <Text variant="caption" color="text.secondary">{t('storeSettings:storeSettings.blacklistSubtitle')}</Text>
                </S.SectionTitleContent>
              </S.BlacklistTitleColumn>
              <S.BlacklistControls>
                <S.BlacklistInputWrapper>
                  <S.BlacklistInput
                    value={newKeyword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKeyword(e.target.value)}
                    placeholder={t('storeSettings:storeSettings.addKeyword')}
                  />
                  <S.BlacklistActionGroup>
                    <S.ScopeSelectContainer>
                      <Select
                        options={[
                          { value: 'both', label: t('storeSettings:storeSettings.scope_both') },
                          { value: 'title', label: t('storeSettings:storeSettings.scope_title') },
                          { value: 'description', label: t('storeSettings:storeSettings.scope_description') },
                        ]}
                        value={newScope}
                        onChange={(val) => setNewScope(val as any)}
                        fullWidth={true}
                      />
                    </S.ScopeSelectContainer>
                    <S.AddButton
                      variant="primary"
                      size="sm"
                      onClick={handleAddKeyword}
                    >
                      <Icon name="plus" size={14} />
                    </S.AddButton>
                  </S.BlacklistActionGroup>
                </S.BlacklistInputWrapper>
              </S.BlacklistControls>
            </S.SectionHeader>
            
            <Table
              columns={blacklistColumns}
              data={pagedBlacklist}
              emptyMessage={t('storeSettings:storeSettings.noKeywords')}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              footer={
                sortedBlacklist.length > 0 && (
                  <TablePagination
                    count={sortedBlacklist.length}
                    page={page}
                    rowsPerPage={rowsPerPage}
                    onPageChange={setPage}
                    onRowsPerPageChange={setRowsPerPage}
                    labelRowsPerPage={t('translation:common.rowsPerPage')}
                  />
                )
              }
            />
          </S.BlacklistCard>
        </CardBody>
      </Card>

      <S.Copyright>
        {t('storeSettings:storeSettings.copyright', { year: new Date().getFullYear() })}
      </S.Copyright>
    </S.Container>
  );
};
