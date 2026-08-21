import { formatCurrency, formatDate, getLocaleConfig, useLoading, useUI } from '@repo/ui';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { useGetOrderByIdQuery, useUpdateOrderAmazonDetailsMutation } from '../api/orders.api';

import { OrderDetailsPageComponent } from './OrderDetailsPage.component';

import { useConvertOrderTrackingMutation } from '@/features/amazon/api/amazon.api';
import { LinkAmazonModal } from '@/features/amazon/components/LinkAmazonModal';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { getErrorI18nKey } from '@/utils/errorHandler';
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
  const [convertTracking, { isLoading: isConvertingTracking }] = useConvertOrderTrackingMutation();

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

  /*
   * Offer the action only when it can actually do something:
   *   - the order is linked to one of our listings, without which a converted
   *     number could never be pushed to eBay (the fulfillment needs the
   *     listing's eBay item id as its line item);
   *   - Amazon has given us a number to convert;
   *   - and it has not already been converted, since a conversion is paid for
   *     and buying a second one for the same shipment is pure loss.
   * The server refuses all three independently — this only keeps a button that
   * would decline out of the seller's way.
   */
  const canConvertTracking = Boolean(
    order?.isTracked && order.amazonTrackingNumber && !order.convertedTrackingNumber
  );

  const handleConvertTracking = useCallback(() => {
    if (!id) {
      return;
    }
    convertTracking({ orderId: id })
      .unwrap()
      .then((result) => {
        // `converted: false` is a normal outcome, not a failure — the quota may
        // be spent, or the provider unavailable. The backend names the reason
        // as an i18n key so the seller reads WHY instead of "an error occurred".
        showMessage(
          {
            type: result.converted ? 'success' : 'info',
            headerKey: result.converted
              ? 'translation:message.success.header'
              : 'translation:message.info.header',
            descriptionKey: result.converted
              ? 'orders:orders.errors.conversionDone'
              : `orders:${result.reasonKey ?? 'orders.errors.conversionUnavailable'}`,
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t
        );
        void refetch();
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(error),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t
        );
      });
  }, [id, convertTracking, showMessage, closeMessage, t, refetch]);

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
        canConvertTracking={canConvertTracking}
        isConvertingTracking={isConvertingTracking}
        onConvertTracking={handleConvertTracking}
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
