import type {
  CreateAmazonAccountFormData,
  UpdateAmazonAccountFormData,
} from '@repo/shared';
import { useUI } from '@repo/ui';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AmazonAccountDrawerComponent } from './AmazonAccountDrawer.component';
import type {
  AmazonAccountDrawerFields,
  AmazonAccountDrawerProps,
} from './AmazonAccountDrawer.types';

import {
  useCreateAmazonAccountMutation,
  useUpdateAmazonAccountMutation,
} from '@/features/amazon/api/amazon.api';
import { getErrorI18nKey } from '@/utils/errorHandler';

const PREFIX_ADD = 'translation:settingsHub.drawer.amazonAdd';
const PREFIX_EDIT = 'translation:settingsHub.drawer.amazonEdit';

const EMPTY_FIELDS: AmazonAccountDrawerFields = {
  label: '',
  email: '',
  password: '',
  twoFactorSecret: '',
  // Second gate of auto-fulfillment: the Store Settings toggle arms it for a
  // store (or globally), and each buyer account must opt in here as well. Both
  // must be on before an order is ever purchased on this account.
  autoFulfillEnabled: false,
  autoFulfillCapTotal: '',
};

export const AmazonAccountDrawer: React.FC<AmazonAccountDrawerProps> = ({
  isOpen,
  onClose,
  editingAccount,
  onBack,
}) => {
  const { t } = useTranslation();
  const { showMessage } = useUI();
  const isEdit = !!editingAccount;
  const prefix = isEdit ? PREFIX_EDIT : PREFIX_ADD;

  const [createAccount, { isLoading: isCreating }] = useCreateAmazonAccountMutation();
  const [updateAccount, { isLoading: isUpdating }] = useUpdateAmazonAccountMutation();
  const isSaving = Boolean(isCreating) || Boolean(isUpdating);

  const [fields, setFields] = useState<AmazonAccountDrawerFields>(EMPTY_FIELDS);

  // Prefill on edit; clear on close. React-recommended render-time state reset.
  // currentEditId is normalized to string|null so the equality check is stable
  // (otherwise `undefined !== null` would re-trigger setState every render).
  const currentEditId = editingAccount?.id ?? null;
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevEditId, setPrevEditId] = useState<string | null>(currentEditId);
  if (isOpen !== prevIsOpen || currentEditId !== prevEditId) {
    setPrevIsOpen(isOpen);
    setPrevEditId(currentEditId);
    if (isOpen && editingAccount) {
      setFields({
        label: editingAccount.label ?? '',
        email: editingAccount.email,
        password: '',
        twoFactorSecret: '',
        autoFulfillEnabled: editingAccount.autoFulfillEnabled ?? false,
        autoFulfillCapTotal:
          editingAccount.autoFulfillCapTotal === null ||
          editingAccount.autoFulfillCapTotal === undefined
            ? ''
            : String(editingAccount.autoFulfillCapTotal),
      });
    } else if (isOpen) {
      setFields(EMPTY_FIELDS);
    }
  }

  const handleFieldChange = useCallback(
    (field: keyof Omit<AmazonAccountDrawerFields, 'autoFulfillEnabled'>) =>
      (event: React.ChangeEvent<HTMLInputElement>): void => {
        const { value } = event.target;
        setFields((prev) => ({ ...prev, [field]: value }));
      },
    []
  );

  const handleAutoFulfillEnabledChange = useCallback((checked: boolean): void => {
    setFields((prev) => ({ ...prev, autoFulfillEnabled: checked }));
  }, []);

  /**
   * Surface the backend's own message key. Enabling auto-fulfillment can be
   * refused with `autoFulfillProxyRequired` or `autoFulfillCapRequired`, and a
   * generic "something went wrong" would leave the user with no idea which of
   * the two guards rejected them.
   */
  const showSaveError = useCallback(
    (error: Parameters<typeof getErrorI18nKey>[0]): void => {
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey: getErrorI18nKey(error, 'translation:common.error'),
        },
        t
      );
    },
    [showMessage, t]
  );

  const handleSave = useCallback((): void => {
    // Empty cap field → null (no cap). The backend rejects a null cap while
    // autoFulfillEnabled is on, rather than defaulting to an unbounded spend.
    const capTotal =
      fields.autoFulfillCapTotal.trim() === '' ? null : Number(fields.autoFulfillCapTotal);

    if (isEdit && editingAccount) {
      const data: UpdateAmazonAccountFormData = {
        label: fields.label || undefined,
        email: fields.email,
        password: fields.password || undefined,
        twoFactorSecret: fields.twoFactorSecret || undefined,
        autoFulfillEnabled: fields.autoFulfillEnabled,
        autoFulfillCapTotal: capTotal,
      };
      void updateAccount({ id: editingAccount.id, data })
        .unwrap()
        .then(() => {
          onClose();
        })
        .catch(showSaveError);
      return;
    }

    const payload: CreateAmazonAccountFormData = {
      email: fields.email,
      password: fields.password,
      label: fields.label || undefined,
      twoFactorSecret: fields.twoFactorSecret || undefined,
      autoFulfillEnabled: fields.autoFulfillEnabled,
      autoFulfillCapTotal: capTotal,
    };
    void createAccount(payload)
      .unwrap()
      .then(() => {
        onClose();
      })
      .catch(showSaveError);
  }, [fields, isEdit, editingAccount, updateAccount, createAccount, onClose, showSaveError]);

  return (
    <AmazonAccountDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      prefix={prefix}
      fields={fields}
      isSaving={isSaving}
      onFieldChange={handleFieldChange}
      onAutoFulfillEnabledChange={handleAutoFulfillEnabledChange}
      onSave={handleSave}
    />
  );
};

AmazonAccountDrawer.displayName = 'AmazonAccountDrawer';
