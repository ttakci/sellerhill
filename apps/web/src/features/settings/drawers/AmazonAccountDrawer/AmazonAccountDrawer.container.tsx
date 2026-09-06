import { AmazonAccountDrawerStep, AmazonMarketplace, normalizeTotpSecret, ProxyConnectionType, SUPPORTED_AMAZON_MARKETPLACES, type CreateAmazonAccountFormData, type UpdateAmazonAccountFormData } from '@repo/shared';
import { useUI } from '@repo/ui';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { notifyDrawerDone } from '../shared/notifyDrawerDone';

import { AmazonAccountDrawerComponent } from './AmazonAccountDrawer.component';
import type {
  AmazonAccountDrawerFields,
  AmazonAccountDrawerProps,
  AmazonAccountFieldErrors,
} from './AmazonAccountDrawer.types';

import {
  useCreateAmazonAccountMutation,
  useUpdateAmazonAccountMutation,
} from '@/features/amazon/api/amazon.api';
import { getErrorI18nKey } from '@/utils/errorHandler';

const PREFIX_ADD = 'translation:settingsHub.drawer.amazonAdd';
const PREFIX_EDIT = 'translation:settingsHub.drawer.amazonEdit';

/**
 * Shown in the 2FA field when editing an account that already has a secret on
 * file — a "one is stored" marker, not the real value (the server never sends
 * it back). Bullets only, so it is an empty-value symbol, not translatable
 * copy. `handleFieldChange` strips these characters, so the first keystroke
 * clears the mask; if the field is still exactly this on save, the secret is
 * left untouched (see `handleSave`).
 */
const STORED_TWO_FACTOR_MASK = '••••••••••••';

const EMPTY_FIELDS: AmazonAccountDrawerFields = {
  label: '',
  email: '',
  password: '',
  twoFactorSecret: '',
  // Only one marketplace exists today (SUPPORTED_AMAZON_MARKETPLACES) — set,
  // never chosen away from, and locked once the account is created.
  marketplace: SUPPORTED_AMAZON_MARKETPLACES[0],
  // Second gate of auto-fulfillment: the Store Settings toggle arms it for a
  // store (or globally), and each buyer account must opt in here as well. Both
  // must be on before an order is ever purchased on this account.
  autoFulfillEnabled: false,
  autoFulfillCapTotal: '',
  // Self-service proxy (migration 080): off by default, so a brand-new
  // account runs bare-IP unless the user explicitly opts in.
  proxyEnabled: false,
  proxyConnectionType: ProxyConnectionType.HTTP,
  proxyHost: '',
  proxyPort: '',
  proxyUsername: '',
  proxyPassword: '',
};

/**
 * Which ACCOUNT-step fields are missing a required value RIGHT NOW, ignoring
 * whether the user has tried to continue yet. The container gates each flag
 * behind `accountSubmitAttempted` before handing it to the component, and
 * blocks the step→step advance while any flag here is true.
 *
 *  - `email` — always required; there is no buyer account without one.
 *  - `password` — required on create only. On EDIT a blank field means
 *    "keep the stored password", so it must not be an error there.
 *  - `twoFactorSecret` — ALWAYS required and never allowed to be empty (Amazon
 *    challenges almost every automated sign-in and a stored TOTP is the only
 *    challenge the workers can answer without a human). On EDIT the field is
 *    prefilled with STORED_TWO_FACTOR_MASK, which is non-empty and so passes —
 *    "untouched mask" means "keep the stored secret" and `handleSave` sends
 *    nothing. Focusing the field clears the mask (`handleTwoFactorSecretFocus`),
 *    so from that point the user MUST type a real secret before Continue is
 *    allowed. The backend re-checks base32 format (`amazon.errors.twoFactorSecret*`).
 *  - `autoFulfillCapTotal` — the backend refuses `autoFulfillEnabled` with a
 *    null cap (`amazon.errors.autoFulfillCapRequired`); flag it here, but only
 *    while the toggle is on, so the user sees a red field instead of a
 *    round-tripped error. `> 0` is also required — a `0` / negative cap skips
 *    every order, which is never what "enable auto-fulfillment" means.
 *
 * label stays optional (sent as `label || undefined`).
 */
const computeAccountFieldErrors = (
  fields: AmazonAccountDrawerFields,
  isEdit: boolean
): AmazonAccountFieldErrors => {
  const capRaw = fields.autoFulfillCapTotal.trim();
  const capInvalid = capRaw === '' || !(Number(capRaw) > 0);

  return {
    email: fields.email.trim() === '',
    password: !isEdit && fields.password.trim() === '',
    // Always required. STORED_TWO_FACTOR_MASK is non-empty so an untouched edit
    // passes; once focus clears it, only a real typed value clears the error.
    twoFactorSecret: fields.twoFactorSecret.trim() === '',
    autoFulfillCapTotal: fields.autoFulfillEnabled && capInvalid,
  };
};

export const AmazonAccountDrawer: React.FC<AmazonAccountDrawerProps> = ({
  isOpen,
  onClose,
  editingAccount,
  onBack,
}) => {
  const { t } = useTranslation(['translation', 'amazon']);
  const { showMessage, closeMessage } = useUI();
  const isEdit = !!editingAccount;
  const prefix = isEdit ? PREFIX_EDIT : PREFIX_ADD;

  const [createAccount, { isLoading: isCreating }] = useCreateAmazonAccountMutation();
  const [updateAccount, { isLoading: isUpdating }] = useUpdateAmazonAccountMutation();
  const isSaving = Boolean(isCreating) || Boolean(isUpdating);

  const [fields, setFields] = useState<AmazonAccountDrawerFields>(EMPTY_FIELDS);
  const [step, setStep] = useState<AmazonAccountDrawerStep>(AmazonAccountDrawerStep.ACCOUNT);
  // Stays false until the user actually presses Continue on the ACCOUNT step —
  // empty fields turn red on that attempt, never before (frontend-rules).
  const [accountSubmitAttempted, setAccountSubmitAttempted] = useState(false);

  // Prefill on edit; clear on close. React-recommended render-time state reset.
  // currentEditId is normalized to string|null so the equality check is stable
  // (otherwise `undefined !== null` would re-trigger setState every render).
  const currentEditId = editingAccount?.id ?? null;
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevEditId, setPrevEditId] = useState<string | null>(currentEditId);
  if (isOpen !== prevIsOpen || currentEditId !== prevEditId) {
    setPrevIsOpen(isOpen);
    setPrevEditId(currentEditId);
    setStep(AmazonAccountDrawerStep.ACCOUNT);
    setAccountSubmitAttempted(false);
    if (isOpen && editingAccount) {
      setFields({
        label: editingAccount.label ?? '',
        email: editingAccount.email,
        password: '',
        // A stored secret is never round-tripped from the server — show a mask
        // so the user knows one is on file. Untouched on save = keep it.
        twoFactorSecret: editingAccount.hasTwoFactor ? STORED_TWO_FACTOR_MASK : '',
        marketplace: editingAccount.marketplace,
        autoFulfillEnabled: editingAccount.autoFulfillEnabled ?? false,
        autoFulfillCapTotal:
          editingAccount.autoFulfillCapTotal === null ||
          editingAccount.autoFulfillCapTotal === undefined
            ? ''
            : String(editingAccount.autoFulfillCapTotal),
        proxyEnabled: editingAccount.proxyEnabled ?? false,
        proxyConnectionType: editingAccount.proxyConnectionType ?? ProxyConnectionType.HTTP,
        proxyHost: editingAccount.proxyHost ?? '',
        proxyPort: editingAccount.proxyPort === null || editingAccount.proxyPort === undefined
          ? ''
          : String(editingAccount.proxyPort),
        proxyUsername: editingAccount.proxyUsername ?? '',
        // Write-only — never round-tripped back from the server. Left blank,
        // it means "keep the stored password" on save.
        proxyPassword: '',
      });
    } else if (isOpen) {
      setFields(EMPTY_FIELDS);
    }
  }

  const handleFieldChange = useCallback(
    (field: keyof Omit<AmazonAccountDrawerFields, 'autoFulfillEnabled' | 'proxyEnabled' | 'proxyConnectionType'>) =>
      (event: React.ChangeEvent<HTMLInputElement>): void => {
        const { value } = event.target;
        // Amazon shows the authenticator secret in space-separated blocks
        // ("ZM7Q ZRGJ …") and sellers paste it verbatim. Normalize on input
        // (strip spaces/-/_, uppercase) with the SAME helper the API uses to
        // store it and feed otplib — so the field shows exactly what gets
        // saved, and a pasted secret is never rejected for its formatting.
        // Bullets are stripped too, so the first keystroke clears the
        // STORED_TWO_FACTOR_MASK and the field holds only the real input.
        const next =
          field === 'twoFactorSecret'
            ? (normalizeTotpSecret(value.replace(/•/g, '')) ?? '')
            : value;
        setFields((prev) => ({ ...prev, [field]: next }));
      },
    []
  );

  // The stored-secret mask is a marker, not editable text — drop it the moment
  // the field is focused so the user types into an empty input. Leaving it
  // empty is fine: on edit with a secret on file, 2FA is not a required field
  // (blank = keep), so "Continue" is never blocked by this.
  const handleTwoFactorSecretFocus = useCallback((): void => {
    setFields((prev) =>
      prev.twoFactorSecret === STORED_TWO_FACTOR_MASK
        ? { ...prev, twoFactorSecret: '' }
        : prev
    );
  }, []);

  const handleAutoFulfillEnabledChange = useCallback((checked: boolean): void => {
    setFields((prev) => ({ ...prev, autoFulfillEnabled: checked }));
  }, []);

  const handleProxyEnabledChange = useCallback((checked: boolean): void => {
    setFields((prev) => ({ ...prev, proxyEnabled: checked }));
  }, []);

  const handleProxyConnectionTypeChange = useCallback((value: ProxyConnectionType): void => {
    setFields((prev) => ({ ...prev, proxyConnectionType: value }));
  }, []);

  const handleMarketplaceChange = useCallback((value: AmazonMarketplace): void => {
    setFields((prev) => ({ ...prev, marketplace: value }));
  }, []);

  const rawAccountErrors = computeAccountFieldErrors(fields, isEdit);
  const accountStepValid =
    !rawAccountErrors.email &&
    !rawAccountErrors.password &&
    !rawAccountErrors.twoFactorSecret &&
    !rawAccountErrors.autoFulfillCapTotal;
  const accountFieldErrors: AmazonAccountFieldErrors = {
    email: accountSubmitAttempted && rawAccountErrors.email,
    password: accountSubmitAttempted && rawAccountErrors.password,
    twoFactorSecret: accountSubmitAttempted && rawAccountErrors.twoFactorSecret,
    autoFulfillCapTotal: accountSubmitAttempted && rawAccountErrors.autoFulfillCapTotal,
  };

  // ACCOUNT-step primary action. The PROXY step saves instead (onSave), so this
  // only ever advances — invalid fields turn red and the step holds.
  const handleContinue = useCallback((): void => {
    if (!accountStepValid) {
      setAccountSubmitAttempted(true);
      return;
    }
    setStep(AmazonAccountDrawerStep.PROXY);
  }, [accountStepValid]);
  const handleStepBack = useCallback((): void => setStep(AmazonAccountDrawerStep.ACCOUNT), []);

  const steps = [
    { label: t('amazon:amazon.accountDrawer.steps.account') },
    { label: t('amazon:amazon.accountDrawer.steps.proxy') },
  ];

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
    const proxyPort = fields.proxyPort.trim() === '' ? null : Number(fields.proxyPort);

    if (isEdit && editingAccount) {
      const data: UpdateAmazonAccountFormData = {
        label: fields.label || undefined,
        email: fields.email,
        password: fields.password || undefined,
        // Blank OR the untouched stored-secret mask both mean "keep the saved
        // 2FA secret" — only a real, edited value is sent.
        twoFactorSecret:
          fields.twoFactorSecret && fields.twoFactorSecret !== STORED_TWO_FACTOR_MASK
            ? fields.twoFactorSecret
            : undefined,
        autoFulfillEnabled: fields.autoFulfillEnabled,
        autoFulfillCapTotal: capTotal,
        proxyEnabled: fields.proxyEnabled,
        proxyConnectionType: fields.proxyConnectionType,
        proxyHost: fields.proxyHost || null,
        proxyPort,
        proxyUsername: fields.proxyUsername || null,
        // Blank means "keep the stored password" — never overwritten with an
        // empty value just because the field wasn't touched this time.
        proxyPassword: fields.proxyPassword || undefined,
      };
      void updateAccount({ id: editingAccount.id, data })
        .unwrap()
        .then(() => {
          notifyDrawerDone({ onClose, showMessage, closeMessage, t });
        })
        .catch(showSaveError);
      return;
    }

    const payload: CreateAmazonAccountFormData = {
      email: fields.email,
      password: fields.password,
      label: fields.label || undefined,
      // Mandatory on create — the ACCOUNT step blocks advance while it is blank.
      twoFactorSecret: fields.twoFactorSecret.trim(),
      marketplace: fields.marketplace,
      autoFulfillEnabled: fields.autoFulfillEnabled,
      autoFulfillCapTotal: capTotal,
      proxyEnabled: fields.proxyEnabled,
      proxyConnectionType: fields.proxyConnectionType,
      proxyHost: fields.proxyHost || null,
      proxyPort,
      proxyUsername: fields.proxyUsername || null,
      proxyPassword: fields.proxyPassword || undefined,
    };
    void createAccount(payload)
      .unwrap()
      .then(() => {
        notifyDrawerDone({ onClose, showMessage, closeMessage, t });
      })
      .catch(showSaveError);
  }, [
    fields,
    isEdit,
    editingAccount,
    updateAccount,
    createAccount,
    onClose,
    showMessage,
    closeMessage,
    t,
    showSaveError,
  ]);

  return (
    <AmazonAccountDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      prefix={prefix}
      isEdit={isEdit}
      fields={fields}
      isSaving={isSaving}
      step={step}
      steps={steps}
      accountFieldErrors={accountFieldErrors}
      onNext={handleContinue}
      onStepBack={handleStepBack}
      onFieldChange={handleFieldChange}
      onTwoFactorSecretFocus={handleTwoFactorSecretFocus}
      onAutoFulfillEnabledChange={handleAutoFulfillEnabledChange}
      onProxyEnabledChange={handleProxyEnabledChange}
      onProxyConnectionTypeChange={handleProxyConnectionTypeChange}
      onMarketplaceChange={handleMarketplaceChange}
      onSave={handleSave}
    />
  );
};

AmazonAccountDrawer.displayName = 'AmazonAccountDrawer';
