import { OrderDto, OrderStatus } from '@repo/shared';
import { Icon, IdBadge, PageHeader, StatusBadge, useLoading } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { AmazonDetailsModal } from './components/AmazonDetailsModal';
import * as S from './OrderDetailsPage.style';

interface OrderDetailsPageComponentProps {
  order: OrderDto | undefined;
  isLoading: boolean;
  isUpdating?: boolean;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
  onUpdateAmazonDetails?: (data: {
    amazonOrderUrl?: string;
    amazonTrackingUrl?: string;
    purchasePrice?: number;
    amazonTax?: number;
    amazonShipping?: number;
  }) => void;
  onOpenLinkAmazonModal?: () => void;
  onBack: () => void;
}

const orderStatusToBadgeStatus = (status: OrderStatus): string => {
  const map: Record<OrderStatus, string> = {
    [OrderStatus.COMPLETED]: 'completed',
    [OrderStatus.SHIPPED]: 'shipped',
    [OrderStatus.PROCESSING]: 'processing',
    [OrderStatus.CANCELLED]: 'cancelled',
    [OrderStatus.PENDING]: 'pending',
    [OrderStatus.WAITING_SHIPMENT]: 'warning',
  };
  return map[status] || 'default';
};

export const OrderDetailsPageComponent: React.FC<OrderDetailsPageComponentProps> = ({
  order,
  isLoading,
  isUpdating,
  formatCurrency,
  formatDate,
  onUpdateAmazonDetails,
  onOpenLinkAmazonModal,
  onBack,
}) => {
  const { t } = useTranslation(['orders', 'translation']);
  useLoading(isLoading);

  const [isAmazonModalOpen, setIsAmazonModalOpen] = React.useState(false);

  if (!order || isLoading) {
    return null;
  }

  const handleUpdateAmazonDetails = (values: {
    amazonOrderUrl?: string;
    amazonTrackingUrl?: string;
    purchasePrice?: number;
    amazonTax?: number;
    amazonShipping?: number;
  }) => {
    if (onUpdateAmazonDetails) {
      onUpdateAmazonDetails(values);
      setIsAmazonModalOpen(false);
    }
  };

  const calculateRoi = (profit: number, cost: number) => {
    if (cost === 0) {return '0.0%';}
    return `${((profit / cost) * 100).toFixed(1)}%`;
  };

  const headerSubtitle = (
    <S.Metadata>
      <S.MetadataItem>
        <Icon name="calendar-today" size={16} />
        {t('orders.detail.orderPlaced')}: {formatDate(order.createdAt)}
      </S.MetadataItem>
      <S.Separator>|</S.Separator>
      <S.MetadataItem>
        <Icon name="tag" size={16} />
        {t('orders.table.orderNumber')}: {order.ebayOrderId}
      </S.MetadataItem>
    </S.Metadata>
  );

  const totalAmazonCost = order.purchasePrice + (order.amazonTax || 0) + (order.amazonShipping || 0);

  return (
    <S.PageWrapper>
      <S.BackLink variant="text" onClick={onBack}>
        <Icon name="chevron-left" size={20} />
        {t('translation:common.back')}
      </S.BackLink>

      {/* Header */}
      <PageHeader title={t('orders.detail.title')} subtitle={headerSubtitle} />

      {/* Product Info Card */}
      <S.ProductCard variant="bordered">
        <S.ProductWrapper>
          <S.ProductImage>
            {order.product?.imageUrl ? (
              <img src={order.product.imageUrl} alt={order.product.title} />
            ) : (
              <S.EmptyImagePlaceholder>
                <Icon name="image" size={48} color="text.tertiary" />
              </S.EmptyImagePlaceholder>
            )}
          </S.ProductImage>
          <S.ProductInfo>
            <S.ProductTitle variant="h2" weight="semibold">{order.product?.title || t('orders.detail.unknownProduct')}</S.ProductTitle>
            <S.ProductMetadata>
              {order.product?.asin ? (
                <IdBadge id={order.product.asin} storeType="amazon" size="sm" />
              ) : (
                <IdBadge id="—" storeType="amazon" size="sm" />
              )}
              {order.product?.ebayItemId ? (
                <IdBadge id={order.product.ebayItemId} storeType="ebay" size="sm" />
              ) : (
                <IdBadge id="—" storeType="ebay" size="sm" />
              )}
              <StatusBadge status={orderStatusToBadgeStatus(order.status)}>
                <Icon name="check_circle" size={14} />
                {t(`orders.status.${order.status}`)}
              </StatusBadge>
            </S.ProductMetadata>
            <S.LabelValueGroup>
              <S.LabelValue>
                <div className="label">{t('orders.detail.quantity')}</div>
                <div className="value">
                  {order.product?.quantity || 1} {t('orders.detail.unit')}
                </div>
              </S.LabelValue>
              <S.LabelValue>
                <div className="label">{t('orders.detail.sku')}</div>
                <div className="value">{order.product?.sku || t('orders.detail.na')}</div>
              </S.LabelValue>
            </S.LabelValueGroup>
          </S.ProductInfo>
        </S.ProductWrapper>
      </S.ProductCard>

      {/* Net Profit Analysis */}
      <S.AnalysisCard variant="bordered">
        <S.AnalysisMetadata>
          <div>
            <S.AnalysisTitle>
              <Icon name="insights" size={24} color="semantic.info" />
              {t('orders.detail.netProfitAnalysis')}
            </S.AnalysisTitle>
            <S.AnalysisDescription>
              {t('orders.detail.analysisDesc')}
            </S.AnalysisDescription>
          </div>

          <S.AnalysisValues>
            <S.Calculation>
              <div className="label">{t('orders.detail.calculation')}</div>
              <div className="formula">
                <span>{t('orders.detail.calcEarnings')} {formatCurrency(order.ebayEarnings)}</span>
                <S.FormulaMinus>-</S.FormulaMinus>
                <span>{t('orders.detail.calcPurchase')} {formatCurrency(order.purchasePrice)}</span>
                <S.FormulaMinus>-</S.FormulaMinus>
                <span>{t('orders.detail.calcTax')} {formatCurrency(order.amazonTax || 0)}</span>
                <S.FormulaMinus>-</S.FormulaMinus>
                <span>{t('orders.detail.calcShipping')} {formatCurrency(order.amazonShipping || 0)}</span>
              </div>
            </S.Calculation>

            <S.Divider />

            <S.ProfitResult>
              <div className="label">{t('orders.detail.netProfitResult')}</div>
              <div className="value">
                <span>$</span>
                {order.netProfit.toFixed(2)}
                <Icon name={order.netProfit >= 0 ? 'trending-up' : 'trending-down'} size={32} color={order.netProfit >= 0 ? 'semantic.success' : 'semantic.error'} />
              </div>
            </S.ProfitResult>

            <S.Roi>
              <div className="label">{t('orders.detail.roi')}</div>
              <div className="value">{calculateRoi(order.netProfit, totalAmazonCost)}</div>
            </S.Roi>
          </S.AnalysisValues>
        </S.AnalysisMetadata>
      </S.AnalysisCard>

      {/* 3-column grid */}
      <S.Grid>
        {/* Customer Info */}
        <S.SectionCard variant="bordered">
          <S.SectionTitle variant="h3" weight="bold">
            <Icon name="user" size={20} color="text.tertiary" />
          {t('orders.detail.customerInfo')}
        </S.SectionTitle>
        <S.ContentRow>
          <div className="label">{t('orders.detail.shipTo')}</div>
          <S.BoldText variant="body" weight="semibold">{order.buyerName}</S.BoldText>
          {order.shippingAddress && (
            <S.AddressBlock>
              <S.AddressLine>{order.shippingAddress.street}</S.AddressLine>
              <S.AddressLine>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}</S.AddressLine>
              <S.AddressLine>{order.shippingAddress.country}</S.AddressLine>
              <S.CopyButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  const addr = [
                    order.buyerName,
                    order.shippingAddress!.street,
                    `${order.shippingAddress!.city}, ${order.shippingAddress!.state} ${order.shippingAddress!.zipCode}`,
                    order.shippingAddress!.country,
                  ].join('\n');
                  void navigator.clipboard.writeText(addr);
                }}
              >
                <Icon name="copy" size={14} />
                {t('orders.detail.copyAddress')}
              </S.CopyButton>
            </S.AddressBlock>
          )}
        </S.ContentRow>
        <S.ContentRow>
          <div className="label">{t('orders.detail.contact')}</div>
          <S.AddressText variant="body" muted>{order.buyerEmail}</S.AddressText>
          {order.buyerPhone && <S.AddressText variant="body" muted>{order.buyerPhone}</S.AddressText>}
        </S.ContentRow>
      </S.SectionCard>

      {/* eBay Sales Summary */}
      <S.SectionCard variant="bordered">
        <S.SectionTitle variant="h3" weight="bold">
          <Icon name="tag" size={20} color="text.tertiary" />
          {t('orders.detail.ebaySummary')}
        </S.SectionTitle>

        <S.SummarySection>
          <S.SectionHeader>{t('orders.detail.whatBuyerPaid')}</S.SectionHeader>
          <S.SummaryRow>
            <span>{t('orders.detail.subtotal')}</span>
            <span>{formatCurrency(order.salePrice)}</span>
          </S.SummaryRow>
          <S.SummaryRow>
            <span>{t('orders.detail.shipping')}</span>
            <span>{formatCurrency(order.saleShipping)}</span>
          </S.SummaryRow>
          <S.SummaryRow>
            <span>{t('orders.detail.salesTax')}</span>
            <span>{formatCurrency(order.saleTax)}</span>
          </S.SummaryRow>
          <S.SummaryRow $bold $bordered>
            <span>{t('orders.detail.orderTotal')}</span>
            <span>{formatCurrency(order.saleTotal)}</span>
          </S.SummaryRow>
        </S.SummarySection>

        <S.SummarySectionSmall>
          <S.SectionHeaderRow>
            <S.SectionHeader>{t('orders.detail.whatYouEarned')}</S.SectionHeader>
            <Icon name="chevron-up" size={14} color="text.tertiary" />
          </S.SectionHeaderRow>
          <S.SummaryRow $bold>
            <span>{t('orders.detail.orderTotal')}</span>
            <span>{formatCurrency(order.saleTotal)}</span>
          </S.SummaryRow>
          <S.FeesSection>
            <div className="fees-label">{t('orders.detail.feesCollected')}</div>
            <S.FeeRow>
              <span>{t('orders.detail.salesTax')}</span>
              <span>-{formatCurrency(order.saleTax)}</span>
            </S.FeeRow>
            <S.FeeRow>
              <S.DottedUnderline>
                {t('orders.detail.transactionFees')}
              </S.DottedUnderline>
              <span>-{formatCurrency(order.transactionFee)}</span>
            </S.FeeRow>
            <S.FeeRow>
              <span>{t('orders.detail.adFee')}</span>
              <span>-{formatCurrency(order.adFee)}</span>
            </S.FeeRow>
          </S.FeesSection>
          <S.EarningsLink>
            <S.DottedUnderline>{t('orders.detail.orderEarnings')}</S.DottedUnderline>
            <span>{formatCurrency(order.ebayEarnings)}</span>
          </S.EarningsLink>
        </S.SummarySectionSmall>
      </S.SectionCard>

      {/* Amazon Order Summary */}
      <S.SectionCard variant="bordered">
        <S.SectionTitle variant="h3" weight="bold">
          <Icon name="shopping-bag" size={20} color="text.tertiary" />
          {t('orders.detail.amazonCosts')}
        </S.SectionTitle>

        <S.SummaryFlex>
          <S.SummaryRow>
            <span>{t('orders.detail.purchasePrice')}</span>
            <span>{formatCurrency(order.purchasePrice)}</span>
          </S.SummaryRow>
          <S.SummaryRow>
            <span>{t('orders.detail.amazonTax')}</span>
            <span>{formatCurrency(order.amazonTax || 0)}</span>
          </S.SummaryRow>
          <S.SummaryRow>
            <span>{t('orders.detail.amazonShipping')}</span>
            <span>{formatCurrency(order.amazonShipping || 0)}</span>
          </S.SummaryRow>
          <S.SummaryRow $bold $bordered>
            <span>{t('orders.detail.totalAmazonCost')}</span>
            <span>{formatCurrency(totalAmazonCost)}</span>
          </S.SummaryRow>
        </S.SummaryFlex>

        <S.AmazonUpdateButton
          variant="secondary"
          size="small"
          fullWidth
          onClick={() => onOpenLinkAmazonModal?.()}
        >
          {t('orders.detail.linkAmazon')}
        </S.AmazonUpdateButton>

        {order.amazonOrderUrl && (
          <S.ContentRow>
            <div className="label">{t('orders.detail.amazonOrder')}</div>
            <S.AddressText variant="body" muted>
              <a href={order.amazonOrderUrl} target="_blank" rel="noreferrer">{order.amazonOrderUrl}</a>
            </S.AddressText>
          </S.ContentRow>
        )}
      </S.SectionCard>
    </S.Grid>

      {order && (
        <AmazonDetailsModal
          isOpen={isAmazonModalOpen}
          onClose={() => setIsAmazonModalOpen(false)}
          onSave={handleUpdateAmazonDetails}
          isLoading={isUpdating}
        />
      )}
    </S.PageWrapper>
  );
};
