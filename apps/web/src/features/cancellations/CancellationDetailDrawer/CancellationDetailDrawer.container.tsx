import { EbayCancellationAction } from '@repo/shared';
import { getLocaleConfig, useUI } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useActOnCancellationMutation, useGetCancellationDetailQuery } from '../api/cancellations.api';
import { toCancellationDetailView } from '../shared/cancellation.mapper';

import { CancellationDetailDrawerComponent } from './CancellationDetailDrawer.component';
import type { CancellationDetailDrawerProps } from './CancellationDetailDrawer.types';

import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { useFollowRecordStore } from '@/features/ebay/hooks/useFollowRecordStore';
import type { OrderCardProps } from '@/features/orders/shared/OrderCard';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { resolveStoreCurrency } from '@/utils/resolveStoreCurrency';
import { useLocale } from '@/utils/useLocale';

const EMPTY_VALUE = '—';

const ANSWERS: readonly string[] = Object.values(EbayCancellationAction);
const isAnswer = (value: string): value is EbayCancellationAction => ANSWERS.includes(value);

/** The answer form of one request — reset whenever another request is opened. */
interface AnswerForm {
  id: string | null;
  choice: EbayCancellationAction | null;
  shipDate: string;
  tracking: string;
  choiceMissing: boolean;
}

const emptyForm = (id: string | null): AnswerForm => ({
  id,
  choice: null,
  shipDate: '',
  tracking: '',
  choiceMissing: false,
});

/**
 * The cancellation detail drawer. Reads the request live from eBay when it opens
 * (one Post-Order call, cached by the API) and sends the answer the seller picks
 * on eBay's own form — accept, or decline with the optional shipment date and
 * tracking number. The API re-checks the request against eBay before writing; a
 * decline sent with neither field falls back to the shipment already pushed to eBay.
 */
export const CancellationDetailDrawer: React.FC<CancellationDetailDrawerProps> = ({ cancellationId, onClose }) => {
  const { t, i18n } = useTranslation(['cancellations', 'translation']);
  const { showMessage, closeMessage } = useUI();
  const { localeNavigate } = useLocale();

  const { data, isLoading, isFetching, isError } = useGetCancellationDetailQuery(cancellationId ?? '', {
    skip: !cancellationId,
    refetchOnMountOrArgChange: true,
  });
  const [actOnCancellation, { isLoading: isActing }] = useActOnCancellationMutation();

  // A request of another store (a shared `?c=` link) makes that store active,
  // keeping the drawer open.
  useFollowRecordStore(data && data.id === cancellationId ? data.ebayAccountId : null);

  const { data: ebayAccountsData } = useGetEbayAccountsQuery();
  const accounts = useMemo(() => ebayAccountsData?.items ?? [], [ebayAccountsData?.items]);
  const locale = useMemo(() => getLocaleConfig(i18n.language).locale, [i18n.language]);

  const detail = useMemo(
    () =>
      data && data.id === cancellationId
        ? toCancellationDetailView(data, {
            translate: (key, options) => t(key, options ?? {}),
            locale,
            currencyFor: (ebayAccountId) => resolveStoreCurrency(accounts, ebayAccountId),
          })
        : null,
    [data, cancellationId, accounts, locale, t]
  );

  const [form, setForm] = useState<AnswerForm>(() => emptyForm(cancellationId));
  if (form.id !== cancellationId) {
    setForm(emptyForm(cancellationId));
  }

  const handleChoiceChange = useCallback(
    (value: string) =>
      setForm((current) => ({ ...current, choice: isAnswer(value) ? value : null, choiceMissing: false })),
    []
  );
  const handleShipDateChange = useCallback((value: string) => setForm((current) => ({ ...current, shipDate: value })), []);
  const handleTrackingChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setForm((current) => ({ ...current, tracking: value }));
    },
    []
  );

  const orderId = detail?.row.orderId ?? null;

  /* The order card's facts and figures — the same card the orders list draws. */
  const orderMeta = useMemo<OrderCardProps['meta']>(() => {
    if (!detail) {
      return [];
    }
    const { row } = detail;
    const facts: OrderCardProps['meta'] = [];
    if (row.ebayOrderId) {
      facts.push({
        label: t('cancellations.detail.orderNo'),
        value: row.ebayOrderId,
        ...(detail.ebayOrderUrl ? { storeType: 'ebay' as const, href: detail.ebayOrderUrl } : {}),
      });
    }
    if (row.buyerLoginName) {
      facts.push({ label: t('cancellations.columns.buyer'), value: row.buyerLoginName });
    }
    if (row.requestedAt) {
      facts.push({ label: t('cancellations.columns.requested'), value: row.requestedAt });
    }
    if (detail.closedAt) {
      facts.push({ label: t('cancellations.detail.closedAt'), value: detail.closedAt });
    }
    if (detail.paymentStatus) {
      facts.push({ label: t('cancellations.detail.paymentStatus'), value: detail.paymentStatus });
    }
    return [...facts, ...row.productMeta.map((m) => ({ label: m.label, value: m.id, storeType: m.storeType }))];
  }, [detail, t]);

  const orderStats = useMemo<OrderCardProps['stats']>(() => {
    if (!detail) {
      return [];
    }
    return [
      { label: t('cancellations.detail.requestedRefund'), value: detail.requestedRefund ?? EMPTY_VALUE },
      ...(detail.actualRefund ? [{ label: t('cancellations.detail.actualRefund'), value: detail.actualRefund }] : []),
      ...(detail.amountOwed
        ? [{ label: t('cancellations.detail.amountOwed'), value: detail.amountOwed, tone: 'negative' as const }]
        : []),
    ];
  }, [detail, t]);

  const handleOpenOrder = useCallback(() => {
    if (orderId) {
      localeNavigate(`/orders/${orderId}`);
    }
  }, [orderId, localeNavigate]);

  const handleSend = useCallback(() => {
    if (!cancellationId) {
      return;
    }
    if (!form.choice) {
      setForm((current) => ({ ...current, choiceMissing: true }));
      return;
    }
    const action = form.choice;
    const tracking = form.tracking.trim();
    const body =
      action === EbayCancellationAction.REJECT
        ? {
            ...(form.shipDate ? { shipmentDate: form.shipDate } : {}),
            ...(tracking ? { trackingNumber: tracking } : {}),
          }
        : undefined;
    actOnCancellation({ id: cancellationId, action, orderId, body })
      .unwrap()
      .then(() => {
        // eBay holds the answer and the API has re-read the request: close the
        // drawer, the list refetches the row with its new state.
        setForm(emptyForm(cancellationId));
        onClose();
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:message.success.header',
            descriptionKey: `cancellations:cancellations.done.${action}`,
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t
        );
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        // The API names WHY as an i18n key (`cancellations.errors.*`): the
        // switch is off, eBay no longer offers it, eBay refused the call…
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(error, 'cancellations:cancellations.errors.unavailable'),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t
        );
      });
  }, [cancellationId, form, orderId, actOnCancellation, onClose, showMessage, closeMessage, t]);

  return (
    <CancellationDetailDrawerComponent
      isOpen={cancellationId !== null}
      onClose={onClose}
      isLoading={isLoading || (isFetching && !detail)}
      isError={isError}
      detail={detail}
      locale={locale}
      choice={form.choice}
      onChoiceChange={handleChoiceChange}
      shipDate={form.shipDate}
      onShipDateChange={handleShipDateChange}
      tracking={form.tracking}
      onTrackingChange={handleTrackingChange}
      choiceMissing={form.choiceMissing}
      onSend={handleSend}
      isActing={isActing}
      orderMeta={orderMeta}
      orderStats={orderStats}
      onOpenOrder={orderId ? handleOpenOrder : undefined}
    />
  );
};

CancellationDetailDrawer.displayName = 'CancellationDetailDrawer';
