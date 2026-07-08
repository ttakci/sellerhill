import { type AmazonAccountPublicDto } from '@repo/shared';
import { Button, Modal, ModernTextInput, Text } from '@repo/ui';
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

  // RTK Query hooks return any due to baseApi generic params; explicit casts below
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const { data: accountsData } = useGetAmazonAccountsQuery();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [linkAmazonOrder, { isLoading: isLinking }] = useLinkAmazonOrderMutation();

  const accounts: AmazonAccountPublicDto[] = (accountsData as AmazonAccountPublicDto[] | undefined) ?? [];

  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [amazonOrderId, setAmazonOrderId] = useState('');
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLink = () => {
    if (!selectedAccountId || !amazonOrderId) {return;}

    setProgress(t('amazon.linking.progressLoggingIn'));
    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const promise = linkAmazonOrder({
      orderId,
      amazonAccountId: selectedAccountId,
      amazonOrderId,
    }) as { unwrap: () => Promise<LinkResult> };

    void promise.unwrap()
      .then((res: LinkResult) => {
        if (res.success) {
          setProgress(null);
          onLinked();
          onClose();
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('amazon.linking.title')}
      footer={
        <S.FooterRow>
          <Button variant="secondary" onClick={onClose} disabled={isLinking as boolean}>
            <Text>{t('translation:common.cancel')}</Text>
          </Button>
          <Button
            variant="primary"
            onClick={handleLink}
            isLoading={isLinking as boolean}
            disabled={!selectedAccountId || !amazonOrderId}
          >
            <Text>{isLinking ? t('amazon.linking.linkingButton') : t('amazon.linking.linkButton')}</Text>
          </Button>
        </S.FooterRow>
      }
    >
      <S.BodyStack>
        {!hasAccounts ? (
          <>
            <Text variant="h4" weight="semibold">{t('amazon.linking.noAccountsTitle')}</Text>
            <Text variant="body" color="text.secondary">{t('amazon.linking.noAccountsMessage')}</Text>
            <Button variant="primary" onClick={() => window.location.href = `/${window.location.pathname.split('/')[1]}/settings/amazon-accounts`}>
              <Text>{t('amazon.linking.addAccountLink')}</Text>
            </Button>
          </>
        ) : (
          <>
            <div>
              <S.AccountLabel variant="h5" weight="medium">
                {t('amazon.linking.selectAccount')}
              </S.AccountLabel>
              <S.NativeSelect
                value={selectedAccountId}
                onChange={handleSelectChange}
              >
                <option value="">{t('amazon.linking.selectAccountPlaceholder')}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label || account.email} ({account.status})
                  </option>
                ))}
              </S.NativeSelect>
            </div>

            <ModernTextInput
              label={t('amazon.linking.orderId')}
              placeholder={t('amazon.linking.orderIdPlaceholder')}
              value={amazonOrderId}
              onChange={handleInputChange}
            />
            <Text variant="caption" color="text.tertiary">
              {t('amazon.linking.orderIdHelp')}
            </Text>

            {progress && (
              <Text variant="body-sm" color="text.secondary">
                {progress}
              </Text>
            )}

            {error && (
              <Text variant="body-sm" color="semantic.error">
                {error}
              </Text>
            )}
          </>
        )}
      </S.BodyStack>
    </Modal>
  );
};
