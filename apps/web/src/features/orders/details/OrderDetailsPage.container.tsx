import { formatCurrency, formatDate, getLocaleConfig } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { useGetOrderByIdQuery, useUpdateOrderAmazonDetailsMutation } from '../api/orders.api';

import { OrderDetailsPageComponent } from './OrderDetailsPage.component';

import { LinkAmazonModal } from '@/features/amazon/components/LinkAmazonModal';
import { useLocale } from '@/utils/useLocale';

export const OrderDetailsPageContainer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { i18n } = useTranslation();
  const { localeNavigate } = useLocale();
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  const { data: order, isLoading, refetch } = useGetOrderByIdQuery(id || '', {
    skip: !id,
  });

  const [updateOrder, { isLoading: isUpdating }] = useUpdateOrderAmazonDetailsMutation();

  const localeCfg = useMemo(() => getLocaleConfig(i18n.language), [i18n.language]);

  const fmtCurrency = useCallback(
    (value: number) => formatCurrency(value, localeCfg.locale, localeCfg.currency),
    [localeCfg],
  );

  const fmtDate = useCallback(
    (dateString: string) => formatDate(dateString, localeCfg.locale, { month: 'long', year: 'numeric' }),
    [localeCfg],
  );

  const handleUpdateAmazonDetails = (data: {
    amazonOrderUrl?: string;
    amazonTrackingUrl?: string;
    purchasePrice?: number;
    amazonTax?: number;
    amazonShipping?: number;
  }): void => {
    if (!id) {
      return;
    }
    void updateOrder({ id, data });
  };

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
        onUpdateAmazonDetails={handleUpdateAmazonDetails}
        onOpenLinkAmazonModal={() => setIsLinkModalOpen(true)}
        onBack={handleBack}
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
