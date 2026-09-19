
import type { PlatformSettingDto } from '@repo/shared';
import type { FormEvent, KeyboardEvent } from 'react';
/** Return shape of `useAdminSettings`. */
export interface UseAdminSettings {
  settings: PlatformSettingDto[];
  /** Unsaved edits, keyed by setting key. Absent = showing the stored value. */
  settingDrafts: Record<string, string>;
  /** i18n key of the last refusal for a row, until that row is edited again. */
  serverErrors: Record<string, string>;
  /** Rows with a request in flight — only that row is locked. */
  pendingKeys: Record<string, boolean>;
  /** Rows that were just saved; cleared after a short confirmation. */
  savedKeys: Record<string, boolean>;
  /** The secret setting waiting for a reset confirmation. */
  resetTarget: PlatformSettingDto | null;
  /** Result of the last SMTP verification; null until one has run. */
  emailTestResult: { ok: boolean; error: string | null } | null;
  isTestingEmail: boolean;
  onSettingDraftChange: (key: string, value: string) => void;
  onSettingSubmit: (setting: PlatformSettingDto, event: FormEvent) => void;
  onSettingCancel: (key: string) => void;
  onSettingKeyDown: (key: string, event: KeyboardEvent) => void;
  onSettingToggle: (setting: PlatformSettingDto) => void;
  onSettingResetRequest: (setting: PlatformSettingDto) => void;
  onSettingResetConfirm: () => void;
  onSettingResetCancel: () => void;
  onEmailTest: () => void;
}
