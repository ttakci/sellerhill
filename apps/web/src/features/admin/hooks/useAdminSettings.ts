import { PlatformSettingType, checkPlatformSettingDraft, isPlatformSettingDraftDirty, type PlatformSettingDto } from '@repo/shared';
import { useUI } from '@repo/ui';
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useGetAdminSettingsQuery,
  useResetAdminSettingMutation,
  useTestAdminEmailSettingsMutation,
  useUpdateAdminSettingMutation,
} from '../api/admin.api';

import type { UseAdminSettings } from './adminHooks.types';

import { getErrorI18nKey } from '@/utils/errorHandler';

/** How long a row keeps its "Saved" confirmation. */
const SAVED_FLASH_MS = 2500;

const without = <V>(record: Record<string, V>, key: string): Record<string, V> => {
  const next = { ...record };
  delete next[key];
  return next;
};

/**
 * Runtime platform settings editing for the admin Settings tab.
 *
 * Every row is its own small form: edits live in a local draft, are checked
 * before they leave the browser, and are committed one row at a time — so a
 * half-typed number never reaches the API, a failure is reported next to the
 * field that caused it, and saving one row never disables the others. Booleans
 * have no intermediate state worth holding, so a toggle commits immediately.
 */
export const useAdminSettings = (skip: boolean): UseAdminSettings => {
  const { showMessage, closeMessage } = useUI();
  const { i18n } = useTranslation(['admin', 'translation']);
  const [settingDrafts, setSettingDrafts] = useState<Record<string, string>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [pendingKeys, setPendingKeys] = useState<Record<string, boolean>>({});
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});
  const [resetTarget, setResetTarget] = useState<PlatformSettingDto | null>(null);
  const [emailTestResult, setEmailTestResult] = useState<{ ok: boolean; error: string | null } | null>(
    null
  );
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { data } = useGetAdminSettingsQuery(undefined, { skip });
  const [updateSetting] = useUpdateAdminSettingMutation();
  const [resetSetting] = useResetAdminSettingMutation();
  const [testEmail, { isLoading: isTestingEmail }] = useTestAdminEmailSettingsMutation();

  useEffect(() => {
    const timers = savedTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

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

  const setPending = useCallback((key: string, value: boolean) => {
    setPendingKeys((prev) => (value ? { ...prev, [key]: true } : without(prev, key)));
  }, []);

  const flashSaved = useCallback((key: string) => {
    clearTimeout(savedTimers.current[key]);
    setSavedKeys((prev) => ({ ...prev, [key]: true }));
    savedTimers.current[key] = setTimeout(() => {
      setSavedKeys((prev) => without(prev, key));
    }, SAVED_FLASH_MS);
  }, []);

  const clearDraft = useCallback((key: string) => {
    setSettingDrafts((prev) => without(prev, key));
    setServerErrors((prev) => without(prev, key));
  }, []);

  const onSettingDraftChange = useCallback((key: string, value: string) => {
    setSettingDrafts((prev) => ({ ...prev, [key]: value }));
    setServerErrors((prev) => without(prev, key));
  }, []);

  /** Commit a key. A refusal is shown on that row; the draft is kept so it can be corrected. */
  const commit = useCallback(
    (key: string, value: string) => {
      setPending(key, true);
      setServerErrors((prev) => without(prev, key));
      void updateSetting({ key, value })
        .unwrap()
        .then(() => {
          clearDraft(key);
          flashSaved(key);
        })
        .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
          setServerErrors((prev) => ({ ...prev, [key]: getErrorI18nKey(error) }));
        })
        .finally(() => setPending(key, false));
    },
    [updateSetting, clearDraft, flashSaved, setPending]
  );

  const onSettingSubmit = useCallback(
    (setting: PlatformSettingDto, event: FormEvent) => {
      event.preventDefault();
      const draft = settingDrafts[setting.key];
      if (
        draft === undefined ||
        pendingKeys[setting.key] ||
        !isPlatformSettingDraftDirty(setting.value, draft, setting.isSecret) ||
        !checkPlatformSettingDraft(setting, draft).valid
      ) {
        return;
      }
      commit(setting.key, draft.trim());
    },
    [settingDrafts, pendingKeys, commit]
  );

  const onSettingCancel = useCallback((key: string) => clearDraft(key), [clearDraft]);

  /** Escape abandons the edit, like the Cancel button. */
  const onSettingKeyDown = useCallback(
    (key: string, event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearDraft(key);
      }
    },
    [clearDraft]
  );

  const onSettingToggle = useCallback(
    (setting: PlatformSettingDto) => {
      if (setting.type !== PlatformSettingType.BOOLEAN || pendingKeys[setting.key]) {
        return;
      }
      commit(setting.key, setting.value === 'true' ? 'false' : 'true');
    },
    [commit, pendingKeys]
  );

  const runReset = useCallback(
    (key: string) => {
      setPending(key, true);
      void resetSetting(key)
        .unwrap()
        .then(() => {
          clearDraft(key);
          flashSaved(key);
        })
        .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
          setServerErrors((prev) => ({ ...prev, [key]: getErrorI18nKey(error) }));
        })
        .finally(() => setPending(key, false));
    },
    [resetSetting, clearDraft, flashSaved, setPending]
  );

  /** A secret cannot be read back, so discarding it is confirmed first; anything else resets at once. */
  const onSettingResetRequest = useCallback(
    (setting: PlatformSettingDto) => {
      if (setting.isSecret) {
        setResetTarget(setting);
        return;
      }
      runReset(setting.key);
    },
    [runReset]
  );

  const onSettingResetConfirm = useCallback(() => {
    if (resetTarget) {
      runReset(resetTarget.key);
    }
    setResetTarget(null);
  }, [resetTarget, runReset]);

  const onSettingResetCancel = useCallback(() => setResetTarget(null), []);

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
    serverErrors,
    pendingKeys,
    savedKeys,
    resetTarget,
    emailTestResult,
    isTestingEmail,
    onSettingDraftChange,
    onSettingSubmit,
    onSettingCancel,
    onSettingKeyDown,
    onSettingToggle,
    onSettingResetRequest,
    onSettingResetConfirm,
    onSettingResetCancel,
    onEmailTest,
  };
};
