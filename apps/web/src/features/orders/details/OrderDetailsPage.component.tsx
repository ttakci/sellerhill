import { ProfitBasis } from '@repo/shared';
import {
  Badge,
  Button,
  CopyableText,
  EmptyState,
  Icon,
  IconName,
  IdBadge,
  InfoMessage,
  PageHeader,
  SettingsCard,
  Text,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { OrderStageBadge } from '../shared/OrderStageBadge';
import { OrderTimeline } from '../shared/OrderTimeline';
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
  rows,
  children,
}: {
  icon: IconName;
  label: string;
  /** How many shared row units the block spans, so the rows under it keep lining up with the neighbouring cards. */
  rows?: number;
  children: React.ReactNode;
}): React.ReactElement => (
  <S.MetaBlockRow $rows={rows}>
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
  timelineRows,
  roiLabel,
  totalAmazonCost,
  amazonTotalBeforeTax,
  buyerPhoneDisplay,
  onBack,
  onCopyAddress,
  onOpenLinkAmazon,
  onOpenAmazonOrderUrl,
  canConvertTracking,
  isConvertingTracking,
  onConvertTracking,
  canStartAutoFulfill,
  isStartingAutoFulfill,
  onStartAutoFulfill,
  canConfirmNotPurchased,
  isConfirmingNotPurchased,
  onConfirmNotPurchased,
  shipByLabel,
  isShipByUrgent,
  multiItemCount,
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

  /*
   * `saleTax`/`saleTotal` are captured once at order-sync ingest from eBay's
   * `pricingSummary`, which has been observed to come back as a stale 0 on at
   * least one real order even though eBay's own Sales tax and Order total
   * were non-zero — while `ebayCollectRemitTax` (migration 098, read from a
   * different field on the same response) had the correct figure. Prefer the
   * newer, independently-sourced field everywhere a tax/total is shown, and
   * recompute the total from parts rather than trusting a `saleTotal` that
   * may have been derived from the same stale tax at ingest time.
   */
  const resolvedSaleTax = order.ebayCollectRemitTax ?? order.saleTax;
  const resolvedSaleTotal = order.salePrice + order.saleShipping + resolvedSaleTax;

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
          {/* ONE badge: the seller-facing stage. The eBay status is a fact
              about the sale, not a status of the work, and sits in the eBay
              card below. */}
          <S.StatusBadgeSlot>
            <OrderStageBadge
              stage={order.stage}
              shippedDetectedAt={order.shippedDetectedAt}
              size="md"
              withTooltip={false}
            />
          </S.StatusBadgeSlot>

          {/* What the stage means and what to do about it live in the
              timeline card below, on the step the order is standing on — the
              hero used to print them as three loose sentences above the title. */}
          <S.HeroLede>
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

      {/* The order's path, step by step: what happened and when, where it is
          standing now, and what is still ahead. */}
      {timelineRows.length > 0 && (
        <SettingsCard variant="section" header={{ title: t('orders.timeline.title') }}>
          <S.TimelineBody>
            {/* eBay's own deadline, while the seller still has to act. */}
            {shipByLabel && (
              <Text
                variant="body-sm"
                weight={isShipByUrgent ? 'semibold' : undefined}
                color={isShipByUrgent ? 'semantic.error' : 'text.secondary'}
              >
                {t('orders.detail.shipByNotice', { date: shipByLabel })}
              </Text>
            )}
            {multiItemCount !== null && (
              <InfoMessage>{t('orders.detail.multiItemNotice', { count: multiItemCount })}</InfoMessage>
            )}
            <OrderTimeline rows={timelineRows} />
          </S.TimelineBody>
        </SettingsCard>
      )}

      <S.SectionGrid>
        {/* Customer */}
        <SettingsCard variant="section" header={{ title: t('orders.detail.customerInfo') }}>
          <S.SectionContent>
            <S.MetaList>
              {/* Spans 4 shared row units: name + up to 6 address lines + phone. */}
              <MetaBlock icon="map-pin" label={t('orders.detail.shipTo')} rows={4}>
                <Text variant="body" weight="semibold">
                  {order.shippingAddress?.fullName || order.buyerName ? (
                    <CopyableText
                      value={order.shippingAddress?.fullName || order.buyerName || ''}
                      label={t('orders.detail.copyName')}
                      copiedLabel={t('orders.detail.copied')}
                    />
                  ) : (
                    '—'
                  )}
                </Text>
                {order.shippingAddress ? (
                  <S.AddressBlock>
                    <Text variant="body-sm" color="text.secondary">
                      <CopyableText
                        value={order.shippingAddress.street}
                        label={t('orders.detail.copyStreet')}
                        copiedLabel={t('orders.detail.copied')}
                      />
                    </Text>
                    {order.shippingAddress.street2 ? (
                      <Text variant="body-sm" color="text.secondary">
                        <CopyableText
                          value={order.shippingAddress.street2}
                          label={t('orders.detail.copyStreet2')}
                          copiedLabel={t('orders.detail.copied')}
                        />
                      </Text>
                    ) : null}
                    <Text variant="body-sm" color="text.secondary">
                      <CopyableText
                        value={order.shippingAddress.city}
                        label={t('orders.detail.copyCity')}
                        copiedLabel={t('orders.detail.copied')}
                      />
                      {', '}
                      <CopyableText
                        value={order.shippingAddress.state}
                        label={t('orders.detail.copyState')}
                        copiedLabel={t('orders.detail.copied')}
                      />{' '}
                      <CopyableText
                        value={order.shippingAddress.zipCode}
                        label={t('orders.detail.copyZip')}
                        copiedLabel={t('orders.detail.copied')}
                      />
                    </Text>
                    <Text variant="body-sm" color="text.secondary">
                      <CopyableText
                        value={order.shippingAddress.country}
                        label={t('orders.detail.copyCountry')}
                        copiedLabel={t('orders.detail.copied')}
                      />
                    </Text>
                    {/* The buyer's phone belongs with the ship-to block, the
                        way eBay's own order page prints it — it is part of the
                        label, not of "contact". */}
                    {buyerPhoneDisplay ? (
                      <S.AddressPhoneRow>
                        <Icon name="phone" size={14} />
                        <Text variant="body-sm" color="text.secondary">
                          <CopyableText
                            value={buyerPhoneDisplay}
                            label={t('orders.detail.copyPhone')}
                            copiedLabel={t('orders.detail.copied')}
                          />
                        </Text>
                      </S.AddressPhoneRow>
                    ) : null}
                  </S.AddressBlock>
                ) : null}
              </MetaBlock>
              <Meta icon="mail" label={t('orders.detail.contact')}>
                <Text variant="body-sm">{order.buyerEmail || '—'}</Text>
              </Meta>
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
              <S.SectionActions>
                <Button variant="secondary" size="small" onClick={onCopyAddress} fullWidth>
                  <Icon name="copy" size={16} />
                  <Text variant="body-sm">{t('orders.detail.copyAddress')}</Text>
                </Button>
              </S.SectionActions>
            )}
          </S.SectionContent>
        </SettingsCard>

        {/* eBay summary */}
        <SettingsCard variant="section" header={{ title: t('orders.detail.ebaySummary') }}>
          <S.SectionContent>
            {/* Group labels are one shared row unit tall (S.GroupLabel) so the
                rows under them stay level with the neighbouring cards. */}
            <S.GroupLabel>
              <Text variant="body-sm" weight="semibold">
                {t('orders.detail.whatBuyerPaid')}
              </Text>
            </S.GroupLabel>
            <S.MetaList>
              <Meta icon="info" label={t('orders.detail.ebayStatus')}>
                <Text variant="body" weight="semibold">
                  {statusLabel}
                </Text>
              </Meta>
              {order.ebayCancelledAt ? (
                <Meta icon="x-circle" label={t('orders.detail.ebayCancelledOn')}>
                  <Text variant="body" weight="semibold">
                    {formatDate(order.ebayCancelledAt)}
                  </Text>
                </Meta>
              ) : null}
              {order.shipByDate ? (
                <Meta icon="clock" label={t('orders.detail.shipBy')}>
                  <Text variant="body" weight="semibold" numeric>
                    {formatDate(order.shipByDate)}
                  </Text>
                </Meta>
              ) : null}
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
                  {formatCurrency(resolvedSaleTax)}
                </Text>
              </Meta>
              <Meta icon="receipt" label={t('orders.detail.orderTotal')}>
                <Text variant="body" weight="semibold" numeric>
                  {formatCurrency(resolvedSaleTotal)}
                </Text>
              </Meta>
            </S.MetaList>
            <S.GroupLabel>
              <Text variant="body-sm" weight="semibold">
                {t('orders.detail.whatYouEarned')}
              </Text>
            </S.GroupLabel>
            <S.MetaList>
              <Meta icon="receipt" label={t('orders.detail.earningsOrderTotal')}>
                <Text variant="body" weight="semibold" numeric>
                  {formatCurrency(resolvedSaleTotal)}
                </Text>
              </Meta>
            </S.MetaList>
            <S.GroupLabel>
              <Text variant="caption" color="text.tertiary">
                {t('orders.detail.ebayCollectedFromBuyer')}
              </Text>
            </S.GroupLabel>
            <S.MetaList>
              <Meta icon="percent" label={t('orders.detail.ebayCollectedTax')}>
                <Text variant="body" weight="semibold" numeric>
                  −{formatCurrency(resolvedSaleTax)}
                </Text>
              </Meta>
            </S.MetaList>
            <S.GroupLabel>
              <Text variant="caption" color="text.tertiary">
                {t('orders.detail.sellingCosts')}
              </Text>
            </S.GroupLabel>
            <S.MetaList>
              {/* `ebayMarketplaceFee` is eBay's own reported figure (migration
                  098); `transactionFee` is only the seller's configured-percent
                  ESTIMATE, shown here solely when eBay has not reported yet. */}
              <Meta icon="coins" label={t('orders.detail.transactionFees')}>
                <Text variant="body" weight="semibold" numeric>
                  −{formatCurrency(order.ebayMarketplaceFee ?? order.transactionFee)}
                </Text>
              </Meta>
              {/* `adFee` is the settings group's configured FIXED fee — an
                  estimate, not a charge eBay reported. eBay's own figure above
                  already contains its per-order fixed portion, so listing this
                  beside it double-counted and the rows stopped adding up to the
                  earnings. Shown only while eBay has not reported the real fee. */}
              {(order.ebayMarketplaceFee === null || order.ebayMarketplaceFee === undefined) && order.adFee > 0 ? (
                <Meta icon="megaphone" label={t('orders.detail.adFee')}>
                  <Text variant="body" weight="semibold" numeric>
                    −{formatCurrency(order.adFee)}
                  </Text>
                </Meta>
              ) : null}
            </S.MetaList>
            <S.MetaList>
              <Meta icon="wallet-cards" label={t('orders.detail.orderEarnings')}>
                <Text variant="metric-sm" weight="bold" numeric>
                  {formatCurrency(order.ebayEarnings)}
                </Text>
              </Meta>
            </S.MetaList>
            {/* What eBay reports was refunded (paymentSummary.refunds). NULL
                means eBay reported no refund, so the block is absent — never a
                "0.00" row that would read as a refund of nothing. */}
            {order.ebayRefundedAmount !== null && order.ebayRefundedAmount !== undefined ? (
              <>
                <S.GroupLabel>
                  <Text variant="caption" color="text.tertiary">
                    {t('orders.detail.refundGroup')}
                  </Text>
                </S.GroupLabel>
                <S.MetaList>
                  <Meta icon="undo-2" label={t('orders.detail.refundedAmount')}>
                    <Text variant="body" weight="semibold" numeric>
                      −{formatCurrency(order.ebayRefundedAmount)}
                    </Text>
                  </Meta>
                  {order.ebayRefundedAt ? (
                    <Meta icon="calendar" label={t('orders.detail.refundedOn')}>
                      <Text variant="body" weight="semibold">
                        {formatDate(order.ebayRefundedAt)}
                      </Text>
                    </Meta>
                  ) : null}
                </S.MetaList>
                <InfoMessage>{t('orders.detail.refundNote')}</InfoMessage>
              </>
            ) : null}
          </S.SectionContent>
        </SettingsCard>

        {/* Amazon costs */}
        <SettingsCard variant="section" header={{ title: t('orders.detail.amazonCosts') }}>
          <S.SectionContent>
            {/* Same lines, same order, same names as Amazon's own Order Summary
                (Item(s) Subtotal / Shipping & Handling / Total before tax /
                Estimated tax to be collected / Grand Total) so the seller can
                check this card against the Amazon page line by line. The
                label mirrors the eBay card's "What your buyer paid" so both
                cards' rows start on the same shared row unit. */}
            <S.GroupLabel>
              <Text variant="body-sm" weight="semibold">
                {t('orders.detail.whatYouPaidAmazon')}
              </Text>
            </S.GroupLabel>
            <S.MetaList>
              <Meta icon="shopping-bag" label={t('orders.detail.itemSubtotal')}>
                <Text variant="body" weight="semibold" numeric>
                  {formatCurrency(order.purchasePrice)}
                </Text>
              </Meta>
              <Meta icon="truck" label={t('orders.detail.shippingHandling')}>
                <Text variant="body" weight="semibold" numeric>
                  {formatCurrency(order.amazonShipping || 0)}
                </Text>
              </Meta>
              <Meta icon="receipt" label={t('orders.detail.totalBeforeTax')}>
                <Text variant="body" weight="semibold" numeric>
                  {formatCurrency(amazonTotalBeforeTax)}
                </Text>
              </Meta>
              <Meta icon="percent" label={t('orders.detail.estimatedTax')}>
                <Text variant="body" weight="semibold" numeric>
                  {formatCurrency(order.amazonTax || 0)}
                </Text>
              </Meta>
              <Meta icon="circle-dollar-sign" label={t('orders.detail.grandTotal')}>
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
            <S.SectionActions>
              {order.trackingProblemCode && (
                <InfoMessage>{t(trackingProblemToI18nKey(order.trackingProblemCode))}</InfoMessage>
              )}
              {canStartAutoFulfill && onStartAutoFulfill ? (
                <Button
                  variant="primary"
                  size="small"
                  fullWidth
                  onClick={onStartAutoFulfill}
                  isLoading={isStartingAutoFulfill}
                >
                  <Icon name="shopping-cart" size={16} />
                  <Text variant="body-sm">{t('orders.autoFulfill.start.button')}</Text>
                </Button>
              ) : null}
              {/* Purchase not confirmed: linking the order found on Amazon is
                  the primary action (the button below); declaring it "not on
                  Amazon" is the secondary one. */}
              {canConfirmNotPurchased && onConfirmNotPurchased ? (
                <Button
                  variant="secondary"
                  size="small"
                  fullWidth
                  onClick={onConfirmNotPurchased}
                  isLoading={isConfirmingNotPurchased}
                >
                  <Icon name="help" size={16} />
                  <Text variant="body-sm">{t('orders.autoFulfill.notPurchased.button')}</Text>
                </Button>
              ) : null}
              <Button
                variant={canStartAutoFulfill ? 'secondary' : 'primary'}
                size="small"
                onClick={onOpenLinkAmazon}
                fullWidth
                isLoading={isUpdating}
              >
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
            </S.SectionActions>
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
