import { formatCurrency, formatDate, getLocaleConfig, useLoading, useUI } from '@repo/ui';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { useGetOrderByIdQuery, useUpdateOrderAmazonDetailsMutation } from '../api/orders.api';

import { OrderDetailsPageComponent } from './OrderDetailsPage.component';

import { LinkAmazonModal } from '@/features/amazon/components/LinkAmazonModal';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { resolveStoreCurrency } from '@/utils/resolveStoreCurrency';
import { useLocale } from '@/utils/useLocale';

export const OrderDetailsPageContainer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation(['orders', 'translation']);
  const { localeNavigate } = useLocale();
  const { showMessage, closeMessage } = useUI();
  const [isLinkModalOpen, setIsLinkModalOpen] = React.useState(false);

  const { data: order, isLoading, refetch } = useGetOrderByIdQuery(id || '', {
    skip: !id,
  });

  const { data: ebayAccountsData } = useGetEbayAccountsQuery();

  const [, { isLoading: isUpdating }] = useUpdateOrderAmazonDetailsMutation();

  useLoading(isUpdating);

  const localeCfg = useMemo(() => getLocaleConfig(i18n.language), [i18n.language]);

  /* Money renders in the connected eBay store's marketplace currency this
     order belongs to, never the UI language. */
  const currency = useMemo(
    () => resolveStoreCurrency(ebayAccountsData?.items ?? [], order?.ebayAccountId),
    [ebayAccountsData, order?.ebayAccountId]
  );
  const fmtCurrency = useCallback(
    (value: number) => formatCurrency(value, localeCfg.locale, currency),
    [localeCfg, currency]
  );

  const fmtDate = useCallback(
    (dateString: string) =>
      formatDate(dateString, localeCfg.locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [localeCfg]
  );

  const statusLabel = useMemo(() => {
    if (!order) {
      return '';
    }
    const key = `orders.status.${order.status}`;
    const translated = t(key);
    return translated === key ? order.status : translated;
  }, [order, t]);

  const totalAmazonCost = useMemo(() => {
    if (!order) {
      return 0;
    }
    return order.purchasePrice + (order.amazonTax || 0) + (order.amazonShipping || 0);
  }, [order]);

  const roiLabel = useMemo(() => {
    if (!order || totalAmazonCost === 0) {
      return '0.0%';
    }
    return `${((order.netProfit / totalAmazonCost) * 100).toFixed(1)}%`;
  }, [order, totalAmazonCost]);

  const canCopyAddress = Boolean(order?.shippingAddress);

  const handleCopyAddress = useCallback(() => {
    if (!order?.shippingAddress) {
      return;
    }
    const addr = [
      order.buyerName,
      order.shippingAddress.street,
      `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}`,
      order.shippingAddress.country,
    ]
      .filter(Boolean)
      .join('\n');
    void navigator.clipboard.writeText(addr).then(() => {
      showMessage(
        {
          type: 'success',
          headerKey: 'translation:message.success.header',
          descriptionKey: 'orders:orders.detail.addressCopied',
          primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
        },
        t
      );
    });
  }, [order, showMessage, closeMessage, t]);

  const handleBack = () => {
    localeNavigate('/orders');
  };

  const handleLinked = () => {
    void refetch();
  };

  return (
    <>
      <OrderDetailsPageComponent
        order={order}
        isLoading={isLoading}
        isUpdating={isUpdating}
        formatCurrency={fmtCurrency}
        formatDate={fmtDate}
        statusLabel={statusLabel}
        roiLabel={roiLabel}
        totalAmazonCost={totalAmazonCost}
        onBack={handleBack}
        onCopyAddress={handleCopyAddress}
        onOpenLinkAmazon={() => setIsLinkModalOpen(true)}
        onOpenAmazonOrderUrl={
          order?.amazonOrderUrl
            ? () => window.open(order.amazonOrderUrl, '_blank', 'noopener,noreferrer')
            : undefined
        }
        canCopyAddress={canCopyAddress}
      />
      {id && (
        <LinkAmazonModal
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          orderId={id}
          onLinked={handleLinked}
        />
      )}
    </>
  );
};
