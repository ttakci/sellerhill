import { zodResolver } from '@hookform/resolvers/zod';
import { StoreSettingsFormData, storeSettingsSchema } from '@repo/shared';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CollapsibleCard,
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
          <Text variant="h1" weight="bold">{t('storeSettings.title')}</Text>
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

      <Card>
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
                <Text variant="body" weight="medium">{t('storeSettings.globalSettings')}</Text>
                <Text variant="caption" muted>
                  {t('storeSettings.globalDescription')}
                </Text>
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
            <CollapsibleCard
              title={t('storeSettings.locationSectionTitle')}
              icon={<Icon name="user" size={18} color={theme.colors.brand.primary} />}
            >
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
            </CollapsibleCard>

            <CollapsibleCard
              title={t('storeSettings.validationSectionTitle')}
              icon={<Icon name="alert-circle" size={18} color={theme.colors.brand.primary} />}
            >
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
            </CollapsibleCard>
          </S.GlobalGrid>

          <S.BlacklistCard>
            <S.BlacklistHeaderPanel>
              <S.BlacklistTitleColumn>
                <Text weight="semibold">{t('storeSettings.blacklistSectionTitle')}</Text>
                <Text variant="caption" muted>{t('storeSettings.blacklistSubtitle')}</Text>
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
            </S.BlacklistHeaderPanel>
            
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
          </S.BlacklistCard>
        </CardBody>
      </Card>

      <S.Copyright>
        {t('storeSettings.copyright', { year: new Date().getFullYear() })}
      </S.Copyright>
    </S.Container>
  );
};
