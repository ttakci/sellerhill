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
  const { t } = useTranslation();
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
      header: t('storeSettings.keyword'),
      sortable: true,
      render: (value: any) => <Text weight="semibold">{value}</Text>,
    },
    {
      key: 'scope',
      header: t('storeSettings.scope'),
      sortable: true,
      render: (value: any) => {
        const variantMap: Record<string, 'primary' | 'warning' | 'info'> = {
          both: 'primary',
          title: 'warning',
          description: 'info',
        };
        const labelMap: Record<string, string> = {
          both: 'storeSettings.scope_both',
          title: 'storeSettings.scope_title',
          description: 'storeSettings.scope_description',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <Icon name="store" size={28} color="brand.primary" />
             <Text variant="h3" weight="bold" style={{ fontSize: '26px' }}>{t('storeSettings.title')}</Text>
          </div>
          <Text variant="body" color="text.secondary">
            {t('storeSettings.subtitle')}
          </Text>
        </S.HeaderContent>
        <S.Actions>
          <Button variant="primary" size="md" onClick={handleSubmit(onSave)}>
            <Icon name="archive" size={18} />
            <Text variant="body" weight="medium" color="inherit">
              {t('storeSettings.saveChanges')}
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
                <Text variant="body" weight="semibold">{t('storeSettings.globalSettings')}</Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                  <Text variant="caption" color="text.secondary" style={{ lineHeight: '1.4' }}>
                     {t('storeSettings.globalDescription').split('. ')[0]}.
                  </Text>
                  <Text variant="caption" muted style={{ fontSize: '13px', lineHeight: '1.4' }}>
                     {t('storeSettings.globalDescription').split('. ')[1]}.
                  </Text>
                </div>
              </S.SwitchLabelContent>
            </S.SwitchGroup>

            <S.StoreSelectWrapper $disabled={isGlobal}>
              <S.StoreLabel>{t('storeSettings.selectStore')}</S.StoreLabel>
              <Select
                options={availableStores.map(s => ({ value: s.id, label: s.name }))}
                value={settings.storeId || ''}
                onChange={(val) => onStoreChange(val)}
                fullWidth
                disabled={isGlobal}
                placeholder={t('storeSettings.selectStorePlaceholder') || t('storeSettings.selectStore')}
              />
            </S.StoreSelectWrapper>
          </S.GlobalBanner>

          <S.GlobalGrid>
            <Card variant="bordered">
              <S.SectionHeader>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <S.HeaderIconWrapper>
                    <Icon name="map-pin" size={24} color="text.primary" />
                  </S.HeaderIconWrapper>
                  <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '2px' }}>
                    <Text variant="h4" weight="bold" style={{ fontSize: '1.125rem' }}>{t('storeSettings.locationSectionTitle')}</Text>
                    <Text variant="caption" color="text.secondary">{t('storeSettings.locationSectionSubtitle')}</Text>
                  </div>
                </div>
              </S.SectionHeader>
              <CardBody>
                <S.AddressGrid>
                  <TextInput
                    name="country"
                    control={control}
                    label={t('storeSettings.country')}
                  />
                  <TextInput
                    name="state"
                    control={control}
                    label={t('storeSettings.state')}
                  />
                </S.AddressGrid>
                
                <TextInput
                  name="zipCode"
                  control={control}
                  label={t('storeSettings.zipCode')}
                />
              </CardBody>
            </Card>

            <Card variant="bordered">
              <S.SectionHeader>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <S.HeaderIconWrapper>
                    <Icon name="check-list" size={24} color="text.primary" />
                  </S.HeaderIconWrapper>
                  <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '2px' }}>
                     <Text variant="h4" weight="bold" style={{ fontSize: '1.125rem' }}>{t('storeSettings.validationSectionTitle')}</Text>
                     <Text variant="caption" color="text.secondary">{t('storeSettings.validationSectionSubtitle')}</Text>
                  </div>
                </div>
              </S.SectionHeader>
              <CardBody>
                <Controller
                  name="validateTitle"
                  control={control}
                  render={({ field }) => (
                    <SwitchRow
                      title={t('storeSettings.validateTitle')}
                      description={t('storeSettings.validateTitleDesc')}
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
                      title={t('storeSettings.validateDescription')}
                      description={t('storeSettings.validateDescriptionDesc')}
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </CardBody>
            </Card>
          </S.GlobalGrid>

          <Card variant="bordered" style={{ marginTop: '24px' }}>
            <S.SectionHeader>
              <S.BlacklistTitleColumn>
                <S.HeaderIconWrapper>
                   <Icon name="block" size={24} color="text.primary" />
                </S.HeaderIconWrapper>
                <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '2px' }}>
                  <Text variant="h4" weight="bold" style={{ fontSize: '1.125rem' }}>{t('storeSettings.blacklistSectionTitle')}</Text>
                  <Text variant="caption" color="text.secondary">{t('storeSettings.blacklistSubtitle')}</Text>
                </div>
              </S.BlacklistTitleColumn>
              <S.BlacklistControls>
                <S.BlacklistInputWrapper>
                  <S.BlacklistInput
                    value={newKeyword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKeyword(e.target.value)}
                    placeholder={t('storeSettings.addKeyword')}
                  />
                  <S.BlacklistActionGroup>
                    <S.ScopeSelectContainer>
                      <Select
                        options={[
                          { value: 'both', label: t('storeSettings.scope_both') },
                          { value: 'title', label: t('storeSettings.scope_title') },
                          { value: 'description', label: t('storeSettings.scope_description') },
                        ]}
                        value={newScope}
                        onChange={(val) => setNewScope(val as any)}
                        fullWidth={true}
                      />
                    </S.ScopeSelectContainer>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAddKeyword}
                      style={{ height: '44px' }}
                    >
                      <Icon name="plus" size={14} />
                    </Button>
                  </S.BlacklistActionGroup>
                </S.BlacklistInputWrapper>
              </S.BlacklistControls>
            </S.SectionHeader>
            
            <Table
              columns={blacklistColumns}
              data={pagedBlacklist}
              emptyMessage={t('storeSettings.noKeywords')}
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
                    labelRowsPerPage={t('common.rowsPerPage')}
                  />
                )
              }
            />
          </Card>
        </CardBody>
      </Card>

      <S.Copyright>
        {t('storeSettings.copyright', { year: new Date().getFullYear() })}
      </S.Copyright>
    </S.Container>
  );
};
