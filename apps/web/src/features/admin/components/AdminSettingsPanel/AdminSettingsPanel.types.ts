import type { PlatformSettingCategory, PlatformSettingDto } from '@repo/shared';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';

export interface AdminSettingsPanelProps {
  /** Skip fetching until the admin role has been confirmed. */
  skip: boolean;
}

/** Which rows the toolbar filter keeps. */
export enum AdminSettingsFilter {
  ALL = 'all',
  CHANGED = 'changed',
}

/** One setting, resolved to exactly what its row renders. */
export interface SettingRowView {
  setting: PlatformSettingDto;
  title: string;
  description: string;
  inputId: string;
  inputType: 'text' | 'number' | 'password';
  inputLabel: string;
  value: string;
  isDirty: boolean;
  isPending: boolean;
  isSaved: boolean;
  canSave: boolean;
  /** A database override is in effect (the row can be reset). */
  isOverridden: boolean;
  errorText: string | undefined;
}

export interface SettingGroupView {
  category: PlatformSettingCategory;
  title: string;
  rows: SettingRowView[];
  changedCount: number;
  isOpen: boolean;
}

export interface AdminSettingsPanelComponentProps {
  groups: SettingGroupView[];
  query: string;
  filter: AdminSettingsFilter;
  filterOptions: { label: string; value: string }[];
  hasResults: boolean;
  emailTestResult: { ok: boolean; error: string | null } | null;
  isTestingEmail: boolean;
  resetTargetTitle: string | null;
  onQueryChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFilterChange: (value: string) => void;
  onToggleCategory: (category: PlatformSettingCategory) => void;
  onDraftChange: (key: string, value: string) => void;
  onSubmit: (setting: PlatformSettingDto, event: FormEvent) => void;
  onCancel: (key: string) => void;
  onKeyDown: (key: string, event: KeyboardEvent) => void;
  onToggle: (setting: PlatformSettingDto) => void;
  onResetRequest: (setting: PlatformSettingDto) => void;
  onResetConfirm: () => void;
  onResetCancel: () => void;
  onEmailTest: () => void;
}
