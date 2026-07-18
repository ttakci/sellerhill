import {
  Badge,
  Button,
  Icon,
  IdBadge,
  PageHeader,
  StatusBadge,
  Text,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { orderStatusToBadgeStatus } from '../shared/order-status';

import * as S from './OrderDetailsPage.style';
import type { OrderDetailsPageProps } from './OrderDetailsPage.types';

const Meta = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement => (
  <S.MetaRow>
    <Text variant="caption" color="text.secondary" weight="medium">
      {label}
    </Text>
    <div>{children}</div>
  </S.MetaRow>
);

export const OrderDetailsPageComponent: React.FC<OrderDetailsPageProps> = ({
  order,
  isLoading,
  isUpdating,
  formatCurrency,
  formatDate,
  statusLabel,
  roiLabel,
  totalAmazonCost,
  onBack,
  onCopyAddress,
  onOpenLinkAmazon,
  onOpenAmazonOrderUrl,
  canCopyAddress,
}) => {
  const { t } = useTranslation(['orders', 'translation']);

  if (isLoading) {
    return (
      <S.Container>
        <S.EmptyState>
          <Text variant="body" color="text.secondary">
            {t('translation:common.loading')}
          </Text>
        </S.EmptyState>
      </S.Container>
    );
  }

  if (!order) {
    return (
      <S.Container>
        <S.EmptyState>
          <Icon name="inbox" size={40} />
          <Text variant="h4" weight="semibold">
            {t('orders.detail.notFoundTitle')}
          </Text>
          <Text variant="body-sm" color="text.secondary">
            {t('orders.detail.notFoundSubtitle')}
          </Text>
          <Button variant="secondary" onClick={onBack}>
            <Text variant="body">{t('translation:common.back')}</Text>
          </Button>
        </S.EmptyState>
      </S.Container>
    );
  }

  const profitPositive = order.netProfit >= 0;
  const productTitle = order.product?.title || t('orders.detail.unknownProduct');
  const isEstimated = order.profitBasis === 'estimated';

  const desktopActions = (
    <S.HeaderActions>
      <Button variant="primary" size="small" onClick={onOpenLinkAmazon} isLoading={isUpdating}>
        <Icon name="link" size={16} />
        <Text variant="body-sm">{t('orders.detail.linkAmazon')}</Text>
      </Button>
      {canCopyAddress && (
        <Button variant="secondary" size="small" onClick={onCopyAddress}>
          <Icon name="copy" size={16} />
          <Text variant="body-sm">{t('orders.detail.copyAddress')}</Text>
        </Button>
      )}
    </S.HeaderActions>
  );

  return (
    <S.Container>
      <PageHeader
        title={t('orders.detail.title')}
        subtitle={`${order.ebayOrderId} · ${formatDate(order.createdAt)}`}
        onBack={onBack}
        backAriaLabel={t('translation:common.back')}
        actions={desktopActions}
      />

      <S.Hero>
        <S.ProductImage>
          {order.product?.imageUrl ? (
            <img src={order.product.imageUrl} alt={productTitle} />
          ) : (
            <Icon name="image" size={48} />
          )}
        </S.ProductImage>

        <S.HeroInfo>
          <S.BadgeRow>
            <StatusBadge status={orderStatusToBadgeStatus(order.status)}>
              {statusLabel}
            </StatusBadge>
            <Text variant="caption" color="text.secondary">
              {formatDate(order.createdAt)}
            </Text>
          </S.BadgeRow>

          <Text variant="h3" weight="semibold">
            {productTitle}
          </Text>

          <S.IdRow>
            {order.product?.asin ? (
              <IdBadge id={order.product.asin} storeType="amazon" size="sm" />
            ) : null}
            {order.product?.ebayItemId ? (
              <IdBadge id={order.product.ebayItemId} storeType="ebay" size="sm" />
            ) : null}
            <Text variant="body-sm" weight="semibold" color="brand.primary">
              {order.ebayOrderId}
            </Text>
          </S.IdRow>

          <S.ProfitHighlight $positive={profitPositive}>
            <S.ProfitLabelRow>
              <Text variant="caption" color="text.secondary" weight="medium">
                {t('orders.detail.netProfitResult')}
              </Text>
              {isEstimated && (
                <Badge variant="warning" size="xs">
                  {t('orders.estimateBadge')}
                </Badge>
              )}
            </S.ProfitLabelRow>
            <Text
              variant="h3"
              weight="semibold"
              color={profitPositive ? 'semantic.success' : 'semantic.error'}
            >
              {formatCurrency(order.netProfit)}
            </Text>
            <Text variant="body-sm" color="text.secondary">
              {t('orders.detail.roi')}: {roiLabel}
            </Text>
            {isEstimated && (
              <S.EstimateNote variant="caption" color="text.tertiary">
                {t('orders.estimateNote')}
              </S.EstimateNote>
            )}
          </S.ProfitHighlight>
        </S.HeroInfo>
      </S.Hero>

      <S.KpiStrip>
        <S.KpiCard>
          <Text variant="caption" color="text.secondary">
            {t('orders.detail.orderTotal')}
          </Text>
          <Text variant="body" weight="semibold">
            {formatCurrency(order.saleTotal)}
          </Text>
        </S.KpiCard>
        <S.KpiCard>
          <Text variant="caption" color="text.secondary">
            {t('orders.detail.orderEarnings')}
          </Text>
          <Text variant="body" weight="semibold">
            {formatCurrency(order.ebayEarnings)}
          </Text>
        </S.KpiCard>
        <S.KpiCard>
          <Text variant="caption" color="text.secondary">
            {t('orders.detail.totalAmazonCost')}
          </Text>
          <Text variant="body" weight="semibold">
            {formatCurrency(totalAmazonCost)}
          </Text>
        </S.KpiCard>
        <S.KpiCard>
          <Text variant="caption" color="text.secondary">
            {t('orders.detail.roi')}
          </Text>
          <Text
            variant="body"
            weight="semibold"
            color={profitPositive ? 'semantic.success' : 'semantic.error'}
          >
            {roiLabel}
          </Text>
        </S.KpiCard>
      </S.KpiStrip>

      {/* Net profit formula */}
      <S.Card>
        <S.CardHeader>
          <S.CardHeaderLeft>
            <Icon name="insights" size={20} color="brand.primary" />
            <Text variant="h4" weight="semibold">
              {t('orders.detail.netProfitAnalysis')}
            </Text>
          </S.CardHeaderLeft>
        </S.CardHeader>
        <Text variant="body-sm" color="text.secondary">
          {t('orders.detail.analysisDesc')}
        </Text>
        <S.FormulaRow>
          <Text variant="body-sm">
            {t('orders.detail.calcEarnings')} {formatCurrency(order.ebayEarnings)}
          </Text>
          <Text variant="body-sm" color="text.secondary">
            −
          </Text>
          <Text variant="body-sm">
            {t('orders.detail.calcPurchase')} {formatCurrency(order.purchasePrice)}
          </Text>
          <Text variant="body-sm" color="text.secondary">
            −
          </Text>
          <Text variant="body-sm">
            {t('orders.detail.calcTax')} {formatCurrency(order.amazonTax || 0)}
          </Text>
          <Text variant="body-sm" color="text.secondary">
            −
          </Text>
          <Text variant="body-sm">
            {t('orders.detail.calcShipping')} {formatCurrency(order.amazonShipping || 0)}
          </Text>
        </S.FormulaRow>
      </S.Card>

      <S.SectionGrid>
        {/* Customer */}
        <S.Card>
          <S.CardHeader>
            <S.CardHeaderLeft>
              <Icon name="user" size={20} color="brand.primary" />
              <Text variant="h4" weight="semibold">
                {t('orders.detail.customerInfo')}
              </Text>
            </S.CardHeaderLeft>
          </S.CardHeader>
          <S.MetaList>
            <Meta label={t('orders.detail.shipTo')}>
              <Text variant="body" weight="semibold">
                {order.buyerName || '—'}
              </Text>
              {order.shippingAddress ? (
                <S.AddressBlock>
                  <Text variant="body-sm" color="text.secondary">
                    {order.shippingAddress.street}
                  </Text>
                  <Text variant="body-sm" color="text.secondary">
                    {`${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}`}
                  </Text>
                  <Text variant="body-sm" color="text.secondary">
                    {order.shippingAddress.country}
                  </Text>
                </S.AddressBlock>
              ) : null}
            </Meta>
            <Meta label={t('orders.detail.contact')}>
              <Text variant="body-sm">{order.buyerEmail || '—'}</Text>
              {order.buyerPhone ? (
                <Text variant="body-sm" color="text.secondary">
                  {order.buyerPhone}
                </Text>
              ) : null}
            </Meta>
            <Meta label={t('orders.detail.quantity')}>
              <Text variant="body" weight="semibold">
                {order.product?.quantity || 1} {t('orders.detail.unit')}
              </Text>
            </Meta>
            <Meta label={t('orders.detail.sku')}>
              <Text variant="body-sm">{order.product?.sku || t('orders.detail.na')}</Text>
            </Meta>
          </S.MetaList>
          {canCopyAddress && (
            <Button variant="secondary" size="small" onClick={onCopyAddress} fullWidth>
              <Icon name="copy" size={16} />
              <Text variant="body-sm">{t('orders.detail.copyAddress')}</Text>
            </Button>
          )}
        </S.Card>

        {/* eBay summary */}
        <S.Card>
          <S.CardHeader>
            <S.CardHeaderLeft>
              <Icon name="tag" size={20} color="brand.primary" />
              <Text variant="h4" weight="semibold">
                {t('orders.detail.ebaySummary')}
              </Text>
            </S.CardHeaderLeft>
          </S.CardHeader>
          <Text variant="caption" color="text.secondary" weight="semibold">
            {t('orders.detail.whatBuyerPaid')}
          </Text>
          <S.MetaList>
            <Meta label={t('orders.detail.subtotal')}>
              <Text variant="body">{formatCurrency(order.salePrice)}</Text>
            </Meta>
            <Meta label={t('orders.detail.shipping')}>
              <Text variant="body">{formatCurrency(order.saleShipping)}</Text>
            </Meta>
            <Meta label={t('orders.detail.salesTax')}>
              <Text variant="body">{formatCurrency(order.saleTax)}</Text>
            </Meta>
            <Meta label={t('orders.detail.orderTotal')}>
              <Text variant="body" weight="semibold">
                {formatCurrency(order.saleTotal)}
              </Text>
            </Meta>
          </S.MetaList>
          <Text variant="caption" color="text.secondary" weight="semibold">
            {t('orders.detail.whatYouEarned')}
          </Text>
          <S.MetaList>
            <Meta label={t('orders.detail.transactionFees')}>
              <Text variant="body-sm">−{formatCurrency(order.transactionFee)}</Text>
            </Meta>
            <Meta label={t('orders.detail.adFee')}>
              <Text variant="body-sm">−{formatCurrency(order.adFee)}</Text>
            </Meta>
            <Meta label={t('orders.detail.orderEarnings')}>
              <Text variant="body" weight="semibold">
                {formatCurrency(order.ebayEarnings)}
              </Text>
            </Meta>
          </S.MetaList>
        </S.Card>

        {/* Amazon costs */}
        <S.Card>
          <S.CardHeader>
            <S.CardHeaderLeft>
              <Icon name="shopping-bag" size={20} color="brand.primary" />
              <Text variant="h4" weight="semibold">
                {t('orders.detail.amazonCosts')}
              </Text>
            </S.CardHeaderLeft>
          </S.CardHeader>
          <S.MetaList>
            <Meta label={t('orders.detail.purchasePrice')}>
              <Text variant="body">{formatCurrency(order.purchasePrice)}</Text>
            </Meta>
            <Meta label={t('orders.detail.amazonTax')}>
              <Text variant="body">{formatCurrency(order.amazonTax || 0)}</Text>
            </Meta>
            <Meta label={t('orders.detail.amazonShipping')}>
              <Text variant="body">{formatCurrency(order.amazonShipping || 0)}</Text>
            </Meta>
            <Meta label={t('orders.detail.totalAmazonCost')}>
              <Text variant="body" weight="semibold">
                {formatCurrency(totalAmazonCost)}
              </Text>
            </Meta>
          </S.MetaList>
          <Button variant="primary" size="small" onClick={onOpenLinkAmazon} fullWidth isLoading={isUpdating}>
            <Text variant="body-sm">{t('orders.detail.linkAmazon')}</Text>
          </Button>
          {order.amazonOrderUrl && onOpenAmazonOrderUrl ? (
            <Button variant="text" size="small" onClick={onOpenAmazonOrderUrl}>
              <Icon name="external-link" size={16} />
              <Text variant="body-sm">{t('orders.detail.amazonOrder')}</Text>
            </Button>
          ) : null}
        </S.Card>
      </S.SectionGrid>

      <S.MobileActionBar>
        <Button variant="primary" size="medium" onClick={onOpenLinkAmazon} fullWidth isLoading={isUpdating}>
          <Text variant="body" weight="semibold">
            {t('orders.detail.linkAmazon')}
          </Text>
        </Button>
        {canCopyAddress && (
          <Button variant="secondary" size="medium" onClick={onCopyAddress}>
            <Icon name="copy" size={16} />
          </Button>
        )}
      </S.MobileActionBar>
    </S.Container>
  );
};
