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

export const LinkAmazonModal: React.FC<LinkAmazonModalProps> = ({ isOpen, onClose, orderId, onLinked }) => {
  const { t } = useTranslation(['amazon', 'translation']);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const { data: accountsData } = useGetAmazonAccountsQuery();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [linkAmazonOrder, { isLoading: isLinking }] = useLinkAmazonOrderMutation();

  const accounts: AmazonAccountPublicDto[] = accountsData ?? [];

  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [amazonOrderId, setAmazonOrderId] = useState('');
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (isLinking) {
      return;
    }
    setSelectedAccountId('');
    setAmazonOrderId('');
    setProgress(null);
    setError(null);
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
          setError(res.message);
        }
      })
      .catch((err: { data?: { message?: string } }) => {
        setProgress(null);
        setError(err?.data?.message || t('amazon.linking.errorScraping'));
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
