import {
  EbayReturnAction,
  isEbayReturnAction,
  isReturnLabelCarrier,
  RETURN_LABEL_MAX_BYTES,
  RETURN_LABEL_MIME_TYPES,
  ReturnLabelCarrier,
} from '@repo/shared';
import { getLocaleConfig, useUI, type SelectOption } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useActOnReturnMutation, useGetReturnDetailQuery } from '../api/returns.api';
import { toReturnDetailView } from '../shared/return-detail.mapper';

import { ReturnDetailDrawerComponent } from './ReturnDetailDrawer.component';
import type { ReturnChoiceView, ReturnDetailDrawerProps, ReturnLabelErrors } from './ReturnDetailDrawer.types';

import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { useFollowRecordStore } from '@/features/ebay/hooks/useFollowRecordStore';
import type { OrderCardProps } from '@/features/orders/shared/OrderCard';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { resolveStoreCurrency } from '@/utils/resolveStoreCurrency';
import { useLocale } from '@/utils/useLocale';

const EMPTY_VALUE = '—';

const NO_LABEL_ERRORS: ReturnLabelErrors = { file: null, carrier: null, carrierName: null, tracking: null };

/** The answer form of one return — reset whenever another return is opened. */
interface AnswerForm {
  id: string | null;
  choice: EbayReturnAction | null;
  file: File | null;
  carrier: ReturnLabelCarrier | null;
  carrierName: string;
  tracking: string;
  /** Send was pressed — empty or wrong label fields turn red from then on. */
  submitAttempted: boolean;
}

const emptyForm = (id: string | null): AnswerForm => ({
  id,
  choice: null,
  file: null,
  carrier: null,
  carrierName: '',
  tracking: '',
  submitAttempted: false,
});

/**
 * The return detail drawer, in the cancellation drawer's format. Reads the
 * return LIVE from eBay when it opens (one Post-Order call) and offers the
 * in-app actions eBay lists on it as radios; Send runs the one picked. The API
 * re-checks the return against eBay before writing, then re-reads it, so on
 * success the drawer closes and the list shows the new state.
 */
export const ReturnDetailDrawer: React.FC<ReturnDetailDrawerProps> = ({ returnId, onClose }) => {
  const { t, i18n } = useTranslation(['returns', 'translation']);
  const { showMessage, closeMessage } = useUI();
  const { localeNavigate } = useLocale();

  const { data, isLoading, isFetching, isError } = useGetReturnDetailQuery(returnId ?? '', {
    skip: !returnId,
    refetchOnMountOrArgChange: true,
  });
  const [actOnReturn, { isLoading: isActing }] = useActOnReturnMutation();

  // A return of another store (a shared `?r=` link) makes that store active,
  // keeping the drawer open.
  useFollowRecordStore(data && data.id === returnId ? data.ebayAccountId : null);

  const { data: ebayAccountsData } = useGetEbayAccountsQuery();
  const accounts = useMemo(() => ebayAccountsData?.items ?? [], [ebayAccountsData?.items]);
  const locale = useMemo(() => getLocaleConfig(i18n.language).locale, [i18n.language]);

  const detail = useMemo(
    () =>
      data && data.id === returnId
        ? toReturnDetailView(data, {
            translate: (key, options) => t(key, options ?? {}),
            locale,
            currencyFor: (ebayAccountId) => resolveStoreCurrency(accounts, ebayAccountId),
          })
        : null,
    [data, returnId, accounts, locale, t]
  );

  const [form, setForm] = useState<AnswerForm>(() => emptyForm(returnId));
  if (form.id !== returnId) {
    setForm(emptyForm(returnId));
  }

  const choices = useMemo<ReturnChoiceView[]>(() => {
    if (!detail) {
      return [];
    }
    const { actions, refundToIssue } = detail;
    return actions.map((action) => ({
      action,
      label:
        action === EbayReturnAction.ISSUE_REFUND && refundToIssue
          ? t('returns.form.choiceWithAmount.issue_refund', { amount: refundToIssue })
          : t(`returns.form.choice.${action}`),
    }));
  }, [detail, t]);

  const carrierOptions = useMemo<SelectOption[]>(
    () => Object.values(ReturnLabelCarrier).map((value) => ({ value, label: t(`returns.carrier.${value}`) })),
    [t]
  );

  /* The label fields mirror the API's own check (validateReturnActionInput),
     so a refusal there means eBay's side, not a field the seller can fix. */
  const labelErrors = useMemo<ReturnLabelErrors>(() => {
    if (!form.submitAttempted || form.choice !== EbayReturnAction.PROVIDE_LABEL) {
      return NO_LABEL_ERRORS;
    }
    const { file } = form;
    return {
      file: !file
        ? t('returns.errors.labelFileRequired')
        : file.size > RETURN_LABEL_MAX_BYTES || !RETURN_LABEL_MIME_TYPES.includes(file.type)
          ? t('returns.errors.labelFileInvalid')
          : null,
      carrier: form.carrier ? null : t('returns.form.carrierRequired'),
      carrierName:
        form.carrier === ReturnLabelCarrier.OTHER && form.carrierName.trim() === ''
          ? t('returns.form.carrierNameRequired')
          : null,
      tracking: form.tracking.trim() === '' ? t('returns.form.trackingRequired') : null,
    };
  }, [form, t]);

  const handleChoiceChange = useCallback(
    (value: string) =>
      setForm((current) => ({ ...current, choice: isEbayReturnAction(value) ? value : null, submitAttempted: false })),
    []
  );
  const handleLabelFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setForm((current) => ({ ...current, file }));
  }, []);
  const handleCarrierChange = useCallback(
    (value: string | number) =>
      setForm((current) => ({ ...current, carrier: isReturnLabelCarrier(value) ? value : null })),
    []
  );
  const handleCarrierNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, carrierName: value }));
  }, []);
  const handleTrackingChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, tracking: value }));
  }, []);

  const orderId = detail?.row.orderId ?? null;

  /* The order card's facts and figures — the same card the orders list draws. */
  const orderMeta = useMemo<OrderCardProps['meta']>(() => {
    if (!detail) {
      return [];
    }
    const { row } = detail;
    const facts: OrderCardProps['meta'] = [];
    if (row.ebayOrderId) {
      facts.push({ label: t('returns.order'), value: row.ebayOrderId });
    }
    if (detail.buyerLoginName) {
      facts.push({ label: t('returns.detail.buyer'), value: detail.buyerLoginName });
    }
    if (detail.quantity !== null) {
      facts.push({ label: t('returns.detail.quantity'), value: String(detail.quantity) });
    }
    if (detail.returnTypeLabel) {
      facts.push({ label: t('returns.detail.returnType'), value: detail.returnTypeLabel });
    }
    if (row.openedAt) {
      facts.push({ label: t('returns.columns.opened'), value: row.openedAt });
    }
    if (detail.closeReasonLabel) {
      facts.push({ label: t('returns.detail.closedAs'), value: detail.closeReasonLabel });
    }
    if (detail.closedAt) {
      facts.push({ label: t('returns.detail.closedAt'), value: detail.closedAt });
    }
    return [...facts, ...row.productMeta.map((m) => ({ label: m.label, value: m.id, storeType: m.storeType }))];
  }, [detail, t]);

  const orderStats = useMemo<OrderCardProps['stats']>(() => {
    if (!detail) {
      return [];
    }
    return [
      { label: t('returns.detail.itemPrice'), value: detail.itemPrice ?? EMPTY_VALUE },
      { label: t('returns.refund.estimated'), value: detail.estimatedRefund ?? EMPTY_VALUE },
      ...(detail.actualRefund
        ? [{ label: t('returns.refund.refunded'), value: detail.actualRefund, tone: 'negative' as const }]
        : []),
    ];
  }, [detail, t]);

  const handleOpenOrder = useCallback(() => {
    if (orderId) {
      localeNavigate(`/orders/${orderId}`);
    }
  }, [orderId, localeNavigate]);

  const handleSend = useCallback(() => {
    if (!returnId) {
      return;
    }
    setForm((current) => ({ ...current, submitAttempted: true }));
    const action = form.choice;
    if (!action) {
      return;
    }
    let body: FormData | undefined;
    if (action === EbayReturnAction.PROVIDE_LABEL) {
      const { file, carrier } = form;
      const tracking = form.tracking.trim();
      const carrierName = form.carrierName.trim();
      const invalid =
        !file ||
        file.size > RETURN_LABEL_MAX_BYTES ||
        !RETURN_LABEL_MIME_TYPES.includes(file.type) ||
        !carrier ||
        (carrier === ReturnLabelCarrier.OTHER && carrierName === '') ||
        tracking === '';
      if (invalid) {
        return;
      }
      body = new FormData();
      body.append('labelFile', file);
      body.append('carrier', carrier);
      if (carrier === ReturnLabelCarrier.OTHER) {
        body.append('carrierName', carrierName);
      }
      body.append('trackingNumber', tracking);
    }
    actOnReturn({ id: returnId, action, body })
      .unwrap()
      .then(() => {
        // eBay holds the answer and the API has re-read the return: close the
        // drawer, the list refetches the row with its new state.
        setForm(emptyForm(returnId));
        onClose();
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:message.success.header',
            descriptionKey: `returns:returns.actions.done.${action}`,
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t
        );
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        // The API names WHY as an i18n key (`returns.errors.*`): eBay no longer
        // lists the option, the account is suspended, eBay refused the call…
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(error, 'returns:returns.errors.unavailable'),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t
        );
      });
  }, [returnId, form, actOnReturn, onClose, showMessage, closeMessage, t]);

  return (
    <ReturnDetailDrawerComponent
      isOpen={returnId !== null}
      onClose={onClose}
      isLoading={isLoading || (isFetching && !detail)}
      isError={isError}
      detail={detail}
      choices={choices}
      choice={form.choice}
      onChoiceChange={handleChoiceChange}
      choiceMissing={form.submitAttempted && form.choice === null}
      labelFileName={form.file?.name ?? ''}
      onLabelFileChange={handleLabelFileChange}
      carrier={form.carrier}
      carrierOptions={carrierOptions}
      onCarrierChange={handleCarrierChange}
      carrierName={form.carrierName}
      onCarrierNameChange={handleCarrierNameChange}
      tracking={form.tracking}
      onTrackingChange={handleTrackingChange}
      labelErrors={labelErrors}
      onSend={handleSend}
      isActing={isActing}
      orderMeta={orderMeta}
      orderStats={orderStats}
      onOpenOrder={orderId ? handleOpenOrder : undefined}
    />
  );
};

ReturnDetailDrawer.displayName = 'ReturnDetailDrawer';
