import { type AmazonAccountPublicDto } from '@repo/shared';
import { Dialog, ModernTextInput, Text } from '@repo/ui';
import React, { type ChangeEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useGetAmazonAccountsQuery,
  useLinkAmazonOrderMutation,
} from '../api/amazon.api';

import * as S from './LinkAmazonModal.style';
import type { LinkAmazonModalProps, LinkResult } from './LinkAmazonModal.types';

import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

export const LinkAmazonModal: React.FC<LinkAmazonModalProps> = ({
  isOpen,
  onClose,
  orderId,
  hasListing,
  onLinked,
}) => {
  const { t } = useTranslation(['amazon', 'translation']);
  const { localeNavigate } = useLocale();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const { data: accountsData } = useGetAmazonAccountsQuery();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [linkAmazonOrder, { isLoading: isLinking }] = useLinkAmazonOrderMutation();

  const accounts: AmazonAccountPublicDto[] = accountsData ?? [];

  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [amazonOrderId, setAmazonOrderId] = useState('');
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * The seller was warned that this order has no listing and chose to link
   * anyway. Reset on close, so the warning is shown once per attempt rather
   * than once per session.
   */
  const [linkWithoutListing, setLinkWithoutListing] = useState(false);

  const handleClose = () => {
    if (isLinking) {
      return;
    }
    setSelectedAccountId('');
    setAmazonOrderId('');
    setProgress(null);
    setError(null);
    setLinkWithoutListing(false);
    onClose();
  };

  const handleLink = () => {
    if (!selectedAccountId || !amazonOrderId) {
      return;
    }

    setProgress(t('amazon.linking.progressLoggingIn'));
    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const promise = linkAmazonOrder({
      orderId,
      amazonAccountId: selectedAccountId,
      amazonOrderId,
    }) as { unwrap: () => Promise<LinkResult> };

    void promise
      .unwrap()
      .then((res: LinkResult) => {
        if (res.success) {
          setProgress(null);
          onLinked();
          handleClose();
        } else {
          setProgress(null);
          setError(
            res.reason === 'cost_capture_failed'
              ? t('amazon.linking.costCaptureFailed')
              : res.message,
          );
        }
      })
      .catch((err: unknown) => {
        setProgress(null);
        // The API answers with an i18n KEY, never a sentence — printing
        // `err.data.message` straight out put `billing.errors.…` in front of
        // the seller. `getErrorI18nKey` is the same resolver the rest of the
        // app uses; an empty fallback means "no key came back", which is the
        // only case the generic scraping message is right for.
        const key = getErrorI18nKey(err as Parameters<typeof getErrorI18nKey>[0], '');
        setError(key ? t(key) : t('amazon.linking.errorScraping'));
      });
  };

  const hasAccounts = accounts.length > 0;

  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedAccountId(e.target.value);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAmazonOrderId(e.target.value);
  };

  if (!hasAccounts) {
    return (
      <Dialog
        isOpen={isOpen}
        onClose={handleClose}
        type="warning"
        title={t('amazon.linking.noAccountsTitle')}
        description={t('amazon.linking.noAccountsMessage')}
        primaryAction={{
          label: t('amazon.linking.addAccountLink'),
          onClick: () => {
            window.location.href = `/${window.location.pathname.split('/')[1]}/settings`;
          },
          variant: 'primary',
        }}
        secondaryAction={{
          label: t('translation:common.cancel'),
          onClick: handleClose,
          variant: 'secondary',
        }}
      />
    );
  }

  if (!hasListing && !linkWithoutListing) {
    return (
      <Dialog
        isOpen={isOpen}
        onClose={handleClose}
        type="warning"
        title={t('amazon.linking.noListingTitle')}
        description={t('amazon.linking.noListingMessage')}
        primaryAction={{
          label: t('amazon.linking.importListingButton'),
          onClick: () => {
            handleClose();
            localeNavigate('/listings?drawer=import');
          },
          variant: 'primary',
        }}
        secondaryAction={{
          label: t('amazon.linking.linkAnywayButton'),
          onClick: () => setLinkWithoutListing(true),
          variant: 'secondary',
        }}
      />
    );
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      type="info"
      title={t('amazon.linking.title')}
      description={t('amazon.linking.orderIdHelp')}
      primaryAction={{
        label: isLinking ? t('amazon.linking.linkingButton') : t('amazon.linking.linkButton'),
        onClick: handleLink,
        variant: 'primary',
        isLoading: Boolean(isLinking),
        disabled: !selectedAccountId || !amazonOrderId || Boolean(isLinking),
      }}
      secondaryAction={{
        label: t('translation:common.cancel'),
        onClick: handleClose,
        variant: 'secondary',
        disabled: Boolean(isLinking),
      }}
    >
      <S.BodyStack>
        <div>
          <S.AccountLabel variant="h5" weight="medium">
            {t('amazon.linking.selectAccount')}
          </S.AccountLabel>
          <S.NativeSelect value={selectedAccountId} onChange={handleSelectChange}>
            <option value="">{t('amazon.linking.selectAccountPlaceholder')}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label || account.email} ({account.status})
              </option>
            ))}
          </S.NativeSelect>
        </div>

        <ModernTextInput
          name="amazonOrderId"
          label={t('amazon.linking.orderId')}
          placeholder={t('amazon.linking.orderIdPlaceholder')}
          value={amazonOrderId}
          onChange={handleInputChange}
        />

        {progress ? (
          <Text variant="body-sm" color="text.secondary">
            {progress}
          </Text>
        ) : null}

        {error ? (
          <Text variant="body-sm" color="semantic.error">
            {error}
          </Text>
        ) : null}
      </S.BodyStack>
    </Dialog>
  );
};
