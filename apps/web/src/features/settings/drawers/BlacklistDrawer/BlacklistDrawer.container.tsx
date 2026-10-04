import { BlacklistAction, BlacklistType, parseBlockedAsins } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { notifyDrawerDone } from '../shared/notifyDrawerDone';
import { buildInheritedStoreFields, resolveStoreDraftSeed } from '../storeDraftSeed';
import { GLOBAL_SCOPE, resolveScopeConfig } from '../storeScope';

import { BlacklistDrawerComponent } from './BlacklistDrawer.component';
import type { BlacklistDrawerProps, BlacklistItem } from './BlacklistDrawer.types';
import { blockedAsinsDraft, toSaveBlockedAsins } from './blockedAsinsDraft';

import { useSaveStoreSettingsMutation } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';

const ALL_BLACKLIST_TYPES = Object.values(BlacklistType);

/** Normalize a persisted blacklist entry into the local draft shape. */
const toItems = (
  entries: Array<{ keyword: string; types: BlacklistType[]; action?: BlacklistAction }> | undefined,
): BlacklistItem[] =>
  // An entry saved before the action existed has none, and means "block".
  (entries ?? []).map((b) => ({ keyword: b.keyword, types: [...b.types], action: b.action ?? BlacklistAction.BLOCK }));

/** A removed word has no brand field to be removed from — the brand is not copy. */
const REMOVABLE_TYPES = ALL_BLACKLIST_TYPES.filter((type) => type !== BlacklistType.BRAND_MANUFACTURER);

const typesFor = (action: BlacklistAction): BlacklistType[] =>
  (action === BlacklistAction.REMOVE ? REMOVABLE_TYPES : ALL_BLACKLIST_TYPES);

export const BlacklistDrawer: React.FC<BlacklistDrawerProps> = ({
  isOpen,
  onClose,
  onBack,
  storeConfigs,
  selectedScope,
}) => {
  const { t, i18n } = useTranslation(['translation']);
  const { showMessage, closeMessage } = useUI();

  const [saveSettings, { isLoading: isSaving }] = useSaveStoreSettingsMutation();
  useLoading(isSaving);

  const config = resolveScopeConfig(storeConfigs, selectedScope);
  const globalConfig = resolveScopeConfig(storeConfigs, GLOBAL_SCOPE);
  // A store with no row of its own runs on the global blacklist, so that is
  // the list it starts from — not an empty one.
  const seed = resolveStoreDraftSeed(storeConfigs, selectedScope);
  const originalBlacklist = useMemo(() => toItems(seed?.blacklist), [seed]);
  const isGlobalScope = selectedScope === GLOBAL_SCOPE;
  const originalBlocked = useMemo(
    () => blockedAsinsDraft(config?.blockedAsins, globalConfig?.blockedAsins, isGlobalScope),
    [config, globalConfig, isGlobalScope],
  );

  // Draft state — add/remove mutate this; Save commits it.
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>(originalBlacklist);
  const [keywords, setKeywords] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<BlacklistType[]>(ALL_BLACKLIST_TYPES);
  const [action, setAction] = useState<BlacklistAction>(BlacklistAction.BLOCK);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [blockedText, setBlockedText] = useState(originalBlocked.text);

  // Reset draft + form when the drawer opens or the inherited scope changes.
  // React-recommended render-time state adjustment.
  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [prevScope, setPrevScope] = useState(selectedScope);
  // Also re-seed once when the settings query resolves while the drawer is
  // already open (null -> loaded only, so a post-save refetch never clobbers
  // edits) — same rule as the store-settings drawer.
  const [prevSeed, setPrevSeed] = useState(seed);
  if (isOpen !== prevOpen || selectedScope !== prevScope || seed !== prevSeed) {
    const seedArrived = !prevSeed && Boolean(seed);
    const shouldReset = isOpen !== prevOpen || selectedScope !== prevScope || seedArrived;
    setPrevOpen(isOpen);
    setPrevScope(selectedScope);
    setPrevSeed(seed);
    if (isOpen && shouldReset) {
      setBlacklist(originalBlacklist);
      setKeywords('');
      setSelectedTypes(ALL_BLACKLIST_TYPES);
      setAction(BlacklistAction.BLOCK);
      setErrorMessage(null);
      setSearchValue('');
      setSelectedItems([]);
      setIsConfirmOpen(false);
      setBlockedText(originalBlocked.text);
    }
  }

  // Cards are shown alphabetically (locale-aware, so Turkish ç/ğ/ı/ö/ş/ü sort correctly).
  // Display-only: the draft keeps its own order, so what gets saved is unchanged.
  const items = useMemo(() => {
    const query = searchValue.toLowerCase().trim();
    const visible = query
      ? blacklist.filter((item) => item.keyword.toLowerCase().includes(query))
      : blacklist;
    return [...visible].sort((a, b) =>
      a.keyword.localeCompare(b.keyword, i18n.language, { sensitivity: 'base' }));
  }, [blacklist, searchValue, i18n.language]);

  const isAllSelected =
    items.length > 0 && items.every((item) => selectedItems.includes(item.keyword));

  const handleToggleType = useCallback((type: BlacklistType): void => {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  }, []);

  const handleActionChange = useCallback((value: string): void => {
    const next = Object.values(BlacklistAction).find((item) => String(item) === value) ?? BlacklistAction.BLOCK;
    setAction(next);
    // Each action starts from every field it can apply to.
    setSelectedTypes(typesFor(next));
    setErrorMessage(null);
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
      if (existing && existing.action === action) {
        existing.types = Array.from(new Set([...existing.types, ...selectedTypes]));
      } else if (existing) {
        // The same word with the other action: the newer choice replaces it —
        // a word cannot both refuse a listing and be removed from it.
        existing.action = action;
        existing.types = [...selectedTypes];
      } else {
        next.push({ keyword, types: [...selectedTypes], action });
      }
    }

    const changed = next.length !== blacklist.length
      || next.some((item) => {
        const old = blacklist.find((b) => b.keyword.toLowerCase() === item.keyword.toLowerCase());
        return !old
          || old.action !== item.action
          || old.types.length !== item.types.length
          || !old.types.every((type) => item.types.includes(type));
      });
    if (!changed) {
      setErrorMessage(t('translation:settingsHub.drawer.blacklist.add.duplicate'));
      return;
    }

    setErrorMessage(null);
    setBlacklist(next);
    setKeywords('');
  }, [keywords, blacklist, selectedTypes, action, t]);

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
    if (blockedText !== originalBlocked.text || blacklist.length !== originalBlacklist.length) {
      return true;
    }
    return blacklist.some((b) => {
      const old = originalBlacklist.find((o) => o.keyword === b.keyword);
      return !old
        || old.action !== b.action
        || old.types.length !== b.types.length
        || !old.types.every((type) => b.types.includes(type));
    });
  }, [blacklist, originalBlacklist, blockedText, originalBlocked]);

  const blockedCount = useMemo(() => parseBlockedAsins(blockedText).length, [blockedText]);

  const isSaveDisabled = isSaving || !hasChanges;

  const handleSave = (): void => {
    const isGlobal = selectedScope === GLOBAL_SCOPE;

    void saveSettings({
      isGlobal,
      storeId: isGlobal ? undefined : selectedScope,
      // An existing row keeps everything this drawer does not own (omitted =
      // unchanged; the tax rate is required by the endpoint, so it is echoed).
      // A store with no row yet is CREATED by this save, and on insert an
      // omitted field takes the column default — so the new row is seeded from
      // the global row instead, keeping the store on the settings it already used.
      ...(config || isGlobal
        ? { amazonTaxRate: config?.amazonTaxRate ?? 0 }
        : buildInheritedStoreFields(globalConfig)),
      blacklist: blacklist.map((b) => ({ keyword: b.keyword, types: b.types, action: b.action })),
      // Untouched = omitted, so a store on the global list keeps inheriting it.
      blockedAsins: toSaveBlockedAsins(blockedText, originalBlocked),
    })
      .unwrap()
      .then(() => {
        notifyDrawerDone({ onClose, showMessage, closeMessage, t });
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
      typeOptions={typesFor(action).map((value) => ({
        value,
        label: t(`translation:settingsHub.drawer.blacklist.add.type.${value}`),
      }))}
      onToggleType={handleToggleType}
      action={action}
      actionOptions={[BlacklistAction.BLOCK, BlacklistAction.REMOVE].map((value) => ({
        value,
        label: t(`translation:settingsHub.drawer.blacklist.add.action.${value}`),
      }))}
      onActionChange={handleActionChange}
      actionLabel={t('translation:settingsHub.drawer.blacklist.add.actionLabel')}
      actionHint={t(`translation:settingsHub.drawer.blacklist.add.actionHint.${action}`)}
      onAdd={handleAdd}
      errorMessage={errorMessage}
      items={items}
      hasKeywords={blacklist.length > 0}
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
      noResultsMessage={t('translation:settingsHub.drawer.blacklist.list.noResults')}
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
      blockedAsinsText={blockedText}
      onBlockedAsinsChange={(e) => setBlockedText(e.target.value)}
      blockedAsinsTitle={t('translation:settingsHub.drawer.blacklist.blockedAsins.title')}
      blockedAsinsHint={t('translation:settingsHub.drawer.blacklist.blockedAsins.hint')}
      blockedAsinsPlaceholder={t('translation:settingsHub.drawer.blacklist.blockedAsins.placeholder')}
      blockedAsinsCountLabel={t('translation:settingsHub.drawer.blacklist.blockedAsins.count', { count: blockedCount })}
      blockedAsinsInheritedLabel={
        originalBlocked.inherited && blockedText === originalBlocked.text
          ? t('translation:settingsHub.drawer.blacklist.blockedAsins.inherited')
          : ''
      }
    />
  );
};

BlacklistDrawer.displayName = 'BlacklistDrawer';
