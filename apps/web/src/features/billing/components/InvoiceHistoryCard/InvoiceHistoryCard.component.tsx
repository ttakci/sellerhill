// apps/web/src/features/billing/components/InvoiceHistoryCard/InvoiceHistoryCard.component.tsx
//
// Presentation-only. Allowed hooks: useTranslation. Loading, empty and error
// all render through EmptyState on purpose — using a different component for
// each made the three states look like three different screens.

import type { BillingInvoiceDto } from '@repo/shared';
import { Badge, Button, DataTable, EmptyState, InfoMessage, Text, formatDate, formatMicroCurrency } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './InvoiceHistoryCard.style';
import type { InvoiceHistoryCardProps } from './InvoiceHistoryCard.types';

/**
 * `issuedAt` must render as the calendar date Stripe assigned at creation
 * (`new Date(raw.created * 1000).toISOString()` in `stripe-invoice-mapper.ts`),
 * matching what Stripe's own hosted invoice/portal page shows — never the
 * viewer's local day. Without an explicit `timeZone`, `Intl.DateTimeFormat`
 * (inside `formatDate`) falls back to the browser's local timezone, so an
 * invoice created close to UTC midnight silently rolled onto the next local
 * day here while Stripe kept showing the UTC date — observed live: three
 * invoices created within the same session all rendered "22 Ağu" in this
 * card even though Stripe's own portal showed 22/21/21.
 */
const INVOICE_DATE_OPTIONS: Intl.DateTimeFormatOptions = { timeZone: 'UTC' };

/** Stripe invoice status → Badge variant. Pure, module scope, no hook deps. */
function statusVariant(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'paid':
      return 'success';
    case 'open':
      return 'warning';
    case 'uncollectible':
    case 'void':
      return 'error';
    default:
      return 'neutral';
  }
}

export const InvoiceHistoryCard = ({
  invoices,
  isLoading,
  isError,
  hasLoadMoreError,
  hasMore,
  isLoadingMore,
  locale,
  onShowMore,
  onRetry,
}: InvoiceHistoryCardProps): React.ReactElement => {
  const { t } = useTranslation(['billing', 'translation']);

  const renderGridCard = (invoice: BillingInvoiceDto): React.ReactElement => (
    <S.InvoiceGridCard key={invoice.id} variant="bordered">
      <S.InvoiceCardHeader>
        <Text variant="body-sm" weight="semibold" numeric>
          {formatDate(invoice.issuedAt, locale, INVOICE_DATE_OPTIONS)}
        </Text>
        <Badge variant={statusVariant(invoice.status)} size="sm" isPill>
          {t(`billing:billing.invoices.statusLabel.${invoice.status}`, {
            defaultValue: invoice.status,
          })}
        </Badge>
      </S.InvoiceCardHeader>
      <S.InvoiceCardBody>
        <Text variant="body-sm" color="text.secondary">
          {invoice.description ?? '—'}
        </Text>
        <Text variant="metric-sm" weight="semibold" numeric>
          {formatMicroCurrency(invoice.amountMicros, locale, invoice.currency)}
        </Text>
      </S.InvoiceCardBody>
      <S.InvoiceCardFooter>
        {invoice.status !== 'paid' && invoice.hostedUrl ? (
          <Button
            variant="secondary"
            size="small"
            onClick={() => window.open(invoice.hostedUrl ?? '', '_blank', 'noopener')}
          >
            <Text variant="body-sm">{t('billing:billing.invoices.payNow')}</Text>
          </Button>
        ) : null}
        {invoice.pdfUrl ? (
          <Button variant="text" size="small" onClick={() => window.open(invoice.pdfUrl ?? '', '_blank', 'noopener')}>
            <Text variant="body-sm">{t('billing:billing.invoices.download')}</Text>
          </Button>
        ) : null}
      </S.InvoiceCardFooter>
    </S.InvoiceGridCard>
  );

  const body = (() => {
    if (isError) {
      return (
        <EmptyState
          icon="alert-triangle"
          title={t('billing:billing.invoices.error')}
          description={t('billing:billing.invoices.errorDescription')}
          action={t('billing:billing.invoices.retry')}
          onAction={onRetry}
        />
      );
    }
    if (isLoading) {
      return (
        <EmptyState
          icon="receipt-text"
          title={t('billing:billing.invoices.loading')}
          description={t('billing:billing.invoices.loadingDescription')}
        />
      );
    }
    if (invoices.length === 0) {
      return (
        <EmptyState
          icon="receipt-text"
          title={t('billing:billing.invoices.empty')}
          description={t('billing:billing.invoices.emptyDescription')}
        />
      );
    }
    return (
      <>
        <DataTable<BillingInvoiceDto>
          data={invoices}
          renderGridCard={renderGridCard}
          gridMinItemWidth="18rem"
          defaultViewMode="grid"
          columns={[
            {
              key: 'issuedAt',
              header: t('billing:billing.invoices.date'),
              render: (_value, invoice) => (
                <Text variant="body-sm" numeric>
                  {formatDate(invoice.issuedAt, locale, INVOICE_DATE_OPTIONS)}
                </Text>
              ),
            },
            {
              key: 'description',
              header: t('billing:billing.invoices.description'),
              render: (_value, invoice) => <Text variant="body-sm">{invoice.description ?? '—'}</Text>,
            },
            {
              key: 'amount',
              header: t('billing:billing.invoices.amount'),
              align: 'right',
              render: (_value, invoice) => (
                <Text variant="body-sm" numeric>
                  {formatMicroCurrency(invoice.amountMicros, locale, invoice.currency)}
                </Text>
              ),
            },
            {
              key: 'status',
              header: t('billing:billing.invoices.status'),
              render: (_value, invoice) => (
                <Badge variant={statusVariant(invoice.status)} size="sm" isPill>
                  {t(`billing:billing.invoices.statusLabel.${invoice.status}`, {
                    defaultValue: invoice.status,
                  })}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: t('billing:billing.invoices.pdf'),
              align: 'right',
              render: (_value, invoice) => (
                <S.RowActions>
                  {invoice.status !== 'paid' && invoice.hostedUrl ? (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => window.open(invoice.hostedUrl ?? '', '_blank', 'noopener')}
                    >
                      <Text variant="body-sm">{t('billing:billing.invoices.payNow')}</Text>
                    </Button>
                  ) : null}
                  {invoice.pdfUrl ? (
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => window.open(invoice.pdfUrl ?? '', '_blank', 'noopener')}
                    >
                      <Text variant="body-sm">{t('billing:billing.invoices.download')}</Text>
                    </Button>
                  ) : null}
                </S.RowActions>
              ),
            },
          ]}
        />
        {hasLoadMoreError ? (
          <S.LoadMoreErrorRow>
            <InfoMessage
              action={t('billing:billing.invoices.retry')}
              onAction={onRetry}
              isActionLoading={isLoadingMore}
            >
              {t('billing:billing.invoices.showMoreError')}
            </InfoMessage>
          </S.LoadMoreErrorRow>
        ) : hasMore ? (
          <S.MoreRow>
            <Button variant="secondary" size="small" isLoading={isLoadingMore} onClick={onShowMore}>
              <Text variant="body-sm">{t('billing:billing.invoices.showMore')}</Text>
            </Button>
          </S.MoreRow>
        ) : null}
      </>
    );
  })();

  return (
    <S.Card
      variant="section"
      header={{
        title: t('billing:billing.invoices.title'),
        subtitle: t('billing:billing.invoices.subtitle'),
      }}
    >
      {body}
    </S.Card>
  );
};

InvoiceHistoryCard.displayName = 'InvoiceHistoryCard';
