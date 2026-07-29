import { PlatformSettingType, type PlatformSettingDto } from '@repo/shared';
import { useUI } from '@repo/ui';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useGetAdminSettingsQuery,
  useResetAdminSettingMutation,
  useTestAdminEmailSettingsMutation,
  useUpdateAdminSettingMutation,
} from '../api/admin.api';

import type { UseAdminSettings } from './adminHooks.types';

import { getErrorI18nKey } from '@/utils/errorHandler';

/**
 * Runtime platform settings editing for the admin Settings tab.
 *
 * Text/number fields are edited into a local draft and committed explicitly,
 * so a half-typed number never reaches the API. Booleans have no intermediate
 * state worth holding, so a toggle commits immediately.
 */
export const useAdminSettings = (skip: boolean): UseAdminSettings => {
  const { showMessage, closeMessage } = useUI();
  const { i18n } = useTranslation(['admin', 'translation']);
  const [settingDrafts, setSettingDrafts] = useState<Record<string, string>>({});
  const [emailTestResult, setEmailTestResult] = useState<{ ok: boolean; error: string | null } | null>(
    null
  );

  const { data } = useGetAdminSettingsQuery(undefined, { skip });
  const [updateSetting, { isLoading: isUpdating }] = useUpdateAdminSettingMutation();
  const [resetSetting, { isLoading: isResetting }] = useResetAdminSettingMutation();
  const [testEmail, { isLoading: isTestingEmail }] = useTestAdminEmailSettingsMutation();

  const notifyError = useCallback(
    (descriptionKey: string) => {
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey,
          primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
        },
        i18n.t.bind(i18n)
      );
    },
    [showMessage, closeMessage, i18n]
  );

  const onSettingDraftChange = useCallback((key: string, value: string) => {
    setSettingDrafts((prev) => ({ ...prev, [key]: value }));
  }, []);

  /** Commit a key, then drop its draft so the row shows the stored value again. */
  const commit = useCallback(
    (key: string, value: string) => {
      void updateSetting({ key, value })
        .unwrap()
        .then(() => {
          setSettingDrafts((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        })
        .catch((error: Parameters<typeof getErrorI18nKey>[0]) => notifyError(getErrorI18nKey(error)));
    },
    [updateSetting, notifyError]
  );

  const onSettingSave = useCallback(
    (key: string) => {
      const draft = settingDrafts[key];
      if (draft === undefined || draft.trim().length === 0) {
        return;
      }
      commit(key, draft);
    },
    [settingDrafts, commit]
  );

  const onSettingToggle = useCallback(
    (setting: PlatformSettingDto) => {
      if (setting.type !== PlatformSettingType.BOOLEAN) {
        return;
      }
      commit(setting.key, setting.value === 'true' ? 'false' : 'true');
    },
    [commit]
  );

  const onSettingReset = useCallback(
    (key: string) => {
      void resetSetting(key)
        .unwrap()
        .then(() => {
          setSettingDrafts((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        })
        .catch((error: Parameters<typeof getErrorI18nKey>[0]) => notifyError(getErrorI18nKey(error)));
    },
    [resetSetting, notifyError]
  );

  const onEmailTest = useCallback(() => {
    void testEmail()
      .unwrap()
      .then(setEmailTestResult)
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        setEmailTestResult({ ok: false, error: null });
        notifyError(getErrorI18nKey(error));
      });
  }, [testEmail, notifyError]);

  return {
    settings: data?.settings ?? [],
    settingDrafts,
    isSavingSetting: isUpdating || isResetting,
    emailTestResult,
    isTestingEmail,
    onSettingDraftChange,
    onSettingSave,
    onSettingToggle,
    onSettingReset,
    onEmailTest,
  };
};
