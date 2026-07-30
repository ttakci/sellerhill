import { zodResolver } from '@hookform/resolvers/zod';
import { storeSettingsSchema, type StoreSettingsFormData } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useGetEbayAccountsQuery } from '../../features/ebay/api/ebayApi';

import { useGetStoreSettingsQuery, useSaveStoreSettingsMutation } from './api/storeSettingsApi';
import { StoreSettingsPageComponent } from './StoreSettingsPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { getErrorI18nKey } from '@/utils/errorHandler';

export const StoreSettingsPageContainer = (): React.ReactElement => {
  const { t } = useTranslation(['storeSettings', 'translation']);
  const { showMessage, closeMessage } = useUI();
  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(undefined);

  // Blacklist Management State
  const [newKeyword, setNewKeyword] = useState('');
  const [newScope, setNewScope] = useState<'title' | 'description' | 'both'>('both');

  // Pagination & Sorting State
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortColumn, setSortColumn] = useState<string | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useGetStoreSettingsQuery({ storeId: selectedStoreId });

  // Fetch eBay accounts for store selection
  const { data: ebayAccounts } = useGetEbayAccountsQuery();

  // Save mutation
  const [saveSettings, { isLoading: isSaving, isSuccess: saveSuccess, error: saveError }] =
    useSaveStoreSettingsMutation();

  /* useLoading is for BLOCKING MUTATIONS only. The initial query flags used
     to be folded in here, so the global overlay covered the whole app on
     first paint of this page instead of the page showing its own state. */
  useLoading(isSaving);

  // Form Setup
  const form = useForm<StoreSettingsFormData>({
    resolver: zodResolver(storeSettingsSchema(t)) as any,
    defaultValues: {
      isGlobal: true,
      storeId: undefined,
      country: '',
      state: '',
      zipCode: '',
      validateTitle: true,
      validateDescription: true,
      blacklist: [],
    },
  });

  const { reset, setValue } = form;
  const rawBlacklist = useWatch({ control: form.control, name: 'blacklist' });
  const safeBlacklist = useMemo(() => rawBlacklist || [], [rawBlacklist]);

  // Update form defaults when settings load
  useEffect(() => {
    if (settings) {
      reset({
        isGlobal: settings.isGlobal,
        storeId: settings.storeId,
        country: settings.country,
        state: settings.state,
        zipCode: settings.zipCode,
        validateTitle: settings.validateTitle,
        validateDescription: settings.validateDescription,
        blacklist: settings.blacklist,
      });
    }
  }, [settings, reset]);

  // Handle success
  useEffect(() => {
    if (saveSuccess) {
      showMessage(
        {
          type: 'success',
          headerKey: 'translation:message.success.header',
          descriptionKey: 'translation:common.saveSuccess',
          primaryButton: {
            labelKey: 'translation:message.success.ok',
            onClick: closeMessage,
          },
        },
        t
      );
    }
  }, [saveSuccess, showMessage, closeMessage, t]);

  useEffect(() => {
    if (!saveError) {return;}
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: getErrorI18nKey(saveError),
        primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
      },
      t
    );
  }, [saveError, showMessage, closeMessage, t]);

  const handleSave = (data: StoreSettingsFormData): void => {
    void saveSettings({
      ...data,
      storeId: data.isGlobal ? undefined : selectedStoreId,
    });
  };

  // Blacklist Handlers
  const handleAddKeyword = () => {
    if (!newKeyword.trim()) {
      return;
    }
    const updatedBlacklist = [...safeBlacklist, { keyword: newKeyword.trim(), scope: newScope }];
    setValue('blacklist', updatedBlacklist, { shouldDirty: true });
    setNewKeyword('');
  };

  const handleRemoveKeyword = (keyword: string) => {
    const updatedBlacklist = safeBlacklist.filter((item: { keyword: string }) => item.keyword !== keyword);
    setValue('blacklist', updatedBlacklist, { shouldDirty: true });
  };

  // Sorting & Pagination Logic
  const handleSort = (column: string) => {
    const isAsc = sortColumn === column && sortDirection === 'asc';
    setSortDirection(isAsc ? 'desc' : 'asc');
    setSortColumn(column);
  };

  const sortedBlacklist = useMemo(() => {
    if (!sortColumn) {
      return safeBlacklist;
    }

    return [...safeBlacklist].sort((a, b) => {
      const aKey = sortColumn as keyof typeof a;
      const aValue = a[aKey];
      const bValue = b[aKey];

      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [safeBlacklist, sortColumn, sortDirection]);

  const pagedBlacklist = useMemo(() => {
    const startIndex = (page - 1) * rowsPerPage;
    return sortedBlacklist.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedBlacklist, page, rowsPerPage]);

  if (settingsLoading || !settings) {
    return <div>{t('translation:common.loading')}</div>;
  }

  const availableStores =
    ebayAccounts?.items.map((acc) => ({
      id: acc.id,
      name: acc.storeName || acc.sellerId,
    })) || [];

  return (
    <EbayAccountGuard>
      <StoreSettingsPageComponent
        settings={settings}
        onSave={handleSave}
        onStoreChange={(id) => setSelectedStoreId(id)}
        availableStores={availableStores}
        // Form
        form={form}
        // Blacklist Management
        newKeyword={newKeyword}
        setNewKeyword={setNewKeyword}
        newScope={newScope}
        setNewScope={setNewScope}
        onAddKeyword={handleAddKeyword}
        onRemoveKeyword={handleRemoveKeyword}
        // Pagination & Sorting
        pagedBlacklist={pagedBlacklist}
        page={page}
        setPage={setPage}
        rowsPerPage={rowsPerPage}
        setRowsPerPage={setRowsPerPage}
        onSort={handleSort}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        blacklistCount={sortedBlacklist.length}
      />
    </EbayAccountGuard>
  );
};

export default StoreSettingsPageContainer;
