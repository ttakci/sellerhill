// apps/web/src/features/billing/components/InvoiceHistoryCard/InvoiceHistoryCard.component.tsx
//
// Presentation-only. Allowed hooks: useTranslation. Loading, empty and error
// all render through EmptyState on purpose — using a different component for
// each made the three states look like three different screens.

import type { BillingInvoiceDto } from '@repo/shared';
import { Badge, Button, EmptyState, Table, Text, formatDate, formatMicroCurrency } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './InvoiceHistoryCard.style';
import type { InvoiceHistoryCardProps } from './InvoiceHistoryCard.types';

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
  hasMore,
  isLoadingMore,
  locale,
  onShowMore,
  onRetry,
}: InvoiceHistoryCardProps): React.ReactElement => {
  const { t } = useTranslation(['billing', 'translation']);

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
        <S.TableScroll>
          <Table<BillingInvoiceDto>
            data={invoices}
            columns={[
              {
                key: 'issuedAt',
                header: t('billing:billing.invoices.date'),
                render: (_value, invoice) => (
                  <Text variant="body-sm" numeric>
                    {formatDate(invoice.issuedAt, locale)}
                  </Text>
                ),
              },
              {
                key: 'description',
                header: t('billing:billing.invoices.description'),
                render: (_value, invoice) => (
                  <Text variant="body-sm">{invoice.description ?? '—'}</Text>
                ),
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
        </S.TableScroll>
        {hasMore ? (
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
