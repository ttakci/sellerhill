import { ProfitBasis } from '@repo/shared';
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  IconName,
  IdBadge,
  InfoMessage,
  PageHeader,
  SettingsCard,
  StatusBadge,
  Text,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { fulfillmentStateNoticeKey, fulfillmentStateToBadgeVariant } from '../shared/fulfillment-state';
import { orderStatusToBadgeStatus } from '../shared/order-status';
import { trackingProblemToI18nKey } from '../shared/tracking-problem';

import * as S from './OrderDetailsPage.style';
import type { OrderDetailsPageProps } from './OrderDetailsPage.types';

/** Icon + label on the left, value right-aligned — matches the listing detail page's Meta row. */
const Meta = ({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: React.ReactNode;
}): React.ReactElement => (
  <S.MetaRow>
    <S.MetaLabel>
      <Icon name={icon} size={16} color="brand.primary" />
      <Text variant="body-sm" color="text.secondary">
        {label}
      </Text>
    </S.MetaLabel>
    <S.MetaValue>{children}</S.MetaValue>
  </S.MetaRow>
);

/** One headline number in the hero money strip — mirrors the listing detail
 *  page's Kpi. Only Net Kâr passes a `color`. */
const Kpi = ({
  label,
  value,
  color = 'text.primary',
}: {
  label: string;
  value: string;
  color?: string;
}): React.ReactElement => (
  <S.KpiItem>
    <S.KpiLabel variant="caption" color="text.tertiary">
      {label}
    </S.KpiLabel>
    <Text variant="metric-sm" weight="semibold" numeric color={color}>
      {value}
    </Text>
  </S.KpiItem>
);

/** Same row, but the value stacks below the label — for multi-line content
 *  (a shipping address, an email + phone pair) that reads better left-aligned. */
const MetaBlock = ({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: React.ReactNode;
}): React.ReactElement => (
  <S.MetaBlockRow>
    <S.MetaLabel>
      <Icon name={icon} size={16} color="brand.primary" />
      <Text variant="body-sm" color="text.secondary">
        {label}
      </Text>
    </S.MetaLabel>
    <S.MetaBlockValue>{children}</S.MetaBlockValue>
  </S.MetaBlockRow>
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
  canConvertTracking,
  isConvertingTracking,
  onConvertTracking,
  canCopyAddress,
}) => {
  const { t } = useTranslation(['orders', 'translation']);

  /* Loading and not-found both route through the shared EmptyState molecule.
     They used to be a bespoke block — loading was one line of grey text, so the
     two states looked like different pages. */
  if (isLoading) {
    return (
      <S.Container>
        <S.StateCard variant="elevated" padding="lg">
          <EmptyState
            icon="shopping-bag"
            title={t('translation:common.loading')}
            description={t('orders.detail.loadingSubtitle')}
          />
        </S.StateCard>
      </S.Container>
    );
  }

  if (!order) {
    return (
      <S.Container>
        <S.StateCard variant="elevated" padding="lg">
          <EmptyState
            icon="shopping-bag"
            title={t('orders.detail.notFoundTitle')}
            description={t('orders.detail.notFoundSubtitle')}
            action={t('translation:common.back')}
            onAction={onBack}
          />
        </S.StateCard>
      </S.Container>
    );
  }

  const profitPositive = order.netProfit >= 0;
  const productTitle = order.product?.title || t('orders.detail.unknownProduct');
  const isEstimated = order.profitBasis === ProfitBasis.ESTIMATED;
  const autoFulfillReasonLabel = order.autoFulfillBlockedReason
    ? t('orders.autoFulfill.reasonLabel', {
        reason: t(`orders.autoFulfill.reason.${order.autoFulfillBlockedReason}`),
      })
    : undefined;
  const noticeKey = fulfillmentStateNoticeKey(order.fulfillmentState);
  const fulfillmentNotice = noticeKey ? t(noticeKey) : undefined;

  /*
   * No header action cluster. "Link Amazon" and "Copy address" used to render
   * BOTH here and inside their own cards — on desktop that meant two identical
   * primary CTAs competing on one screen. Each action now lives once, in the
   * card that owns it, plus the mobile action bar.
   */
  return (
    <S.Container>
      <PageHeader
        title={t('orders.detail.title')}
        subtitle={`${order.ebayOrderId} · ${formatDate(order.createdAt)}`}
        onBack={onBack}
        backAriaLabel={t('translation:common.back')}
      />

      <S.Hero variant="elevated" padding="lg">
        <S.ProductImage>
          {order.product?.imageUrl ? (
            <img src={order.product.imageUrl} alt={productTitle} />
          ) : (
            <Icon name="image" size={48} />
          )}
        </S.ProductImage>

        <S.HeroInfo>
          <S.StatusBadgeSlot>
            <StatusBadge status={orderStatusToBadgeStatus(order.status)} size="lg">
              {statusLabel}
            </StatusBadge>
            {order.fulfillmentState && (
              <Badge variant={fulfillmentStateToBadgeVariant(order.fulfillmentState)} size="md" isPill>
                {t(`orders.fulfillmentState.${order.fulfillmentState}`)}
              </Badge>
            )}
          </S.StatusBadgeSlot>

          {/*
            State-specific guidance instead of a bare reason code. "blocked ·
            address" told the seller nothing about what to DO; each state now
            explains the consequence and the next step.
          */}
          <S.HeroLede>
            {fulfillmentNotice && (
              <Text variant="caption" color="text.secondary">
                {fulfillmentNotice}
              </Text>
            )}
            {autoFulfillReasonLabel && (
              <Text variant="caption" color="text.secondary">
                {autoFulfillReasonLabel}
              </Text>
            )}
            <S.ProductTitle variant="h3" weight="semibold">
              {productTitle}
            </S.ProductTitle>
          </S.HeroLede>

          {/* Record facts as labelled icon rows — the listing detail hero's
              IdList pattern, so the two detail pages read as one design. */}
          <S.IdList>
            <S.IdItem>
              <S.IdItemLabel>
                <Icon name="receipt" size={16} color="brand.primary" />
                <Text variant="body-sm" color="text.secondary">
                  {t('orders.table.orderNumber')}
                </Text>
              </S.IdItemLabel>
              <S.IdValue variant="body-sm" numeric>
                {order.ebayOrderId}
              </S.IdValue>
            </S.IdItem>
            <S.IdItem>
              <S.IdItemLabel>
                <Icon name="user" size={16} color="brand.primary" />
                <Text variant="body-sm" color="text.secondary">
                  {t('orders.table.buyer')}
                </Text>
              </S.IdItemLabel>
              <S.IdValue variant="body-sm">{order.buyerName || '—'}</S.IdValue>
            </S.IdItem>
            <S.IdItem>
              <S.IdItemLabel>
                <Icon name="calendar" size={16} color="brand.primary" />
                <Text variant="body-sm" color="text.secondary">
                  {t('orders.table.date')}
                </Text>
              </S.IdItemLabel>
              <Text variant="body-sm" numeric>
                {formatDate(order.createdAt)}
              </Text>
            </S.IdItem>
            <S.IdItem>
              <S.IdItemLabel>
                <Icon name="box" size={16} color="brand.primary" />
                <Text variant="body-sm" color="text.secondary">
                  {t('orders.detail.quantity')}
                </Text>
              </S.IdItemLabel>
              <Text variant="body-sm" weight="semibold" numeric>
                {order.product?.quantity || 1} {t('orders.detail.unit')}
              </Text>
            </S.IdItem>
            {order.product?.sku ? (
              <S.IdItem>
                <S.IdItemLabel>
                  <Icon name="scan-barcode" size={16} color="brand.primary" />
                  <Text variant="body-sm" color="text.secondary">
                    {t('orders.detail.sku')}
                  </Text>
                </S.IdItemLabel>
                <S.IdValue variant="body-sm">{order.product.sku}</S.IdValue>
              </S.IdItem>
            ) : null}
            {order.product?.asin ? (
              <S.IdItem>
                <S.IdItemLabel>
                  <Icon name="barcode" size={16} color="brand.primary" />
                  <Text variant="body-sm" color="text.secondary">
                    {t('orders.detail.asin')}
                  </Text>
                </S.IdItemLabel>
                <IdBadge id={order.product.asin} storeType="amazon" size="sm" plain />
              </S.IdItem>
            ) : null}
            {order.product?.ebayItemId ? (
              <S.IdItem>
                <S.IdItemLabel>
                  <Icon name="tag" size={16} color="brand.primary" />
                  <Text variant="body-sm" color="text.secondary">
                    {t('orders.detail.ebayItemId')}
                  </Text>
                </S.IdItemLabel>
                <IdBadge id={order.product.ebayItemId} storeType="ebay" size="sm" plain />
              </S.IdItem>
            ) : null}
          </S.IdList>

          {/* The whole money story in one neutral strip — the listing detail
              hero's KpiStrip. This absorbed the old standalone green "Net Kâr"
              box AND the separate "Net Kâr Analizi" formula card: eBay earnings
              and total Amazon cost (the formula's two terms) are KPIs here now. */}
          <S.KpiStrip>
            <S.KpiItem>
              <S.KpiLabelRow>
                <S.KpiLabel variant="caption" color="text.tertiary">
                  {t('orders.detail.netProfitResult')}
                </S.KpiLabel>
                {isEstimated && (
                  <Badge variant="warning" size="xs">
                    {t('orders.estimateBadge')}
                  </Badge>
                )}
              </S.KpiLabelRow>
              <Text
                variant="metric-sm"
                weight="semibold"
                numeric
                color={profitPositive ? 'semantic.success' : 'semantic.error'}
              >
                {formatCurrency(order.netProfit)}
              </Text>
            </S.KpiItem>
            <Kpi label={t('orders.detail.roi')} value={roiLabel} />
            <Kpi label={t('orders.detail.orderEarnings')} value={formatCurrency(order.ebayEarnings)} />
            <Kpi label={t('orders.detail.totalAmazonCost')} value={formatCurrency(totalAmazonCost)} />
            <Kpi label={t('orders.table.salePrice')} value={formatCurrency(order.salePrice)} />
          </S.KpiStrip>

          {isEstimated && (
            <S.EstimateNote variant="caption" color="text.tertiary">
              {t('orders.estimateNote')}
            </S.EstimateNote>
          )}
        </S.HeroInfo>
      </S.Hero>

      <S.SectionGrid>
        {/* Customer */}
        <SettingsCard variant="section" header={{ title: t('orders.detail.customerInfo') }}>
          <S.SectionContent>
            <S.MetaList>
              <MetaBlock icon="map-pin" label={t('orders.detail.shipTo')}>
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
              </MetaBlock>
              <MetaBlock icon="mail" label={t('orders.detail.contact')}>
                <Text variant="body-sm">{order.buyerEmail || '—'}</Text>
                {order.buyerPhone ? (
                  <Text variant="body-sm" color="text.secondary">
                    {order.buyerPhone}
                  </Text>
                ) : null}
              </MetaBlock>
              <Meta icon="box" label={t('orders.detail.quantity')}>
                <Text variant="body" weight="semibold" numeric>
                  {order.product?.quantity || 1} {t('orders.detail.unit')}
                </Text>
              </Meta>
              <Meta icon="barcode" label={t('orders.detail.sku')}>
                <Text variant="body" weight="semibold">
                  {order.product?.sku || t('orders.detail.na')}
                </Text>
              </Meta>
            </S.MetaList>
            {canCopyAddress && (
              <Button variant="secondary" size="small" onClick={onCopyAddress} fullWidth>
                <Icon name="copy" size={16} />
                <Text variant="body-sm">{t('orders.detail.copyAddress')}</Text>
              </Button>
            )}
          </S.SectionContent>
        </SettingsCard>

        {/* eBay summary */}
        <SettingsCard variant="section" header={{ title: t('orders.detail.ebaySummary') }}>
          <S.SectionContent>
            <Text variant="body-sm" weight="semibold">
              {t('orders.detail.whatBuyerPaid')}
            </Text>
            <S.MetaList>
              <Meta icon="circle-dollar-sign" label={t('orders.detail.subtotal')}>
                <Text variant="body" weight="semibold" numeric>
                  {formatCurrency(order.salePrice)}
                </Text>
              </Meta>
              <Meta icon="truck" label={t('orders.detail.shipping')}>
                <Text variant="body" weight="semibold" numeric>
                  {formatCurrency(order.saleShipping)}
                </Text>
              </Meta>
              <Meta icon="percent" label={t('orders.detail.salesTax')}>
                <Text variant="body" weight="semibold" numeric>
                  {formatCurrency(order.saleTax)}
                </Text>
              </Meta>
              <Meta icon="receipt" label={t('orders.detail.orderTotal')}>
                <Text variant="body" weight="semibold" numeric>
                  {formatCurrency(order.saleTotal)}
                </Text>
              </Meta>
            </S.MetaList>
            <Text variant="body-sm" weight="semibold">
              {t('orders.detail.whatYouEarned')}
            </Text>
            <S.MetaList>
              <Meta icon="coins" label={t('orders.detail.transactionFees')}>
                <Text variant="body" weight="semibold" numeric>
                  −{formatCurrency(order.transactionFee)}
                </Text>
              </Meta>
              <Meta icon="megaphone" label={t('orders.detail.adFee')}>
                <Text variant="body" weight="semibold" numeric>
                  −{formatCurrency(order.adFee)}
                </Text>
              </Meta>
              <Meta icon="wallet-cards" label={t('orders.detail.orderEarnings')}>
                <Text variant="body" weight="semibold" numeric>
                  {formatCurrency(order.ebayEarnings)}
                </Text>
              </Meta>
            </S.MetaList>
          </S.SectionContent>
        </SettingsCard>

        {/* Amazon costs */}
        <SettingsCard variant="section" header={{ title: t('orders.detail.amazonCosts') }}>
          <S.SectionContent>
            <S.MetaList>
              <Meta icon="shopping-bag" label={t('orders.detail.purchasePrice')}>
                <Text variant="body" weight="semibold" numeric>
                  {formatCurrency(order.purchasePrice)}
                </Text>
              </Meta>
              <Meta icon="percent" label={t('orders.detail.amazonTax')}>
                <Text variant="body" weight="semibold" numeric>
                  {formatCurrency(order.amazonTax || 0)}
                </Text>
              </Meta>
              <Meta icon="truck" label={t('orders.detail.amazonShipping')}>
                <Text variant="body" weight="semibold" numeric>
                  {formatCurrency(order.amazonShipping || 0)}
                </Text>
              </Meta>
              <Meta icon="circle-dollar-sign" label={t('orders.detail.totalAmazonCost')}>
                <Text variant="body" weight="semibold" numeric>
                  {formatCurrency(totalAmazonCost)}
                </Text>
              </Meta>
              {order.amazonTrackingNumber && (
                <Meta icon="truck" label={t('orders.detail.amazonTracking')}>
                  <Text variant="body" weight="semibold">
                    {order.amazonTrackingNumber}
                  </Text>
                </Meta>
              )}
              {order.convertedTrackingNumber && (
                <Meta icon="repeat" label={t('orders.detail.convertedTracking')}>
                  <Text variant="body" weight="semibold">
                    {order.convertedTrackingNumber}
                  </Text>
                </Meta>
              )}
            </S.MetaList>
            {order.trackingProblemCode && (
              <InfoMessage>{t(trackingProblemToI18nKey(order.trackingProblemCode))}</InfoMessage>
            )}
            <Button variant="primary" size="small" onClick={onOpenLinkAmazon} fullWidth isLoading={isUpdating}>
              <Text variant="body-sm">{t('orders.detail.linkAmazon')}</Text>
            </Button>
            {canConvertTracking && onConvertTracking ? (
              <Button
                variant="secondary"
                size="small"
                fullWidth
                onClick={onConvertTracking}
                isLoading={isConvertingTracking}
              >
                <Icon name="repeat" size={16} />
                <Text variant="body-sm">{t('orders.actions.convertTracking')}</Text>
              </Button>
            ) : null}
            {order.amazonOrderUrl && onOpenAmazonOrderUrl ? (
              <Button variant="text" size="small" onClick={onOpenAmazonOrderUrl}>
                <Icon name="external-link" size={16} />
                <Text variant="body-sm">{t('orders.detail.amazonOrder')}</Text>
              </Button>
            ) : null}
          </S.SectionContent>
        </SettingsCard>
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
