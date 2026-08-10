import { BlacklistType } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GLOBAL_SCOPE, resolveScopeConfig } from '../storeScope';

import { BlacklistDrawerComponent } from './BlacklistDrawer.component';
import type { BlacklistDrawerProps, BlacklistItem } from './BlacklistDrawer.types';

import { useSaveStoreSettingsMutation } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';

const ALL_BLACKLIST_TYPES = Object.values(BlacklistType);

/** Normalize a persisted blacklist entry into the local draft shape. */
const toItems = (entries: Array<{ keyword: string; types: BlacklistType[] }> | undefined): BlacklistItem[] =>
  (entries ?? []).map((b) => ({ keyword: b.keyword, types: [...b.types] }));

export const BlacklistDrawer: React.FC<BlacklistDrawerProps> = ({
  isOpen,
  onClose,
  onBack,
  storeConfigs,
  selectedScope,
}) => {
  const { t } = useTranslation(['translation']);
  const { showMessage, closeMessage } = useUI();

  const [saveSettings, { isLoading: isSaving }] = useSaveStoreSettingsMutation();
  useLoading(isSaving);

  const config = resolveScopeConfig(storeConfigs, selectedScope);
  const originalBlacklist = useMemo(() => toItems(config?.blacklist), [config]);

  // Draft state — add/remove mutate this; Save commits it.
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>(originalBlacklist);
  const [keywords, setKeywords] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<BlacklistType[]>(ALL_BLACKLIST_TYPES);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Reset draft + form when the drawer opens or the inherited scope changes.
  // React-recommended render-time state adjustment.
  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [prevScope, setPrevScope] = useState(selectedScope);
  if (isOpen !== prevOpen || selectedScope !== prevScope) {
    setPrevOpen(isOpen);
    setPrevScope(selectedScope);
    if (isOpen) {
      setBlacklist(originalBlacklist);
      setKeywords('');
      setSelectedTypes(ALL_BLACKLIST_TYPES);
      setErrorMessage(null);
      setSearchValue('');
      setSelectedItems([]);
      setIsConfirmOpen(false);
    }
  }

  const items = useMemo(() => {
    if (!searchValue.trim()) {
      return blacklist;
    }
    const query = searchValue.toLowerCase().trim();
    return blacklist.filter((item) => item.keyword.toLowerCase().includes(query));
  }, [blacklist, searchValue]);

  const isAllSelected =
    items.length > 0 && items.every((item) => selectedItems.includes(item.keyword));

  const handleToggleType = useCallback((type: BlacklistType): void => {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  }, []);

  const handleAdd = useCallback(() => {
    const keywordList = keywords
      .split(/[\n,]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywordList.length === 0) {
      setErrorMessage(t('translation:settingsHub.drawer.blacklist.add.empty'));
      return;
    }
    if (selectedTypes.length === 0) {
      setErrorMessage(t('translation:settingsHub.drawer.blacklist.add.typeRequired'));
      return;
    }

    const next = blacklist.map((item) => ({ ...item, types: [...item.types] }));
    for (const keyword of keywordList) {
      const existing = next.find((item) => item.keyword.toLowerCase() === keyword.toLowerCase());
      if (existing) {
        existing.types = Array.from(new Set([...existing.types, ...selectedTypes]));
      } else {
        next.push({ keyword, types: [...selectedTypes] });
      }
    }

    const changed = next.length !== blacklist.length
      || next.some((item) => {
        const old = blacklist.find((b) => b.keyword.toLowerCase() === item.keyword.toLowerCase());
        return !old || old.types.length !== item.types.length || !old.types.every((type) => item.types.includes(type));
      });
    if (!changed) {
      setErrorMessage(t('translation:settingsHub.drawer.blacklist.add.duplicate'));
      return;
    }

    setErrorMessage(null);
    setBlacklist(next);
    setKeywords('');
  }, [keywords, blacklist, selectedTypes, t]);

  const handleRemove = useCallback((keyword: string): void => {
    setBlacklist((prev) => prev.filter((b) => b.keyword !== keyword));
    setSelectedItems((prev) => prev.filter((k) => k !== keyword));
  }, []);

  const handleToggleSelect = useCallback((keyword: string) => {
    setSelectedItems((prev) =>
      (prev.includes(keyword) ? prev.filter((k) => k !== keyword) : [...prev, keyword]));
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedItems(isAllSelected ? [] : items.map((item) => item.keyword));
  }, [isAllSelected, items]);

  const handleOpenConfirm = useCallback(() => setIsConfirmOpen(true), []);
  const handleCloseConfirm = useCallback(() => setIsConfirmOpen(false), []);

  const handleConfirmBulkDelete = useCallback(() => {
    const removeSet = new Set(selectedItems);
    setBlacklist((prev) => prev.filter((b) => !removeSet.has(b.keyword)));
    setSelectedItems([]);
    setIsConfirmOpen(false);
  }, [selectedItems]);

  // Draft equality check (order-insensitive) — disables Save when nothing changed.
  const hasChanges = useMemo(() => {
    if (blacklist.length !== originalBlacklist.length) {
      return true;
    }
    return blacklist.some((b) => {
      const old = originalBlacklist.find((o) => o.keyword === b.keyword);
      return !old || old.types.length !== b.types.length || !old.types.every((type) => b.types.includes(type));
    });
  }, [blacklist, originalBlacklist]);

  const isSaveDisabled = isSaving || !hasChanges;

  const handleSave = (): void => {
    const isGlobal = selectedScope === GLOBAL_SCOPE;

    void saveSettings({
      isGlobal,
      storeId: isGlobal ? undefined : selectedScope,
      amazonTaxRate: config?.amazonTaxRate ?? 0,
      blacklist: blacklist.map((b) => ({ keyword: b.keyword, types: b.types })),
    })
      .unwrap()
      .then(() => {
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:message.success.header',
            descriptionKey: 'translation:common.saveSuccess',
            primaryButton: { labelKey: 'translation:message.success.ok', onClick: closeMessage },
          },
          t,
        );
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(error),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t,
        );
      });
  };

  return (
    <BlacklistDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      keywords={keywords}
      onKeywordsChange={(e) => setKeywords(e.target.value)}
      selectedTypes={selectedTypes}
      typeOptions={ALL_BLACKLIST_TYPES.map((value) => ({
        value,
        label: t(`translation:settingsHub.drawer.blacklist.add.type.${value}`),
      }))}
      onToggleType={handleToggleType}
      onAdd={handleAdd}
      errorMessage={errorMessage}
      items={items}
      onRemove={handleRemove}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      selectedItems={selectedItems}
      onToggleSelect={handleToggleSelect}
      onToggleSelectAll={handleToggleSelectAll}
      isAllSelected={isAllSelected}
      onSave={handleSave}
      isSaving={isSaving}
      isSaveDisabled={isSaveDisabled}
      titleLabel={t('translation:settingsHub.drawer.blacklist.manage.title')}
      subtitleLabel={t('translation:settingsHub.drawer.blacklist.manage.subtitle')}
      keywordsLabel={t('translation:settingsHub.drawer.blacklist.add.keywordsLabel')}
      keywordsPlaceholder={t('translation:settingsHub.drawer.blacklist.add.keywordsPlaceholder')}
      keywordsHint={t('translation:settingsHub.drawer.blacklist.add.keywordsHint')}
      typeLabel={t('translation:settingsHub.drawer.blacklist.add.typeLabel')}
      addLabel={t('translation:settingsHub.drawer.blacklist.add.add')}
      emptyMessage={t('translation:settingsHub.drawer.blacklist.list.empty')}
      searchPlaceholder={t('translation:common.search')}
      selectAllLabel={t('translation:settingsHub.drawer.blacklist.list.selectAll')}
      selectedCountLabel={t('translation:settingsHub.drawer.blacklist.list.selectedCount', {
        count: selectedItems.length,
      })}
      bulkDeleteLabel={t('translation:settingsHub.drawer.blacklist.list.bulkDelete')}
      isConfirmOpen={isConfirmOpen}
      onOpenConfirm={handleOpenConfirm}
      onCloseConfirm={handleCloseConfirm}
      onConfirmBulkDelete={handleConfirmBulkDelete}
      confirmDescription={t('translation:settingsHub.drawer.blacklist.list.confirmBulkDeleteDescription', {
        count: selectedItems.length,
      })}
      confirmLabel={t('translation:common.delete')}
      cancelLabel={t('translation:common.cancel')}
    />
  );
};

BlacklistDrawer.displayName = 'BlacklistDrawer';
