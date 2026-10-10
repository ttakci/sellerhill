import { EbayAccountStatus } from '@repo/shared';
import { Button, Icon, Text, Tooltip } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ebayStatusBadgeVariant } from '../recordStatusBadge';
import { SettingsRecordCard } from '../SettingsRecordCard';

import type { EbayAccountCardProps } from './EbayAccountCard.types';

import { getEbayAccountStatusLabel } from '@/features/ebay/utils/ebayAccountStatusLabel';

/**
 * eBay store card — OAuth-connected, so there is nothing to EDIT here (unlike
 * Amazon's credential-based accounts). The actions it carries are reconnect
 * and disconnect, each only where a handler is supplied.
 */
export const EbayAccountCard: React.FC<EbayAccountCardProps> = ({
  store,
  onDisconnect,
  isDisconnecting,
  onReconnect,
  isReconnecting,
}) => {
  const { t } = useTranslation(['translation']);
  const canReconnect =
    Boolean(onReconnect) && (store.status === EbayAccountStatus.ACTIVE || store.status === EbayAccountStatus.REVOKED);

  const actions =
    onDisconnect || canReconnect ? (
      <>
        {canReconnect && onReconnect && (
          <Tooltip content={t('translation:settingsHub.sections.ebay.reconnect.hint')} position="top" variant="dark">
            <Button variant="primary" size="small" onClick={() => onReconnect(store.id)} isLoading={isReconnecting}>
              <Icon name="refresh" size={16} />
              <Text variant="body-sm" weight="semibold">
                {t('translation:settingsHub.sections.ebay.reconnect.action')}
              </Text>
            </Button>
          </Tooltip>
        )}
        {onDisconnect && (
          <Button variant="danger" size="small" onClick={() => onDisconnect(store.id)} isLoading={isDisconnecting}>
            <Icon name="plug" size={16} />
            <Text variant="body-sm" weight="semibold">
              {t('translation:settingsHub.sections.ebay.disconnect.action')}
            </Text>
          </Button>
        )}
      </>
    ) : undefined;

  return (
    <SettingsRecordCard
      badges={[{ label: getEbayAccountStatusLabel(store.status, t), variant: ebayStatusBadgeVariant(store.status) }]}
      title={store.displayName}
      facts={[
        { label: t('translation:settingsHub.sections.ebay.sellerId'), value: store.sellerId },
        {
          label: t('translation:settingsHub.sections.ebay.marketplace'),
          value: `${store.marketplaceLabel} · ${store.currency}`,
        },
        { label: t('translation:settingsHub.sections.ebay.connectedSince'), value: store.connectedSince },
      ]}
      actions={actions}
    />
  );
};

EbayAccountCard.displayName = 'EbayAccountCard';
