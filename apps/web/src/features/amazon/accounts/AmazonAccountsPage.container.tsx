import { useLoading, useUI } from '@repo/ui';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';


import {
  useCreateAmazonAccountMutation,
  useDeleteAmazonAccountMutation,
  useGetAmazonAccountsQuery,
  useUpdateAmazonAccountMutation,
  useVerifyAmazonAccountMutation,
} from '../api/amazon.api';

import { AmazonAccountsPageComponent } from './AmazonAccountsPage.component';
import type { AccountFormState } from './AmazonAccountsPage.types';

import { getErrorI18nKey } from '@/utils/errorHandler';

const EMPTY_FORM: AccountFormState = {
  label: '',
  email: '',
  password: '',
  twoFactorSecret: '',
};

export const AmazonAccountsPageContainer = (): React.ReactElement => {
  const { showMessage, closeMessage } = useUI();
  const { i18n } = useTranslation(['amazon', 'translation']);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<import('@repo/shared').AmazonAccountPublicDto | null>(null);
  const [isVerifying, setIsVerifying] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<AccountFormState>(EMPTY_FORM);

  const { data: accounts, isLoading } = useGetAmazonAccountsQuery();
  const [createAccount, { isLoading: isCreating }] = useCreateAmazonAccountMutation();
  const [updateAccount, { isLoading: isUpdating }] = useUpdateAmazonAccountMutation();
  const [deleteAccount] = useDeleteAmazonAccountMutation();
  const [verifyAccount] = useVerifyAmazonAccountMutation();

  useLoading(isLoading);

  const isSaving = isCreating || isUpdating;

  const handleFormChange = useCallback((field: keyof AccountFormState, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const buildSubmitData = useCallback(() => {
    const data: Record<string, string> = {};
    if (formValues.label) {data.label = formValues.label;}
    if (formValues.email) {data.email = formValues.email;}
    if (formValues.password) {data.password = formValues.password;}
    if (formValues.twoFactorSecret) {data.twoFactorSecret = formValues.twoFactorSecret;}
    return data;
  }, [formValues]);

  const handleSubmitForm = useCallback(() => {
    const data = buildSubmitData();
    if (editingAccount) {
      void updateAccount({ id: editingAccount.id, data })
        .unwrap()
        .then(() => {
          setEditingAccount(null);
          setFormValues(EMPTY_FORM);
          showMessage(
            {
              type: 'success',
              headerKey: 'translation:message.success.header',
              descriptionKey: 'amazon.accounts.saveSuccess',
              primaryButton: { labelKey: 'translation:message.success.close', onClick: closeMessage },
            },
            i18n.t.bind(i18n)
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
            i18n.t.bind(i18n)
          );
        });
    } else {
      void createAccount(data as { label?: string; email: string; password: string; twoFactorSecret?: string })
        .unwrap()
        .then(() => {
          setIsAddModalOpen(false);
          setFormValues(EMPTY_FORM);
          showMessage(
            {
              type: 'success',
              headerKey: 'translation:message.success.header',
              descriptionKey: 'amazon.accounts.saveSuccess',
              primaryButton: { labelKey: 'translation:message.success.close', onClick: closeMessage },
            },
            i18n.t.bind(i18n)
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
            i18n.t.bind(i18n)
          );
        });
    }
  }, [editingAccount, buildSubmitData, createAccount, updateAccount, closeMessage, i18n, showMessage]);

  const handleAdd = useCallback(
    (data: { label?: string; email: string; password: string; twoFactorSecret?: string }) => {
      void createAccount(data)
        .unwrap()
        .then(() => {
          setIsAddModalOpen(false);
          showMessage(
            {
              type: 'success',
              headerKey: 'translation:message.success.header',
              descriptionKey: 'amazon.accounts.saveSuccess',
              primaryButton: { labelKey: 'translation:message.success.close', onClick: closeMessage },
            },
            i18n.t.bind(i18n)
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
            i18n.t.bind(i18n)
          );
        });
    },
    [createAccount, closeMessage, i18n, showMessage]
  );

  const handleEdit = useCallback(
    (id: string, data: { label?: string; password?: string; twoFactorSecret?: string }) => {
      void updateAccount({ id, data })
        .unwrap()
        .then(() => {
          setEditingAccount(null);
          showMessage(
            {
              type: 'success',
              headerKey: 'translation:message.success.header',
              descriptionKey: 'amazon.accounts.saveSuccess',
              primaryButton: { labelKey: 'translation:message.success.close', onClick: closeMessage },
            },
            i18n.t.bind(i18n)
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
            i18n.t.bind(i18n)
          );
        });
    },
    [updateAccount, closeMessage, i18n, showMessage]
  );

  const handleDelete = useCallback(
    (id: string) => {
      void deleteAccount(id)
        .unwrap()
        .then(() => {
          showMessage(
            {
              type: 'success',
              headerKey: 'translation:message.success.header',
              descriptionKey: 'amazon.accounts.deleteSuccess',
              primaryButton: { labelKey: 'translation:message.success.close', onClick: closeMessage },
            },
            i18n.t.bind(i18n)
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
            i18n.t.bind(i18n)
          );
        });
    },
    [deleteAccount, closeMessage, i18n, showMessage]
  );

  const handleVerify = useCallback(
    (id: string) => {
      setIsVerifying(id);
      void verifyAccount(id)
        .unwrap()
        .then((result) => {
          setIsVerifying(null);
          const key = result.success ? 'amazon.accounts.verifySuccess' : 'amazon.accounts.verifyFailed';
          showMessage(
            {
              type: result.success ? 'success' : 'error',
              headerKey: 'translation:message.success.header',
              descriptionKey: key,
              primaryButton: { labelKey: 'translation:message.success.close', onClick: closeMessage },
            },
            i18n.t.bind(i18n)
          );
        })
        .catch(() => {
          setIsVerifying(null);
        });
    },
    [verifyAccount, closeMessage, i18n, showMessage]
  );

  return (
    <AmazonAccountsPageComponent
      accounts={accounts || []}
      isSaving={isSaving}
      isVerifying={isVerifying}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onVerify={handleVerify}
      editingAccount={editingAccount}
      isAddModalOpen={isAddModalOpen}
      onOpenAddModal={() => {
        setFormValues(EMPTY_FORM);
        setEditingAccount(null);
        setIsAddModalOpen(true);
      }}
      onCloseModal={() => {
        setIsAddModalOpen(false);
        setEditingAccount(null);
        setFormValues(EMPTY_FORM);
      }}
      formValues={formValues}
      onFormChange={handleFormChange}
      onSubmitForm={handleSubmitForm}
    />
  );
};
