import { CancellationBucket, OrderStage, ProfitBasis } from '@repo/shared';
import {
  Badge,
  Button,
  CopyableText,
  EmptyState,
  Icon,
  IdBadge,
  InfoMessage,
  PageHeader,
  SettingsCard,
  Text,
  ModernTextInput,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { OrderStageBadge } from '../shared/OrderStageBadge';
import { OrderTimeline } from '../shared/OrderTimeline';
import { trackingProblemToI18nKey } from '../shared/tracking-problem';

import * as S from './OrderDetailsPage.style';
import type { OrderDetailsPageProps } from './OrderDetailsPage.types';

/** eBay's documented cancel reasons; any other value is shown raw under the generic label. */
const KNOWN_CANCEL_REASONS: readonly string[] = [
  'BUYER_ASKED_CANCEL',
  'BUYER_CANCEL_OR_ADDRESS_ISSUE',
  'OUT_OF_STOCK_OR_CANNOT_FULFILL',
];

/** Same colours as the cancellations page: red overdue, amber due, teal answered, sky moving, green closed, grey unknown. */
const CANCEL_BUCKET_VARIANT: Record<CancellationBucket, 'error' | 'warning' | 'teal' | 'sky' | 'success' | 'neutral'> = {
  [CancellationBucket.ACTION_OVERDUE]: 'error',
  [CancellationBucket.ACTION_DUE]: 'warning',
  [CancellationBucket.ANSWERED]: 'teal',
  [CancellationBucket.IN_PROGRESS]: 'sky',
  [CancellationBucket.CLOSED]: 'success',
  [CancellationBucket.UNCONFIRMED]: 'neutral',
};

/** Label on the left, value right-aligned. No icon: the label is the signpost. */
const Meta = ({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement => (
  <S.MetaRow>
    <S.MetaLabel>
      <Text variant="body-sm" color="text.secondary">
        {label}
      </Text>
    </S.MetaLabel>
    <S.MetaValue>{children}</S.MetaValue>
  </S.MetaRow>
);

/** A money row of a card — the figure in tabular numerals, emphasised on a total. */
const Money = ({ label, value, total = false }: { label: string; value: string; total?: boolean }): React.ReactElement => (
  <Meta label={label}>
    <Text variant={total ? 'metric-sm' : 'body-sm'} weight={total ? 'semibold' : 'medium'} numeric>
      {value}
    </Text>
  </Meta>
);

/** A record fact in the hero — label on a fixed track, value beside it. */
const Fact = ({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement => (
  <S.IdItem>
    <Text variant="body-sm" color="text.secondary">
      {label}
    </Text>
    <S.IdValue>{children}</S.IdValue>
  </S.IdItem>
);

/** One figure of the hero's money strip — the listing detail's KPI. */
const Kpi = ({
  label,
  value,
  color,
  emphasis = false,
}: {
  label: string;
  value: string;
  color?: string;
  emphasis?: boolean;
}): React.ReactElement => (
  <S.KpiItem>
    <S.KpiLabel variant="caption" color="text.secondary">
      {label}
    </S.KpiLabel>
    <Text variant={emphasis ? 'metric-lg' : 'metric-sm'} weight={emphasis ? 'bold' : 'semibold'} numeric color={color}>
      {value}
    </Text>
  </S.KpiItem>
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
  marginLabel,
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
  noteDraft,
  noteMaxLength,
  isSavingNote,
  onNoteChange,
  onNoteBlur,
  onNoteKeyDown,
  onManageCancellation,
}) => {
  const { t } = useTranslation(['orders', 'translation']);

  /* Loading and not-found both route through the shared EmptyState molecule
     so the two states look like the same page. */
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
            actionIcon="arrow-left"
            action={t('translation:common.back')}
            onAction={onBack}
          />
        </S.StateCard>
      </S.Container>
    );
  }

  const profitPositive = order.netProfit >= 0;
  const profitColor = profitPositive ? 'semantic.success' : 'semantic.error';
  const productTitle = order.product?.title || t('orders.detail.unknownProduct');
  // A cancelled sale is settled, not estimated.
  const isEstimated = order.profitBasis === ProfitBasis.ESTIMATED && order.stage !== OrderStage.CANCELLED;

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
   * The listing detail's format: a standard page title and subtitle, then ONE
   * hero card carrying the record — the stage at its top-left, the photo, the
   * order number and facts, the money strip and the seller's own note. The
   * three summary cards follow, and the order's path closes the page.
   */
  return (
    <S.Container>
      <PageHeader
        title={t('orders.detail.title')}
        subtitle={t('orders.detail.subtitle')}
        onBack={onBack}
        backAriaLabel={t('translation:common.back')}
      />

      <S.Hero variant="elevated">
        <S.StatusBadgeSlot>
          <OrderStageBadge stage={order.stage} shippedDetectedAt={order.shippedDetectedAt} size="sm" withTooltip={false} />
          {isEstimated && (
            <Badge variant="warning" size="sm" solid>
              {t('orders.estimateBadge')}
            </Badge>
          )}
        </S.StatusBadgeSlot>

        <S.ProductImage>
          {order.product?.imageUrl ? (
            <img src={order.product.imageUrl} alt={productTitle} />
          ) : (
            <Icon name="image" size={48} />
          )}
        </S.ProductImage>

        <S.HeroInfo>
          <S.ProductTitle variant="h2" weight="bold">
            {productTitle}
          </S.ProductTitle>

          <S.IdList>
            <Fact label={t('orders.table.orderNumber')}>
              <Text variant="body-sm" weight="semibold" numeric>
                <CopyableText
                  value={order.ebayOrderId}
                  label={t('orders.table.orderNumber')}
                  copiedLabel={t('orders.detail.copied')}
                />
              </Text>
            </Fact>
            <Fact label={t('orders.detail.orderPlaced')}>
              <Text variant="body-sm" numeric>
                {formatDate(order.createdAt)}
              </Text>
            </Fact>
            <Fact label={t('orders.detail.quantity')}>
              <Text variant="body-sm" numeric>
                {order.product?.quantity || 1} {t('orders.detail.unit')}
              </Text>
            </Fact>
            {order.product?.sku ? (
              <Fact label={t('orders.detail.sku')}>
                <Text variant="body-sm">{order.product.sku}</Text>
              </Fact>
            ) : null}
            {order.product?.asin ? (
              <Fact label={t('orders.detail.asin')}>
                <IdBadge id={order.product.asin} storeType="amazon" size="sm" plain />
              </Fact>
            ) : null}
            {order.product?.ebayItemId ? (
              <Fact label={t('orders.detail.ebayItemId')}>
                <IdBadge id={order.product.ebayItemId} storeType="ebay" size="sm" plain />
              </Fact>
            ) : null}
          </S.IdList>
        </S.HeroInfo>

        {/* Who it goes to — inside the record card, on its right. */}
        <S.CustomerPanel>
          <Text variant="body" weight="semibold">
            {t('orders.detail.customerInfo')}
          </Text>
          <S.AddressBlock>
            <Text variant="body-sm" color="text.secondary">
              {t('orders.detail.shipTo')}
            </Text>
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
          </S.AddressBlock>
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
                  way eBay's own order page prints it. */}
              {buyerPhoneDisplay ? (
                <S.AddressPhoneRow>
                  <Icon name="phone" size={14} color="text.tertiary" />
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
          <S.AddressBlock>
            <Text variant="body-sm" color="text.secondary">
              {t('orders.detail.contact')}
            </Text>
            <Text variant="body-sm">{order.buyerEmail || '—'}</Text>
          </S.AddressBlock>
          {canCopyAddress && (
            <Button variant="primary" size="small" onClick={onCopyAddress}>
              <Icon name="copy" size={16} />
              <Text variant="body-sm">{t('orders.detail.copyAddress')}</Text>
            </Button>
          )}
        </S.CustomerPanel>

        {/* The money story in one strip, the listing detail's. */}
        <S.KpiArea>
          <S.KpiStrip>
            <Kpi
              label={t('orders.detail.netProfitResult')}
              emphasis
              value={formatCurrency(order.netProfit)}
              color={profitColor}
            />
            <Kpi label={t('orders.detail.roi')} value={roiLabel} />
            <Kpi label={t('orders.table.salePrice')} value={formatCurrency(order.salePrice)} />
            <Kpi label={t('orders.table.purchasePrice')} value={formatCurrency(totalAmazonCost)} />
            <Kpi label={t('orders.detail.margin')} value={marginLabel ?? '—'} />
          </S.KpiStrip>
          {isEstimated && (
            <S.EstimateNote variant="caption" color="text.tertiary">
              {t('orders.estimateNote')}
            </S.EstimateNote>
          )}
        </S.KpiArea>

        {/* The seller's own note — theirs alone: nothing sends it to eBay,
            Amazon or the buyer. One line; it saves when the field is left
            (Enter leaves it, Escape puts the saved text back). */}
        <S.HeroNote>
          <ModernTextInput
            name="sellerNote"
            label={t('orders.note.title')}
            value={noteDraft}
            onChange={onNoteChange}
            onBlur={onNoteBlur}
            onKeyDown={onNoteKeyDown}
            maxLength={noteMaxLength}
            size="small"
            isDisabled={isSavingNote}
            fullWidth
          />
          <Text variant="caption" color="text.secondary">
            {t('orders.note.hint')}
          </Text>
        </S.HeroNote>
      </S.Hero>

      <S.SectionGrid>
        {/* eBay summary */}
        <SettingsCard variant="section" header={{ title: t('orders.detail.ebaySummary') }}>
          <S.SectionContent>
            <S.GroupLabel>
              <Text variant="body-sm" weight="semibold">
                {t('orders.detail.whatBuyerPaid')}
              </Text>
            </S.GroupLabel>
            <S.MetaList>
              <Meta label={t('orders.detail.ebayStatus')}>
                <Text variant="body-sm" weight="medium">
                  {statusLabel}
                </Text>
              </Meta>
              {order.ebayCancelledAt ? (
                <Meta label={t('orders.detail.ebayCancelledOn')}>
                  <Text variant="body-sm" weight="medium">
                    {formatDate(order.ebayCancelledAt)}
                  </Text>
                </Meta>
              ) : null}
              {order.shipByDate ? (
                <Meta label={t('orders.detail.shipBy')}>
                  <Text variant="body-sm" weight="medium" numeric>
                    {formatDate(order.shipByDate)}
                  </Text>
                </Meta>
              ) : null}
              <Money label={t('orders.detail.subtotal')} value={formatCurrency(order.salePrice)} />
              <Money label={t('orders.detail.shipping')} value={formatCurrency(order.saleShipping)} />
              <Money label={t('orders.detail.salesTax')} value={formatCurrency(resolvedSaleTax)} />
              <Money label={t('orders.detail.orderTotal')} value={formatCurrency(resolvedSaleTotal)} />
            </S.MetaList>
            <S.GroupLabel>
              <Text variant="body-sm" weight="semibold">
                {t('orders.detail.whatYouEarned')}
              </Text>
            </S.GroupLabel>
            <S.MetaList>
              <Money label={t('orders.detail.earningsOrderTotal')} value={formatCurrency(resolvedSaleTotal)} />
            </S.MetaList>
            <S.GroupLabel>
              <Text variant="caption" color="text.tertiary">
                {t('orders.detail.ebayCollectedFromBuyer')}
              </Text>
            </S.GroupLabel>
            <S.MetaList>
              <Money label={t('orders.detail.ebayCollectedTax')} value={`−${formatCurrency(resolvedSaleTax)}`} />
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
              <Money
                label={t('orders.detail.transactionFees')}
                value={`−${formatCurrency(order.ebayMarketplaceFee ?? order.transactionFee)}`}
              />
              {/* `adFee` is the settings group's configured FIXED fee — an
                  estimate, not a charge eBay reported. eBay's own figure above
                  already contains its per-order fixed portion, so it is listed
                  only while eBay has not reported the real fee. */}
              {(order.ebayMarketplaceFee === null || order.ebayMarketplaceFee === undefined) && order.adFee > 0 ? (
                <Money label={t('orders.detail.adFee')} value={`−${formatCurrency(order.adFee)}`} />
              ) : null}
            </S.MetaList>
            <S.MetaList>
              <Money label={t('orders.detail.orderEarnings')} value={formatCurrency(order.ebayEarnings)} total />
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
                  <Money label={t('orders.detail.refundedAmount')} value={`−${formatCurrency(order.ebayRefundedAmount)}`} />
                  {order.ebayRefundedAt ? (
                    <Meta label={t('orders.detail.refundedOn')}>
                      <Text variant="body-sm" weight="medium">
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
                so the seller can check this card against the Amazon page line
                by line. */}
            <S.GroupLabel>
              <Text variant="body-sm" weight="semibold">
                {t('orders.detail.whatYouPaidAmazon')}
              </Text>
            </S.GroupLabel>
            <S.MetaList>
              <Money label={t('orders.detail.itemSubtotal')} value={formatCurrency(order.purchasePrice)} />
              <Money label={t('orders.detail.shippingHandling')} value={formatCurrency(order.amazonShipping || 0)} />
              <Money label={t('orders.detail.totalBeforeTax')} value={formatCurrency(amazonTotalBeforeTax)} />
              <Money label={t('orders.detail.estimatedTax')} value={formatCurrency(order.amazonTax || 0)} />
              <Money label={t('orders.detail.grandTotal')} value={formatCurrency(totalAmazonCost)} total />
              {order.amazonTrackingNumber && (
                <Meta label={t('orders.detail.amazonTracking')}>
                  <Text variant="body-sm" weight="medium" numeric>
                    {order.amazonTrackingNumber}
                  </Text>
                </Meta>
              )}
              {order.convertedTrackingNumber && (
                <Meta label={t('orders.detail.convertedTracking')}>
                  <Text variant="body-sm" weight="medium" numeric>
                    {order.convertedTrackingNumber}
                  </Text>
                </Meta>
              )}
            </S.MetaList>
            <S.SectionActions>
              {order.trackingProblemCode && (
                <InfoMessage type="warning">{t(trackingProblemToI18nKey(order.trackingProblemCode))}</InfoMessage>
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
                  variant="primary"
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
                variant="primary"
                size="small"
                onClick={onOpenLinkAmazon}
                fullWidth
                isLoading={isUpdating}
              >
                <Icon name="link" size={16} />
                <Text variant="body-sm">{t('orders.detail.linkAmazon')}</Text>
              </Button>
              {canConvertTracking && onConvertTracking ? (
                <Button
                  variant="primary"
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

      {/* A buyer's cancellation request: what they asked, by when eBay needs the
          answer, and the two answers the seller may give from here. */}
      {order.cancellation && (
        <SettingsCard variant="section" header={{ title: t('orders.cancellation.title') }}>
          <S.SectionContent>
            <S.MetaList>
              <Meta label={t('orders.cancellation.buyer')}>
                <Text variant="body-sm" weight="medium">
                  {order.cancellation.buyerLoginName ?? '—'}
                </Text>
              </Meta>
              <Meta label={t('orders.cancellation.reason')}>
                {order.cancellation.reason && KNOWN_CANCEL_REASONS.includes(order.cancellation.reason) ? (
                  <Text variant="body-sm" weight="medium">
                    {t(`orders.cancellation.reasons.${order.cancellation.reason}`)}
                  </Text>
                ) : (
                  <>
                    <Text variant="body-sm" weight="medium">
                      {t('orders.cancellation.reasons.other')}
                    </Text>
                    {order.cancellation.reason ? (
                      <Text variant="caption" color="text.tertiary">
                        {order.cancellation.reason}
                      </Text>
                    ) : null}
                  </>
                )}
              </Meta>
              {order.cancellation.requestedAt ? (
                <Meta label={t('orders.cancellation.requestedAt')}>
                  <Text variant="body-sm" weight="medium" numeric>
                    {formatDate(order.cancellation.requestedAt)}
                  </Text>
                </Meta>
              ) : null}
              {order.cancellation.bucket !== CancellationBucket.CLOSED && order.cancellation.sellerRespondBy ? (
                <Meta label={t('orders.cancellation.respondBy')}>
                  <Text variant="body-sm" weight="medium" numeric>
                    {formatDate(order.cancellation.sellerRespondBy)}
                  </Text>
                </Meta>
              ) : null}
              {order.cancellation.bucket === CancellationBucket.CLOSED ? (
                <>
                  {order.cancellation.closedAt ? (
                    <Meta label={t('orders.cancellation.closedOn')}>
                      <Text variant="body-sm" weight="medium" numeric>
                        {formatDate(order.cancellation.closedAt)}
                      </Text>
                    </Meta>
                  ) : null}
                  {order.cancellation.closeReason ? (
                    <Meta label={t('orders.cancellation.closeReason')}>
                      <Text variant="body-sm" color="text.tertiary">
                        {order.cancellation.closeReason}
                      </Text>
                    </Meta>
                  ) : null}
                </>
              ) : null}
              <Meta label={t('orders.detail.ebayStatus')}>
                <Badge variant={CANCEL_BUCKET_VARIANT[order.cancellation.bucket]} size="xs" solid>
                  {t(`orders.cancellation.bucket.${order.cancellation.bucket}`)}
                </Badge>
              </Meta>
            </S.MetaList>
            <S.SectionActions>
              <Button variant="primary" size="small" fullWidth onClick={onManageCancellation}>
                <Icon name="arrow-right" size={16} />
                <Text variant="body-sm">{t('orders.cancellation.manage')}</Text>
              </Button>
            </S.SectionActions>
          </S.SectionContent>
        </SettingsCard>
      )}

      {/* The order's path, step by step: what happened and when, where it is
          standing now, and what is still ahead. */}
      {timelineRows.length > 0 && (
        <SettingsCard variant="section" header={{ title: t('orders.timeline.title') }}>
          <S.TimelineBody>
            {shipByLabel && (
              <InfoMessage type={isShipByUrgent ? 'error' : 'info'}>
                {t('orders.detail.shipByNotice', { date: shipByLabel })}
              </InfoMessage>
            )}
            {multiItemCount !== null && (
              <InfoMessage>{t('orders.detail.multiItemNotice', { count: multiItemCount })}</InfoMessage>
            )}
            <OrderTimeline rows={timelineRows} />
          </S.TimelineBody>
        </SettingsCard>
      )}

      <S.MobileActionBar>
        <Button variant="primary" size="medium" onClick={onOpenLinkAmazon} fullWidth isLoading={isUpdating}>
          <Icon name="link" size={16} />
          <Text variant="body" weight="semibold">
            {t('orders.detail.linkAmazon')}
          </Text>
        </Button>
        {canCopyAddress && (
          <Button variant="primary" size="medium" onClick={onCopyAddress}>
            <Icon name="copy" size={16} />
          </Button>
        )}
      </S.MobileActionBar>
    </S.Container>
  );
};
