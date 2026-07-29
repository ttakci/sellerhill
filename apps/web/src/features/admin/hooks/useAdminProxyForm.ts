import { ProxyStatus, createProxyFormSchema, type AdminProxyDto } from '@repo/shared';
import { useUI } from '@repo/ui';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ProxyFormState } from '../AdminPage/AdminPage.types';
import { useCreateAdminProxyMutation, useUpdateAdminProxyMutation } from '../api/admin.api';

import type { UseAdminProxyForm } from './adminHooks.types';

import { getErrorI18nKey } from '@/utils/errorHandler';

const EMPTY_PROXY_FORM: ProxyFormState = {
  host: '',
  port: '',
  username: '',
  password: '',
  label: '',
  expiresAt: '',
  monthlyCostUsd: '',
};

/** Micro-USD is the platform's cost unit; the form collects plain USD. */
const MICROS_PER_USD = 1_000_000;

/**
 * Add-proxy form + status toggling for the admin Proxies tab.
 *
 * Assignment is deliberately absent: the backend claims proxies for users
 * atomically, so the panel only ever registers capacity or disables a burned
 * proxy — it never picks who gets which IP.
 */
export const useAdminProxyForm = (): UseAdminProxyForm => {
  const { showMessage, closeMessage } = useUI();
  const { i18n } = useTranslation(['admin', 'translation']);
  const [proxyForm, setProxyForm] = useState<ProxyFormState>(EMPTY_PROXY_FORM);
  const [createProxy, { isLoading: isCreating }] = useCreateAdminProxyMutation();
  const [updateProxy, { isLoading: isUpdating }] = useUpdateAdminProxyMutation();

  const notify = useCallback(
    (type: 'success' | 'error', descriptionKey: string) => {
      showMessage(
        {
          type,
          headerKey: `translation:message.${type}.header`,
          descriptionKey,
          primaryButton: { labelKey: `translation:message.${type}.close`, onClick: closeMessage },
        },
        i18n.t.bind(i18n)
      );
    },
    [showMessage, closeMessage, i18n]
  );

  const onProxyFieldChange = useCallback((field: keyof ProxyFormState, value: string) => {
    setProxyForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const onProxySubmit = useCallback(() => {
    const parsed = createProxyFormSchema.safeParse({
      host: proxyForm.host.trim(),
      port: proxyForm.port,
      username: proxyForm.username.trim(),
      password: proxyForm.password,
      label: proxyForm.label.trim() || undefined,
      expiresAt: proxyForm.expiresAt || undefined,
      monthlyCostUsd: proxyForm.monthlyCostUsd || undefined,
    });
    if (!parsed.success) {
      notify('error', 'admin.proxies.formInvalid');
      return;
    }
    const { host, port, username, password, label, expiresAt, monthlyCostUsd } = parsed.data;
    void createProxy({
      host,
      port,
      username,
      password,
      label,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      // Cost and currency are pair-coupled: omitting both leaves the cost
      // unknown, which the API keeps as null rather than a fabricated 0.
      monthlyCostMicros:
        monthlyCostUsd === undefined ? undefined : Math.round(monthlyCostUsd * MICROS_PER_USD),
      currency: monthlyCostUsd === undefined ? undefined : 'USD',
    })
      .unwrap()
      .then(() => {
        setProxyForm(EMPTY_PROXY_FORM);
        notify('success', 'admin.proxies.createSuccess');
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => notify('error', getErrorI18nKey(error)));
  }, [proxyForm, createProxy, notify]);

  const onProxyToggleStatus = useCallback(
    (proxy: AdminProxyDto) => {
      void updateProxy({
        id: proxy.id,
        status: proxy.status === ProxyStatus.ACTIVE ? ProxyStatus.DISABLED : ProxyStatus.ACTIVE,
      })
        .unwrap()
        .catch((error: Parameters<typeof getErrorI18nKey>[0]) => notify('error', getErrorI18nKey(error)));
    },
    [updateProxy, notify]
  );

  return {
    proxyForm,
    isSavingProxy: isCreating || isUpdating,
    onProxyFieldChange,
    onProxySubmit,
    onProxyToggleStatus,
  };
};
