import { ProfitBasis } from '@repo/shared';
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
  Textarea,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { OrderStageBadge } from '../shared/OrderStageBadge';
import { OrderTimeline } from '../shared/OrderTimeline';
import { trackingProblemToI18nKey } from '../shared/tracking-problem';

import * as S from './OrderDetailsPage.style';
import type { OrderDetailsPageProps } from './OrderDetailsPage.types';

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

/** Same row, value stacked BELOW the label — for multi-line content such as an address. */
const MetaBlock = ({
  label,
  rows,
  children,
}: {
  label: string;
  /** How many shared row units the block spans, so the rows under it keep lining up with the neighbouring cards. */
  rows?: number;
  children: React.ReactNode;
}): React.ReactElement => (
  <S.MetaBlockRow $rows={rows}>
    <Text variant="body-sm" color="text.secondary">
      {label}
    </Text>
    <S.MetaBlockValue>{children}</S.MetaBlockValue>
  </S.MetaBlockRow>
);

/** One line of the receipt: label, dotted leader, figure. */
const LedgerLine = ({
  label,
  value,
  total = false,
  color,
}: {
  label: string;
  value: string;
  total?: boolean;
  color?: string;
}): React.ReactElement => (
  <S.LedgerLine $total={total}>
    <Text variant="body-sm" color={total ? 'text.primary' : 'text.secondary'} weight={total ? 'semibold' : undefined}>
      {label}
    </Text>
    <S.LedgerLeader aria-hidden />
    <Text variant={total ? 'body' : 'body-sm'} weight={total ? 'semibold' : 'medium'} numeric color={color}>
      {value}
    </Text>
  </S.LedgerLine>
);

/** A record fact in the hero's label / value grid. */
const Fact = ({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement => (
  <>
    <S.FactLabel>
      <Text variant="body-sm" color="text.secondary">
        {label}
      </Text>
    </S.FactLabel>
    <S.FactValue>{children}</S.FactValue>
  </>
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
  isNoteDirty,
  isSavingNote,
  onNoteChange,
  onSaveNote,
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
   * The order number IS the page title — a detail page is named after its
   * record, not after the word "details". The stage sits beside it in the
   * header's action slot: the one status of the page, read before anything
   * else. Actions stay in the card that owns them (plus the mobile bar), so
   * no primary button competes with the stage up here.
   */
  return (
    <S.Container>
      <PageHeader
        title={order.ebayOrderId}
        subtitle={formatDate(order.createdAt)}
        onBack={onBack}
        backAriaLabel={t('translation:common.back')}
        actions={
          <OrderStageBadge stage={order.stage} shippedDetectedAt={order.shippedDetectedAt} size="md" withTooltip={false} />
        }
      />

      <S.Hero variant="elevated" padding="none">
        <S.Product>
          <S.ProductImage>
            {order.product?.imageUrl ? (
              <img src={order.product.imageUrl} alt={productTitle} />
            ) : (
              <Icon name="image" size={48} />
            )}
          </S.ProductImage>

          <S.ProductInfo>
            <S.ProductTitle variant="h3" weight="semibold">
              {productTitle}
            </S.ProductTitle>

            <S.FactList>
              <Fact label={t('orders.table.buyer')}>
                <Text variant="body-sm">{order.buyerName || '—'}</Text>
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
            </S.FactList>
          </S.ProductInfo>
        </S.Product>

        {/* The receipt: the one figure the seller came for, then the lines
            that produced it — sale, what eBay paid out, what Amazon took. A
            number a seller can check line by line is a number they trust. */}
        <S.Ledger>
          <S.LedgerHead>
            <S.LedgerLabelRow>
              <Text variant="body-sm" color="text.secondary">
                {t('orders.detail.netProfitResult')}
              </Text>
              {isEstimated && (
                <Badge variant="warning" size="xs">
                  {t('orders.estimateBadge')}
                </Badge>
              )}
            </S.LedgerLabelRow>
            <S.HeadlineFigure variant="display" numeric $positive={profitPositive}>
              {profitPositive ? '+' : ''}
              {formatCurrency(order.netProfit)}
            </S.HeadlineFigure>
            <S.LedgerRatios>
              {marginLabel && (
                <S.LedgerRatio>
                  <Text variant="caption" color="text.secondary">
                    {t('orders.detail.margin')}
                  </Text>
                  <Text variant="body-sm" weight="semibold" numeric>
                    {marginLabel}
                  </Text>
                </S.LedgerRatio>
              )}
              <S.LedgerRatio>
                <Text variant="caption" color="text.secondary">
                  {t('orders.detail.roi')}
                </Text>
                <Text variant="body-sm" weight="semibold" numeric>
                  {roiLabel}
                </Text>
              </S.LedgerRatio>
            </S.LedgerRatios>
          </S.LedgerHead>

          <S.LedgerLines>
            <LedgerLine label={t('orders.table.salePrice')} value={formatCurrency(order.salePrice)} />
            <LedgerLine label={t('orders.detail.orderEarnings')} value={formatCurrency(order.ebayEarnings)} />
            <LedgerLine label={t('orders.detail.totalAmazonCost')} value={`−${formatCurrency(totalAmazonCost)}`} />
            <LedgerLine
              label={t('orders.detail.netProfitResult')}
              value={formatCurrency(order.netProfit)}
              total
              color={profitColor}
            />
          </S.LedgerLines>

          {isEstimated && (
            <S.EstimateNote variant="caption" color="text.tertiary">
              {t('orders.estimateNote')}
            </S.EstimateNote>
          )}
        </S.Ledger>
      </S.Hero>

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

      {/* The seller's own note — theirs alone: nothing sends it to eBay,
          Amazon or the buyer. */}
      <SettingsCard variant="section" header={{ title: t('orders.note.title') }}>
        <S.NoteBody>
          <Textarea
            value={noteDraft}
            onChange={onNoteChange}
            rows={3}
            fullWidth
            maxLength={noteMaxLength}
            placeholder={t('orders.note.placeholder')}
            aria-label={t('orders.note.title')}
          />
          <S.NoteFooter>
            <Text variant="caption" color="text.secondary">
              {t('orders.note.hint')}
            </Text>
            <Button variant="secondary" size="small" onClick={onSaveNote} isLoading={isSavingNote} disabled={!isNoteDirty}>
              <Text variant="body-sm">{t('orders.note.save')}</Text>
            </Button>
          </S.NoteFooter>
        </S.NoteBody>
      </SettingsCard>

      <S.SectionGrid>
        {/* Customer */}
        <SettingsCard variant="section" header={{ title: t('orders.detail.customerInfo') }}>
          <S.SectionContent>
            <S.MetaList>
              <MetaBlock label={t('orders.detail.shipTo')} rows={4}>
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
              </MetaBlock>
              <Meta label={t('orders.detail.contact')}>
                <Text variant="body-sm">{order.buyerEmail || '—'}</Text>
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
