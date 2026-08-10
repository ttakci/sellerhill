import { PageHeader, QuickActionCard, SettingsActionRow, SettingsCard } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { OrderCarousel } from '../carousel';

import * as S from './OrdersOverviewPage.style';
import type { OrdersOverviewPageProps } from './OrdersOverviewPage.types';

/**
 * Mirrors ListingsOverview layout:
 * PageHeader → 2-col [carousel + View all] | [QuickAction + SettingsCard row]
 */
export const OrdersOverviewPageComponent: React.FC<OrdersOverviewPageProps> = ({
  orders,
  totalCount,
  formatCurrency,
  formatDate,
  onViewAll,
  onOrderClick,
  onRefresh,
}) => {
  const { t } = useTranslation(['orders', 'translation']);

  return (
    <S.Container>
      <PageHeader
        title={t('orders.overview.title')}
        subtitle={t('orders.overview.subtitle', { count: totalCount })}
      />

      <S.TwoColumnLayout>
        <S.SliderColumn>
          <S.SliderContent>
            <OrderCarousel
              orders={orders}
              onViewAll={onViewAll}
              viewAllLabel={t('orders.overview.viewAll')}
              showViewAll={totalCount > 3}
              onOrderClick={onOrderClick}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
            />
          </S.SliderContent>
        </S.SliderColumn>

        <S.AddColumn>
          <S.AddCardStack>
            <QuickActionCard
              variant="brand"
              title={t('orders.overview.syncTitle')}
              subtitle={t('orders.overview.syncSubtitle')}
              onClick={onRefresh}
            />
            <SettingsCard
              variant="section"
              className="other-actions-card"
              header={{
                icon: 'receipt',
                title: t('orders.overview.actionsTitle'),
              }}
            >
              <SettingsActionRow
                label={t('orders.overview.viewAllTitle')}
                subtitle={t('orders.overview.viewAllSubtitle', { count: totalCount })}
                onClick={onViewAll}
              />
            </SettingsCard>
          </S.AddCardStack>
        </S.AddColumn>
      </S.TwoColumnLayout>
    </S.Container>
  );
};
