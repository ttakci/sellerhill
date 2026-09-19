import {
  PlatformSettingCategory,
  PlatformSettingSource,
  PlatformSettingType,
  checkPlatformSettingDraft,
  isPlatformSettingDraftDirty,
  type PlatformSettingDto,
} from '@repo/shared';
import React, { useCallback, useMemo, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useAdminSettings } from '../../hooks/useAdminSettings';

import { AdminSettingsPanelComponent } from './AdminSettingsPanel.component';
import {
  AdminSettingsFilter,
  type AdminSettingsPanelProps,
  type SettingGroupView,
  type SettingRowView,
} from './AdminSettingsPanel.types';

const CATEGORY_ORDER: PlatformSettingCategory[] = [
  PlatformSettingCategory.KEEPA,
  PlatformSettingCategory.LLM,
  PlatformSettingCategory.EBAY,
  PlatformSettingCategory.AMAZON,
  PlatformSettingCategory.AUTO_FULFILL,
  PlatformSettingCategory.BILLING,
  PlatformSettingCategory.BUYER_MESSAGING,
  PlatformSettingCategory.EMAIL,
  PlatformSettingCategory.ADMIN,
  PlatformSettingCategory.RETENTION,
];

export const AdminSettingsPanelContainer = ({ skip }: AdminSettingsPanelProps): React.ReactElement => {
  const { t } = useTranslation(['admin', 'translation']);
  const settings = useAdminSettings(skip);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AdminSettingsFilter>(AdminSettingsFilter.ALL);
  const [collapsed, setCollapsed] = useState<Set<PlatformSettingCategory>>(() => new Set());

  const onQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, []);

  const onFilterChange = useCallback((value: string) => {
    setFilter(String(value) === String(AdminSettingsFilter.CHANGED) ? AdminSettingsFilter.CHANGED : AdminSettingsFilter.ALL);
  }, []);

  const onToggleCategory = useCallback((category: PlatformSettingCategory) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const buildRow = useCallback(
    (setting: PlatformSettingDto): SettingRowView => {
      const draft = settings.settingDrafts[setting.key];
      const isDirty = isPlatformSettingDraftDirty(setting.value, draft, setting.isSecret);
      const check = draft === undefined ? { valid: true as const } : checkPlatformSettingDraft(setting, draft);
      const serverError = settings.serverErrors[setting.key];
      let errorText: string | undefined;
      if (serverError) {
        errorText = t(serverError, { defaultValue: t('translation:error.serverError') });
      } else if (isDirty && !check.valid) {
        errorText = t(`admin.settings.validation.${check.issue}`, { bound: check.bound });
      }
      let inputType: SettingRowView['inputType'] = 'text';
      if (setting.isSecret) {
        inputType = 'password';
      } else if (setting.type === PlatformSettingType.NUMBER) {
        inputType = 'number';
      }
      const isPending = Boolean(settings.pendingKeys[setting.key]);
      return {
        setting,
        title: t(`admin.settings.keys.${setting.key}`, { defaultValue: setting.key }),
        description: t(`admin.settings.descriptions.${setting.key}`, {
          defaultValue: t('admin.settings.noDescription'),
        }),
        inputId: `platform-setting-${setting.key}`,
        inputType,
        inputLabel: setting.isSecret ? t('admin.settings.newValueLabel') : t('admin.settings.valueLabel'),
        value: draft ?? (setting.isSecret ? '' : (setting.value ?? '')),
        isDirty,
        isPending,
        isSaved: Boolean(settings.savedKeys[setting.key]),
        canSave: isDirty && check.valid && !isPending,
        isOverridden: setting.source === PlatformSettingSource.DATABASE,
        errorText,
      };
    },
    [settings.settingDrafts, settings.serverErrors, settings.pendingKeys, settings.savedKeys, t]
  );

  const groups = useMemo<SettingGroupView[]>(() => {
    const needle = query.trim().toLowerCase();
    const isSearching = needle.length > 0;
    return CATEGORY_ORDER.map((category) => {
      const rows = settings.settings
        .filter((s) => s.category === category)
        .map(buildRow)
        .filter((row) => {
          if (String(filter) === String(AdminSettingsFilter.CHANGED) && !row.isOverridden) {
            return false;
          }
          if (!isSearching) {
            return true;
          }
          return [row.title, row.setting.key, row.setting.envVar].some((text) =>
            text.toLowerCase().includes(needle)
          );
        });
      return {
        category,
        title: t(`admin.settings.category.${category}`),
        rows,
        changedCount: rows.filter((row) => row.isOverridden).length,
        // Searching or filtering opens every group that has a hit, so a match is never hidden.
        isOpen: isSearching || filter !== AdminSettingsFilter.ALL || !collapsed.has(category),
      };
    }).filter((group) => group.rows.length > 0);
  }, [settings.settings, buildRow, query, filter, collapsed, t]);

  const filterOptions = useMemo(
    () => [
      { label: t('admin.settings.filter.all'), value: AdminSettingsFilter.ALL },
      { label: t('admin.settings.filter.changed'), value: AdminSettingsFilter.CHANGED },
    ],
    [t]
  );

  const resetTargetTitle = settings.resetTarget
    ? t(`admin.settings.keys.${settings.resetTarget.key}`, { defaultValue: settings.resetTarget.key })
    : null;

  return (
    <AdminSettingsPanelComponent
      groups={groups}
      query={query}
      filter={filter}
      filterOptions={filterOptions}
      hasResults={groups.length > 0}
      emailTestResult={settings.emailTestResult}
      isTestingEmail={settings.isTestingEmail}
      resetTargetTitle={resetTargetTitle}
      onQueryChange={onQueryChange}
      onFilterChange={onFilterChange}
      onToggleCategory={onToggleCategory}
      onDraftChange={settings.onSettingDraftChange}
      onSubmit={settings.onSettingSubmit}
      onCancel={settings.onSettingCancel}
      onKeyDown={settings.onSettingKeyDown}
      onToggle={settings.onSettingToggle}
      onResetRequest={settings.onSettingResetRequest}
      onResetConfirm={settings.onSettingResetConfirm}
      onResetCancel={settings.onSettingResetCancel}
      onEmailTest={settings.onEmailTest}
    />
  );
};
