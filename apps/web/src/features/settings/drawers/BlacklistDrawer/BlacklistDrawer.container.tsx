import { useLoading, useUI } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GLOBAL_SCOPE, resolveScopeConfig } from '../storeScope';

import { BlacklistDrawerComponent } from './BlacklistDrawer.component';
import type { BlacklistDrawerProps, BlacklistItem, BlacklistScope } from './BlacklistDrawer.types';

import { useSaveStoreSettingsMutation } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';

/** Normalize a persisted blacklist entry into the local draft shape. */
const toItems = (entries: Array<{ keyword: string; scope: BlacklistScope }> | undefined): BlacklistItem[] =>
  (entries ?? []).map((b) => ({ keyword: b.keyword, scope: b.scope }));

const sameItem = (a: BlacklistItem, b: BlacklistItem): boolean =>
  a.keyword === b.keyword && a.scope === b.scope;

export const BlacklistDrawer: React.FC<BlacklistDrawerProps> = ({
  isOpen,
  onClose,
  onBack,
  storeConfigs,
  selectedScope,
}) => {
  const { t } = useTranslation(['translation']);
  const { showMessage, closeMessage } = useUI();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [saveSettings, { isLoading: isSaving }] = useSaveStoreSettingsMutation();
  useLoading(isSaving);

  const config = resolveScopeConfig(storeConfigs, selectedScope);
  const originalBlacklist = useMemo(() => toItems(config?.blacklist), [config]);

  // Draft state — add/remove mutate this; Save commits it.
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>(originalBlacklist);
  const [keywords, setKeywords] = useState('');
  const [scopeValue, setScopeValue] = useState<BlacklistScope>('both');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [selectedItems, setSelectedItems] = useState<BlacklistItem[]>([]);
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
      setScopeValue('both');
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
    items.length > 0 && items.every((item) => selectedItems.some((s) => sameItem(s, item)));

  const handleAdd = useCallback(() => {
    const keywordList = keywords
      .split(/[\n,]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywordList.length === 0) {
      setErrorMessage(t('translation:settingsHub.drawer.blacklist.add.empty'));
      return;
    }

    const additions: BlacklistItem[] = [];
    for (const kw of keywordList) {
      const exists =
        blacklist.some((b) => b.keyword.toLowerCase() === kw.toLowerCase() && b.scope === scopeValue) ||
        additions.some((b) => b.keyword.toLowerCase() === kw.toLowerCase() && b.scope === scopeValue);
      if (!exists) {
        additions.push({ keyword: kw, scope: scopeValue });
      }
    }

    if (additions.length === 0) {
      setErrorMessage(t('translation:settingsHub.drawer.blacklist.add.duplicate'));
      return;
    }

    setErrorMessage(null);
    setBlacklist((prev) => [...prev, ...additions]);
    setKeywords('');
  }, [keywords, blacklist, scopeValue, t]);

  const handleRemove = useCallback((keyword: string, scope: BlacklistScope): void => {
    setBlacklist((prev) => prev.filter((b) => !(b.keyword === keyword && b.scope === scope)));
  }, []);

  const handleToggleSelect = useCallback((item: BlacklistItem) => {
    setSelectedItems((prev) => {
      if (prev.some((s) => sameItem(s, item))) {
        return prev.filter((s) => !sameItem(s, item));
      }
      return [...prev, item];
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map((item) => ({ keyword: item.keyword, scope: item.scope })));
    }
  }, [isAllSelected, items]);

  const handleOpenConfirm = useCallback(() => setIsConfirmOpen(true), []);
  const handleCloseConfirm = useCallback(() => setIsConfirmOpen(false), []);

  const handleConfirmBulkDelete = useCallback(() => {
    const removeSet = new Set(selectedItems.map((i) => `${i.keyword}-${i.scope}`));
    setBlacklist((prev) => prev.filter((b) => !removeSet.has(`${b.keyword}-${b.scope}`)));
    setSelectedItems([]);
    setIsConfirmOpen(false);
  }, [selectedItems]);

  // Draft equality check (order-insensitive) — disables Save when nothing changed.
  const hasChanges = useMemo(() => {
    if (blacklist.length !== originalBlacklist.length) {
      return true;
    }
    return blacklist.some((b) => !originalBlacklist.some((o) => sameItem(o, b)));
  }, [blacklist, originalBlacklist]);

  const isSaveDisabled = isSaving || !hasChanges;

  const handleSave = (): void => {
    const isGlobal = selectedScope === GLOBAL_SCOPE;
    const payload = {
      isGlobal,
      storeId: isGlobal ? undefined : selectedScope,
      country: config?.country ?? '',
      state: config?.state ?? '',
      zipCode: config?.zipCode ?? '',
      validateTitle: config?.validateTitle ?? true,
      validateDescription: config?.validateDescription ?? false,
      blacklist: blacklist.map((b) => ({ keyword: b.keyword, scope: b.scope })),
      // Preserve existing tax rate through this drawer (UI for editing lands in a later task).
      amazonTaxRate: config?.amazonTaxRate ?? 0,
    };

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    void saveSettings(payload)
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
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  };

  return (
    <BlacklistDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      keywords={keywords}
      onKeywordsChange={(e) => setKeywords(e.target.value)}
      selectedScopeValue={scopeValue}
      onSelectScopeValue={setScopeValue}
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
      scopeLabel={t('translation:settingsHub.drawer.blacklist.add.scope')}
      scopeBothLabel={t('translation:settingsHub.drawer.blacklist.add.scopeBoth')}
      scopeTitleLabel={t('translation:settingsHub.drawer.blacklist.add.scopeTitle')}
      scopeDescriptionLabel={t('translation:settingsHub.drawer.blacklist.add.scopeDescription')}
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
