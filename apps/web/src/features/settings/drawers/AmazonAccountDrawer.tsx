import type {
  CreateAmazonAccountFormData,
  UpdateAmazonAccountFormData,
} from '@repo/shared';
import { Badge, Drawer, ModernTextInput, Text, Toggle, useUI } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BodyStack, FormCard, ToggleRow } from './AmazonAccountDrawer.style';
import type { AmazonAccountDrawerProps } from './AmazonAccountDrawer.types';

import {
  useCreateAmazonAccountMutation,
  useUpdateAmazonAccountMutation,
} from '@/features/amazon/api/amazon.api';
import { getErrorI18nKey } from '@/utils/errorHandler';

const PREFIX_ADD = 'translation:settingsHub.drawer.amazonAdd';
const PREFIX_EDIT = 'translation:settingsHub.drawer.amazonEdit';

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

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [createAccount, { isLoading: isCreating }] = useCreateAmazonAccountMutation();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [updateAccount, { isLoading: isUpdating }] = useUpdateAmazonAccountMutation();
  // Coerce to boolean — the RTK Query hook results carry `any` here, which would
  // otherwise propagate into isLoading props as unsafe assignments.
  const isSaving = Boolean(isCreating) || Boolean(isUpdating);

  const [label, setLabel] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  // Second gate of auto-fulfillment: the Store Settings toggle arms it for a
  // store (or globally), and each buyer account must opt in here as well. Both
  // must be on before an order is ever purchased on this account.
  const [autoFulfillEnabled, setAutoFulfillEnabled] = useState(false);
  // Held as a string so the field can be cleared; empty means "no cap", which
  // the backend rejects while autoFulfillEnabled is on.
  const [autoFulfillCapTotal, setAutoFulfillCapTotal] = useState('');

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
      setLabel(editingAccount.label ?? '');
      setEmail(editingAccount.email);
      setPassword('');
      setTwoFactorSecret('');
      setAutoFulfillEnabled(editingAccount.autoFulfillEnabled ?? false);
      setAutoFulfillCapTotal(
        editingAccount.autoFulfillCapTotal === null || editingAccount.autoFulfillCapTotal === undefined
          ? ''
          : String(editingAccount.autoFulfillCapTotal),
      );
    } else if (isOpen) {
      setLabel('');
      setEmail('');
      setPassword('');
      setTwoFactorSecret('');
      setAutoFulfillEnabled(false);
      setAutoFulfillCapTotal('');
    }
  }

  /**
   * Surface the backend's own message key. Enabling auto-fulfillment can be
   * refused with `autoFulfillProxyRequired` or `autoFulfillCapRequired`, and a
   * generic "something went wrong" would leave the user with no idea which of
   * the two guards rejected them.
   */
  const showSaveError = (error: Parameters<typeof getErrorI18nKey>[0]): void => {
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: getErrorI18nKey(error, 'translation:common.error'),
      },
      t,
    );
  };

  // Empty cap field → null (no cap). The backend rejects a null cap while
  // autoFulfillEnabled is on, rather than defaulting to an unbounded spend.
  const capTotal = autoFulfillCapTotal.trim() === '' ? null : Number(autoFulfillCapTotal);

  const handleSave = (): void => {
    if (isEdit && editingAccount) {
      const data: UpdateAmazonAccountFormData = {
        label: label || undefined,
        email,
        password: password || undefined,
        twoFactorSecret: twoFactorSecret || undefined,
        autoFulfillEnabled,
        autoFulfillCapTotal: capTotal,
      };
      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      void updateAccount({ id: editingAccount.id, data })
        .unwrap()
        .then(() => {
          onClose();
        })
        .catch(showSaveError);
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      return;
    }

    const payload: CreateAmazonAccountFormData = {
      email,
      password,
      label: label || undefined,
      twoFactorSecret: twoFactorSecret || undefined,
      autoFulfillEnabled,
      autoFulfillCapTotal: capTotal,
    };
    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    void createAccount(payload)
      .unwrap()
      .then(() => {
        onClose();
      })
      .catch(showSaveError);
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t(`${prefix}.title`)}
      subtitle={t(`${prefix}.subtitle`)}
      onBack={onBack}
      backAriaLabel={t('translation:common.back')}
      size="md"
      primaryAction={{
        label: t('translation:common.save'),
        onClick: handleSave,
        isLoading: isSaving,
      }}
    >
      <BodyStack>
        <FormCard>
          <ModernTextInput
            name="label"
            label={t(`${prefix}.label`)}
            value={label}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value)}
          />
          <ModernTextInput
            name="email"
            label={t(`${prefix}.email`)}
            value={email}
            type="email"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          />
          <ModernTextInput
            name="password"
            label={t(`${prefix}.password`)}
            value={password}
            type="password"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          />
          {isEdit && (
            <Text variant="caption" color="text.tertiary">
              {t('translation:settingsHub.drawer.amazonEdit.passwordHint')}
            </Text>
          )}
          <ModernTextInput
            name="twoFactorSecret"
            label={t(`${prefix}.twoFactorSecret`)}
            value={twoFactorSecret}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTwoFactorSecret(e.target.value)}
          />
          {isEdit && (
            <Text variant="caption" color="text.tertiary">
              <Badge variant={editingAccount?.hasTwoFactor ? 'success' : 'neutral'} size="sm">
                {t(
                  editingAccount?.hasTwoFactor
                    ? 'translation:settingsHub.drawer.amazonEdit.twoFactorBadgeSet'
                    : 'translation:settingsHub.drawer.amazonEdit.twoFactorBadgeNotSet',
                )}
              </Badge>{' '}
              {t('translation:settingsHub.drawer.amazonEdit.twoFactorHint')}
            </Text>
          )}
        </FormCard>

        <FormCard>
          <Text variant="h5" weight="semibold">
            {t('amazon:amazon.autoFulfill.sectionTitle')}
          </Text>
          <Text variant="caption" color="text.secondary">
            {t('amazon:amazon.autoFulfill.sectionSubtitle')}
          </Text>
          <ToggleRow>
            <Text variant="body-sm">{t('amazon:amazon.autoFulfill.autoFulfillEnabled')}</Text>
            <Toggle checked={autoFulfillEnabled} onChange={setAutoFulfillEnabled} />
          </ToggleRow>
          <Text variant="caption" color="text.tertiary">
            {t('amazon:amazon.autoFulfill.autoFulfillEnabledHint')}
          </Text>
          <ModernTextInput
            name="autoFulfillCapTotal"
            type="number"
            label={t('amazon:amazon.autoFulfill.autoFulfillCapTotal')}
            placeholder={t('amazon:amazon.autoFulfill.autoFulfillCapTotalPlaceholder')}
            value={autoFulfillCapTotal}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setAutoFulfillCapTotal(e.target.value)
            }
          />
          <Text variant="caption" color="text.tertiary">
            {t('amazon:amazon.autoFulfill.autoFulfillCapTotalHint')}
          </Text>
        </FormCard>
      </BodyStack>
    </Drawer>
  );
};

AmazonAccountDrawer.displayName = 'AmazonAccountDrawer';
