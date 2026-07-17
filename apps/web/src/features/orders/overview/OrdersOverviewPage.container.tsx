import { formatCurrency, formatDate, getLocaleConfig, useLoading } from '@repo/ui';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetOrdersQuery, useTriggerOrderSyncMutation } from '../api/orders.api';

import { OrdersOverviewPageComponent } from './OrdersOverviewPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useLocale } from '@/utils/useLocale';

export const OrdersOverviewPageContainer: React.FC = () => {
  const { i18n } = useTranslation(['orders', 'translation']);
  const { localeNavigate } = useLocale();

  // Same pattern as listings overview: small recent page for carousel
  const { data } = useGetOrdersQuery(
    {
      page: 1,
      limit: 12,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    },
    { refetchOnMountOrArgChange: true }
  );
  const [triggerSync, { isLoading: isSyncing }] = useTriggerOrderSyncMutation();

  useLoading(isSyncing);

  const orders = data?.orders ?? [];
  const totalCount = data?.total ?? 0;

  const localeCfg = useMemo(() => getLocaleConfig(i18n.language), [i18n.language]);

  const fmtCurrency = useCallback(
    (value: number) => formatCurrency(value, localeCfg.locale, localeCfg.currency),
    [localeCfg]
  );

  const fmtDate = useCallback(
    (value: string) =>
      formatDate(value, localeCfg.locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [localeCfg]
  );

  return (
    <EbayAccountGuard>
      <OrdersOverviewPageComponent
        orders={orders}
        totalCount={totalCount}
        formatCurrency={fmtCurrency}
        formatDate={fmtDate}
        onViewAll={() => localeNavigate('/orders/all')}
        onOrderClick={(id) => localeNavigate(`/orders/${id}`)}
        onRefresh={() => {
          void triggerSync();
        }}
      />
    </EbayAccountGuard>
  );
};
