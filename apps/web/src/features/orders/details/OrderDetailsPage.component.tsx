import { OrderDto } from '@repo/shared';
import { Button, Icon, useLoading } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import * as S from './OrderDetailsPage.style';
import { AmazonDetailsModal } from './components/AmazonDetailsModal';

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
}

export const OrderDetailsPageComponent: React.FC<OrderDetailsPageComponentProps> = ({
  order,
  isLoading,
  isUpdating,
  onUpdateAmazonDetails,
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
    if (cost === 0) return '0.0%';
    return `${((profit / cost) * 100).toFixed(1)}%`;
  };

  return (
    <S.PageWrapper>
      {/* Header */}
      <S.Header>
        <S.TitleWrapper>
          <S.PageTitle>{t('detail.title')}</S.PageTitle>
          <S.Metadata>
            <S.MetadataItem>
              <Icon name="calendar-today" size={16} />
              {t('detail.orderPlaced')}: {formatDate(order.createdAt)}
            </S.MetadataItem>
            <S.Separator>|</S.Separator>
            <S.MetadataItem>
              <Icon name="tag" size={16} />
              {t('table.orderNumber')}: {order.orderNumber}
            </S.MetadataItem>
          </S.Metadata>
        </S.TitleWrapper>
        <S.Actions>
          <Button variant="secondary" size="md">
            <Icon name="receipt" size={18} />
            {t('detail.viewInvoice')}
          </Button>
          <Button
            variant="primary"
            size="md"
            style={{
              boxShadow:
                '0 0.25rem 0.375rem -0.0625rem rgb(59 130 246 / 0.1), 0 0.125rem 0.25rem -0.125rem rgb(59 130 246 / 0.1)',
            }}
          >
            <Icon name="print" size={18} />
            {t('detail.printLabels')}
          </Button>
        </S.Actions>
      </S.Header>

      {/* Product Info Card */}
      <S.Card>
        <S.ProductWrapper>
          <S.ProductImage>
            {order.product?.imageUrl ? (
              <img src={order.product.imageUrl} alt={order.product.title} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Icon name="image" size={48} color="#94a3b8" />
              </div>
            )}
          </S.ProductImage>
          <S.ProductInfo>
            <S.ProductTitle>{order.product?.title || t('detail.unknownProduct')}</S.ProductTitle>
            <S.ProductMetadata>
              <S.Badge $bg="rgba(241, 245, 249, 1)" $color="#334155">
                <span style={{ fontWeight: 600 }}>{t('detail.asin')}</span> {order.product?.asin || '-'}
              </S.Badge>
              <S.Badge $bg="rgba(241, 245, 249, 1)" $color="#334155">
                <span style={{ fontWeight: 600 }}>{t('detail.ebayItemId')}</span> {order.product?.ebayItemId || '-'}
              </S.Badge>
              <S.Badge $bg="rgba(209, 250, 229, 1)" $color="#059669">
                <Icon name="check_circle" size={14} />
                {t(`status.${order.status}`)}
              </S.Badge>
            </S.ProductMetadata>
            <S.LabelValueGroup>
              <S.LabelValue>
                <div className="label">{t('detail.quantity')}</div>
                <div className="value">
                  {order.product?.quantity || 1} {t('detail.unit')}
                </div>
              </S.LabelValue>
              <S.LabelValue>
                <div className="label">{t('detail.sku')}</div>
                <div className="value">{order.product?.sku || t('detail.na')}</div>
              </S.LabelValue>
            </S.LabelValueGroup>
          </S.ProductInfo>
        </S.ProductWrapper>
      </S.Card>

      {/* Main Content Grid */}
      <S.Grid>
        {/* Receiver Info */}
        <S.SectionCard>
          <S.SectionTitle>
            <Icon name="user" size={20} color="#64748b" />
            {t('detail.customerInfo')}
          </S.SectionTitle>
          <S.ContentRow>
            <div className="label">{t('detail.shipTo')}</div>
            <S.BoldText style={{ marginBottom: '0.25rem' }}>{order.buyerName}</S.BoldText>
            {order.shippingAddress && (
              <S.AddressText>
                {order.shippingAddress.street}
                <br />
                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                <br />
                {order.shippingAddress.country}
              </S.AddressText>
            )}
          </S.ContentRow>
          <S.ContentRow>
            <div className="label">{t('detail.contact')}</div>
            <S.AddressText>{order.buyerEmail}</S.AddressText>
            {order.buyerPhone && <S.AddressText>{order.buyerPhone}</S.AddressText>}
          </S.ContentRow>
        </S.SectionCard>

        {/* Purchase Summary */}
        <S.SectionCard>
          <S.SectionTitle>
            <Icon name="shopping_cart" size={20} color="#64748b" />
            {t('detail.buyerPayment')}
          </S.SectionTitle>
          <div style={{ flex: 1 }}>
            <S.SummaryRow>
              <span>{t('detail.itemSubtotal')}:</span>
              <span>{formatCurrency(order.details?.purchaseSummary?.subtotal || order.purchasePrice)}</span>
            </S.SummaryRow>
            <S.SummaryRow>
              <span>{t('detail.shippingHandling')}:</span>
              <span>{formatCurrency(order.details?.purchaseSummary?.shipping || 0)}</span>
            </S.SummaryRow>
            <S.SummaryRow>
              <span>{t('detail.totalBeforeTax')}:</span>
              <span>
                {formatCurrency(
                  (order.details?.purchaseSummary?.subtotal || order.purchasePrice) +
                    (order.details?.purchaseSummary?.shipping || 0)
                )}
              </span>
            </S.SummaryRow>
            <S.SummaryRow>
              <span>{t('detail.estimatedTax')}:</span>
              <span>{formatCurrency(order.details?.purchaseSummary?.tax || 0)}</span>
            </S.SummaryRow>
            <S.SummaryRow $total>
              <span>{t('detail.grandTotal')}:</span>
              <span>{formatCurrency(order.details?.purchaseSummary?.total || order.purchasePrice)}</span>
            </S.SummaryRow>
          </div>
          <S.PaymentMethod>
            {/* Example image for Mastercard as in stitch */}
            <div
              style={{
                width: 40,
                height: 24,
                background: '#f1f5f9',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="payments" size={16} color="#64748b" />
            </div>
            <div>
              <p className="label">{t('detail.paymentMethod')}</p>
              <p className="value">{order.details?.purchaseSummary?.paymentMethod || '-'}</p>
            </div>
          </S.PaymentMethod>
        </S.SectionCard>

        {/* eBay Sales Summary */}
        <S.SectionCard>
          <S.SectionTitle>
            <Icon name="tag" size={20} color="#64748b" />
            {t('detail.ebaySummary', { defaultValue: 'eBay Sales Summary' })}
          </S.SectionTitle>

          <div style={{ marginBottom: '1.5rem' }}>
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: '#94a3b8',
                marginBottom: '0.75rem',
              }}
            >
              {t('detail.whatBuyerPaid')}
            </div>
            <S.SummaryRow>
              <span>{t('detail.subtotal')}</span>
              <span>{formatCurrency(order.details?.ebaySummary?.subtotal || order.salePrice)}</span>
            </S.SummaryRow>
            <S.SummaryRow>
              <span>{t('detail.shipping')}</span>
              <span>{formatCurrency(order.details?.ebaySummary?.shipping || 0)}</span>
            </S.SummaryRow>
            <S.SummaryRow>
              <span>{t('detail.salesTax')}</span>
              <span>{formatCurrency(order.details?.ebaySummary?.tax || 0)}</span>
            </S.SummaryRow>
            <S.SummaryRow $bold style={{ paddingTop: '0.5rem', borderTop: '0.0625rem solid #f1f5f9' }}>
              <span>{t('detail.orderTotal')}</span>
              <span>{formatCurrency(order.details?.ebaySummary?.total || order.salePrice)}</span>
            </S.SummaryRow>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8' }}>
                {t('detail.whatYouEarned')}
              </div>
              <Icon name="chevron-up" size={14} color="#94a3b8" />
            </div>
            <S.SummaryRow $bold>
              <span>{t('detail.orderTotal')}</span>
              <span>{formatCurrency(order.details?.ebaySummary?.total || order.salePrice)}</span>
            </S.SummaryRow>
            <S.FeesSection>
              <div className="fees-label">{t('detail.feesCollected')}</div>
              <S.FeeRow>
                <span>{t('detail.salesTax')}</span>
                <span>-{formatCurrency(order.details?.ebaySummary?.tax || 0)}</span>
              </S.FeeRow>
              <S.FeeRow>
                <span style={{ textDecoration: 'underline dotted', cursor: 'help' }}>
                  {t('detail.transactionFees')}
                </span>
                <span>-{formatCurrency(order.fees?.transactionFee || 0)}</span>
              </S.FeeRow>
              <S.FeeRow>
                <span>{t('detail.adFee')}</span>
                <span>-{formatCurrency(order.fees?.advertisingFee || 0)}</span>
              </S.FeeRow>
            </S.FeesSection>
            <S.EarningsLink>
              <span style={{ textDecoration: 'underline dotted', cursor: 'help' }}>{t('detail.orderEarnings')}</span>
              <span>{formatCurrency(order.details?.ebaySummary?.earnings || order.netProfit)}</span>
            </S.EarningsLink>
          </div>

          <Button
            variant="secondary"
            size="sm"
            fullWidth
            style={{
              marginTop: 'auto',
              background: '#f8fafc',
              color: '#3b82f6',
              fontSize: '0.625rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
            onClick={() => setIsAmazonModalOpen(true)}
          >
            {t('detail.updateAmazon')}
          </Button>
        </S.SectionCard>
      </S.Grid>

      {/* Net Profit Analysis */}
      <S.AnalysisCard>
        <div
          style={{
            position: 'absolute',
            right: -48,
            top: -48,
            width: '12rem',
            height: '12rem',
            background: 'rgba(52, 211, 153, 0.1)',
            borderRadius: '50%',
            filter: 'blur(4rem)',
          }}
        ></div>
        <div
          style={{
            position: 'absolute',
            left: -48,
            bottom: -48,
            width: '12rem',
            height: '12rem',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '50%',
            filter: 'blur(4rem)',
          }}
        ></div>

        <S.AnalysisMetadata>
          <div>
            <S.AnalysisTitle>
              <Icon name="insights" size={24} color="#3b82f6" />
              {t('detail.netProfitAnalysis')}
            </S.AnalysisTitle>
            <p style={{ fontSize: '0.8125rem', color: '#64748b', maxWidth: '27.5rem', lineHeight: 1.5 }}>
              {t('detail.analysisDesc')}
            </p>
          </div>

          <S.AnalysisValues>
            <S.Calculation>
              <div className="label">{t('detail.calculation')}</div>
              <div className="formula">
                <span>{formatCurrency(order.details?.ebaySummary?.earnings || order.netProfit)}</span>
                <span style={{ color: '#cbd5e1' }}>-</span>
                <span>{formatCurrency(order.purchasePrice)}</span>
              </div>
            </S.Calculation>

            <S.Divider />

            <S.ProfitResult>
              <div className="label">{t('detail.netProfitResult')}</div>
              <div className="value">
                <span>$</span>
                {order.netProfit.toFixed(2)}
                <Icon name="trending-up" size={32} color="#10b981" />
              </div>
            </S.ProfitResult>

            <S.Roi>
              <div className="label">{t('detail.roi')}</div>
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
