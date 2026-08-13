import type { PlatformSettingDto } from '@repo/shared';

/** Return shape of `useAdminSettings`. */
export interface UseAdminSettings {
  settings: PlatformSettingDto[];
  /** Unsaved edits, keyed by setting key. Absent = showing the stored value. */
  settingDrafts: Record<string, string>;
  isSavingSetting: boolean;
  /** Result of the last SMTP verification; null until one has run. */
  emailTestResult: { ok: boolean; error: string | null } | null;
  isTestingEmail: boolean;
  onSettingDraftChange: (key: string, value: string) => void;
  onSettingSave: (key: string) => void;
  onSettingToggle: (setting: PlatformSettingDto) => void;
  onSettingReset: (key: string) => void;
  onEmailTest: () => void;
}
