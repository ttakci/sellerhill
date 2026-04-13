import { OrderDto, OrderStatus } from '@repo/shared';
import { Badge, Button, Icon, IdBadge, PageHeader, StatusBadge, useLoading } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { AmazonDetailsModal } from './components/AmazonDetailsModal';
import * as S from './OrderDetailsPage.style';

interface OrderDetailsPageComponentProps {
  order: OrderDto | undefined;
  isLoading: boolean;
  isUpdating?: boolean;
  onUpdateAmazonDetails?: (data: {
    amazonOrderUrl?: string;
    amazonTrackingUrl?: string;
    amazonTax?: number;
    amazonShipping?: number;
  }) => void;
  onBack: () => void;
}

/** Map OrderStatus enum values to StatusBadge-compatible status strings */
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
  onUpdateAmazonDetails,
  onBack,
}) => {
  const { t, i18n } = useTranslation(['orders', 'translation']);
  useLoading(isLoading);

  const [isAmazonModalOpen, setIsAmazonModalOpen] = React.useState(false);

  if (!order || isLoading) {
    return null;
  }

  const handleUpdateAmazonDetails = async (values: any) => {
    if (onUpdateAmazonDetails) {
      await onUpdateAmazonDetails(values);
      setIsAmazonModalOpen(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(i18n.language === 'tr' ? 'tr-TR' : 'en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat(i18n.language === 'tr' ? 'tr-TR' : 'en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(dateString));
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
        {t('orders.table.orderNumber')}: {order.orderNumber}
      </S.MetadataItem>
    </S.Metadata>
  );

  const headerActions = (
    <S.Actions>
      <Button variant="secondary" size="medium">
        <Icon name="receipt" size={18} />
        {t('orders.detail.viewInvoice')}
      </Button>
      <Button variant="primary" size="medium">
        <Icon name="print" size={18} />
        {t('orders.detail.printLabels')}
      </Button>
    </S.Actions>
  );

  return (
    <S.PageWrapper>
      <S.BackLink variant="text" onClick={onBack}>
        <Icon name="chevron-left" size={20} />
        {t('translation:common.back')}
      </S.BackLink>

      {/* Header */}
      <PageHeader title={t('orders.detail.title')} subtitle={headerSubtitle} actions={headerActions} />

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
                <Badge variant="neutral" size="sm">
                  <S.BadgeLabel>{t('orders.detail.asin')}</S.BadgeLabel> -
                </Badge>
              )}
              {order.product?.ebayItemId ? (
                <IdBadge id={order.product.ebayItemId} storeType="ebay" size="sm" />
              ) : (
                <Badge variant="neutral" size="sm">
                  <S.BadgeLabel>{t('orders.detail.ebayItemId')}</S.BadgeLabel> -
                </Badge>
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

      {/* Main Content Grid */}
      <S.Grid>
        {/* Receiver Info */}
        <S.SectionCard variant="bordered">
          <S.SectionTitle variant="h3" weight="bold">
            <Icon name="user" size={20} color="text.tertiary" />
            {t('orders.detail.customerInfo')}
          </S.SectionTitle>
          <S.ContentRow>
            <div className="label">{t('orders.detail.shipTo')}</div>
            <S.BoldText variant="body" weight="semibold">{order.buyerName}</S.BoldText>
            {order.shippingAddress && (
              <S.AddressText variant="body" muted>
                {order.shippingAddress.street}
                <br />
                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                <br />
                {order.shippingAddress.country}
              </S.AddressText>
            )}
          </S.ContentRow>
          <S.ContentRow>
            <div className="label">{t('orders.detail.contact')}</div>
            <S.AddressText variant="body" muted>{order.buyerEmail}</S.AddressText>
            {order.buyerPhone && <S.AddressText variant="body" muted>{order.buyerPhone}</S.AddressText>}
          </S.ContentRow>
        </S.SectionCard>

        {/* Purchase Summary */}
        <S.SectionCard variant="bordered">
          <S.SectionTitle variant="h3" weight="bold">
            <Icon name="shopping_cart" size={20} color="text.tertiary" />
            {t('orders.detail.buyerPayment')}
          </S.SectionTitle>
          <S.SummaryFlex>
            <S.SummaryRow>
              <span>{t('orders.detail.itemSubtotal')}:</span>
              <span>{formatCurrency(order.details?.purchaseSummary?.subtotal || order.purchasePrice)}</span>
            </S.SummaryRow>
            <S.SummaryRow>
              <span>{t('orders.detail.shippingHandling')}:</span>
              <span>{formatCurrency(order.details?.purchaseSummary?.shipping || 0)}</span>
            </S.SummaryRow>
            <S.SummaryRow>
              <span>{t('orders.detail.totalBeforeTax')}:</span>
              <span>
                {formatCurrency(
                  (order.details?.purchaseSummary?.subtotal || order.purchasePrice) +
                    (order.details?.purchaseSummary?.shipping || 0),
                )}
              </span>
            </S.SummaryRow>
            <S.SummaryRow>
              <span>{t('orders.detail.estimatedTax')}:</span>
              <span>{formatCurrency(order.details?.purchaseSummary?.tax || 0)}</span>
            </S.SummaryRow>
            <S.SummaryRow $total>
              <span>{t('orders.detail.grandTotal')}:</span>
              <span>{formatCurrency(order.details?.purchaseSummary?.total || order.purchasePrice)}</span>
            </S.SummaryRow>
          </S.SummaryFlex>
          <S.PaymentMethod>
            <S.PaymentIconWrapper>
              <Icon name="payments" size={16} color="text.tertiary" />
            </S.PaymentIconWrapper>
            <div>
              <p className="label">{t('orders.detail.paymentMethod')}</p>
              <p className="value">{order.details?.purchaseSummary?.paymentMethod || '-'}</p>
            </div>
          </S.PaymentMethod>
        </S.SectionCard>

        {/* eBay Sales Summary */}
        <S.SectionCard variant="bordered">
          <S.SectionTitle variant="h3" weight="bold">
            <Icon name="tag" size={20} color="text.tertiary" />
            {t('orders.detail.ebaySummary', { defaultValue: 'eBay Sales Summary' })}
          </S.SectionTitle>

          <S.SummarySection>
            <S.SectionHeader>{t('orders.detail.whatBuyerPaid')}</S.SectionHeader>
            <S.SummaryRow>
              <span>{t('orders.detail.subtotal')}</span>
              <span>{formatCurrency(order.details?.ebaySummary?.subtotal || order.salePrice)}</span>
            </S.SummaryRow>
            <S.SummaryRow>
              <span>{t('orders.detail.shipping')}</span>
              <span>{formatCurrency(order.details?.ebaySummary?.shipping || 0)}</span>
            </S.SummaryRow>
            <S.SummaryRow>
              <span>{t('orders.detail.salesTax')}</span>
              <span>{formatCurrency(order.details?.ebaySummary?.tax || 0)}</span>
            </S.SummaryRow>
            <S.SummaryRow $bold $bordered>
              <span>{t('orders.detail.orderTotal')}</span>
              <span>{formatCurrency(order.details?.ebaySummary?.total || order.salePrice)}</span>
            </S.SummaryRow>
          </S.SummarySection>

          <S.SummarySectionSmall>
            <S.SectionHeaderRow>
              <S.SectionHeader>{t('orders.detail.whatYouEarned')}</S.SectionHeader>
              <Icon name="chevron-up" size={14} color="text.tertiary" />
            </S.SectionHeaderRow>
            <S.SummaryRow $bold>
              <span>{t('orders.detail.orderTotal')}</span>
              <span>{formatCurrency(order.details?.ebaySummary?.total || order.salePrice)}</span>
            </S.SummaryRow>
            <S.FeesSection>
              <div className="fees-label">{t('orders.detail.feesCollected')}</div>
              <S.FeeRow>
                <span>{t('orders.detail.salesTax')}</span>
                <span>-{formatCurrency(order.details?.ebaySummary?.tax || 0)}</span>
              </S.FeeRow>
              <S.FeeRow>
                <S.DottedUnderline>
                  {t('orders.detail.transactionFees')}
                </S.DottedUnderline>
                <span>-{formatCurrency(order.fees?.transactionFee || 0)}</span>
              </S.FeeRow>
              <S.FeeRow>
                <span>{t('orders.detail.adFee')}</span>
                <span>-{formatCurrency(order.fees?.advertisingFee || 0)}</span>
              </S.FeeRow>
            </S.FeesSection>
            <S.EarningsLink>
              <S.DottedUnderline>{t('orders.detail.orderEarnings')}</S.DottedUnderline>
              <span>{formatCurrency(order.details?.ebaySummary?.earnings || order.netProfit)}</span>
            </S.EarningsLink>
          </S.SummarySectionSmall>

          <S.AmazonUpdateButton
            variant="secondary"
            size="small"
            fullWidth
            onClick={() => setIsAmazonModalOpen(true)}
          >
            {t('orders.detail.updateAmazon')}
          </S.AmazonUpdateButton>
        </S.SectionCard>
      </S.Grid>

      {/* Net Profit Analysis */}
      <S.AnalysisCard>
        <S.DecorativeBlur $position="top-right" />
        <S.DecorativeBlur $position="bottom-left" />

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
                <span>{formatCurrency(order.details?.ebaySummary?.earnings || order.netProfit)}</span>
                <S.FormulaMinus>-</S.FormulaMinus>
                <span>{formatCurrency(order.purchasePrice)}</span>
              </div>
            </S.Calculation>

            <S.Divider />

            <S.ProfitResult>
              <div className="label">{t('orders.detail.netProfitResult')}</div>
              <div className="value">
                <span>$</span>
                {order.netProfit.toFixed(2)}
                <Icon name="trending-up" size={32} color="semantic.success" />
              </div>
            </S.ProfitResult>

            <S.Roi>
              <div className="label">{t('orders.detail.roi')}</div>
              <div className="value">{calculateRoi(order.netProfit, order.purchasePrice)}</div>
            </S.Roi>
          </S.AnalysisValues>
        </S.AnalysisMetadata>
      </S.AnalysisCard>

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
