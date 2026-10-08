import { CancellationBucket, ORDER_NOTE_MAX_LENGTH, OrderStage } from '@repo/shared';
import {
  formatCurrency,
  formatDate,
  formatPercent,
  formatPhoneNumber,
  getLocaleConfig,
  useLoading,
  useUI,
} from '@repo/ui';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import {
  useGetOrderByIdQuery,
  useUpdateOrderAmazonDetailsMutation,
  useUpdateOrderNoteMutation,
} from '../api/orders.api';
import {
  isShipByUrgent,
  orderStageHasAction,
  orderStageHasDeadline,
  orderStageShowsReason,
} from '../shared/order-stage';
import { toOrderTimelineRows } from '../shared/order-timeline';

import { OrderDetailsPageComponent } from './OrderDetailsPage.component';

import {
  useConfirmNotPurchasedMutation,
  useConvertOrderTrackingMutation,
  useStartAutoFulfillMutation,
} from '@/features/amazon/api/amazon.api';
import { LinkAmazonModal } from '@/features/amazon/components/LinkAmazonModal';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { useFollowRecordStore } from '@/features/ebay/hooks/useFollowRecordStore';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { resolveStoreCurrency } from '@/utils/resolveStoreCurrency';
import { useLocale } from '@/utils/useLocale';

export const OrderDetailsPageContainer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation(['orders', 'translation']);
  const { localeNavigate } = useLocale();
  const { showMessage, closeMessage } = useUI();
  const [isLinkModalOpen, setIsLinkModalOpen] = React.useState(false);

  const {
    data: order,
    isLoading,
    refetch,
  } = useGetOrderByIdQuery(id || '', {
    skip: !id,
  });

  const { data: ebayAccountsData } = useGetEbayAccountsQuery();

  const [, { isLoading: isUpdating }] = useUpdateOrderAmazonDetailsMutation();
  const [convertTracking, { isLoading: isConvertingTracking }] = useConvertOrderTrackingMutation();
  const [startAutoFulfill, { isLoading: isStartingAutoFulfill }] = useStartAutoFulfillMutation();
  const [confirmNotPurchased, { isLoading: isConfirmingNotPurchased }] = useConfirmNotPurchasedMutation();

  const [updateNote, { isLoading: isSavingNote }] = useUpdateOrderNoteMutation();

  useLoading(isUpdating);

  /*
   * The seller's own note. The field is a draft; it adopts the saved text
   * whenever that changes (first load, or the refetch after a save), and Save
   * is offered only while the two differ.
   */
  const savedNote = order?.sellerNote ?? '';
  const [noteDraft, setNoteDraft] = useState(savedNote);
  const noteSource = `${order?.id ?? ''}:${savedNote}`;
  const [noteSyncedFrom, setNoteSyncedFrom] = useState(noteSource);
  if (noteSyncedFrom !== noteSource) {
    setNoteSyncedFrom(noteSource);
    setNoteDraft(savedNote);
  }
  const isNoteDirty = noteDraft.trim() !== savedNote;

  const handleNoteChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNoteDraft(e.target.value);
  }, []);

  const localeCfg = useMemo(() => getLocaleConfig(i18n.language), [i18n.language]);

  // An order of another store makes that store active (top bar).
  useFollowRecordStore(order?.ebayAccountId);

  /* Money renders in the connected eBay store's marketplace currency this
     order belongs to, never the UI language. */
  const currency = useMemo(
    () => resolveStoreCurrency(ebayAccountsData?.items ?? [], order?.ebayAccountId),
    [ebayAccountsData, order?.ebayAccountId]
  );
  /* Always two decimals — a page about money must never print "$9,8". */
  const fmtCurrency = useCallback(
    (value: number) => formatCurrency(value, localeCfg.locale, currency, 2),
    [localeCfg, currency]
  );

  const fmtDate = useCallback(
    (dateString: string) =>
      formatDate(dateString, localeCfg.locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [localeCfg]
  );

  const statusLabel = useMemo(() => {
    if (!order) {
      return '';
    }
    const key = `orders.status.${order.status}`;
    const translated = t(key);
    return translated === key ? order.status : translated;
  }, [order, t]);

  const stageAction = useMemo(() => {
    if (!order) {
      return null;
    }
    // "Cancelled" is a finished stage with nothing to do — except when a real
    // Amazon order was already placed for the sale and Amazon has not reported
    // it cancelled. The platform never cancels an Amazon order, so say so.
    if (
      order.stage === OrderStage.CANCELLED &&
      order.amazonOrderId &&
      !order.isSimulated &&
      !order.amazonCancelledAt
    ) {
      return t('orders.detail.cancelledAmazonOpenAction');
    }
    return orderStageHasAction(order.stage) ? t(`orders.stage.${order.stage}.action`) : null;
  }, [order, t]);

  /*
   * The step-by-step timeline. The step the order is standing on explains
   * itself with the stage's own sentence, the action and — where the stage
   * shows one — why the automatic purchase stopped. Once the seller linked the
   * order by hand the stage moves on, so a stale "Reason: address" never
   * lingers under a later step.
   */
  const timelineRows = useMemo(() => {
    if (!order) {
      return [];
    }
    const reasonLabel =
      orderStageShowsReason(order.stage) && order.autoFulfillBlockedReason
        ? t('orders.autoFulfill.reasonLabel', {
            reason: t(`orders.autoFulfill.reason.${order.autoFulfillBlockedReason}`),
          })
        : null;
    return toOrderTimelineRows(order.timeline, {
      t,
      formatDate: fmtDate,
      stage: order.stage,
      shippedDetectedAt: order.shippedDetectedAt,
      stageAction,
      reasonLabel,
      now: new Date(),
    });
  }, [order, t, fmtDate, stageAction]);

  const totalAmazonCost = useMemo(() => {
    if (!order) {
      return 0;
    }
    return order.purchasePrice + (order.amazonTax || 0) + (order.amazonShipping || 0);
  }, [order]);

  const amazonTotalBeforeTax = useMemo(() => {
    if (!order) {
      return 0;
    }
    return order.purchasePrice + (order.amazonShipping || 0);
  }, [order]);

  const buyerPhoneDisplay = useMemo(() => {
    if (!order?.buyerPhone) {
      return null;
    }
    return formatPhoneNumber(order.buyerPhone, order.shippingAddress?.country) || null;
  }, [order]);

  const roiLabel = useMemo(() => {
    if (!order || totalAmazonCost === 0) {
      return formatPercent(0, localeCfg.locale, 1);
    }
    return formatPercent(order.netProfit / totalAmazonCost, localeCfg.locale, 1);
  }, [order, totalAmazonCost, localeCfg]);

  /* Net margin on the sale — the figure a seller compares across orders. */
  const marginLabel = useMemo(() => {
    if (!order || order.salePrice <= 0) {
      return null;
    }
    return formatPercent(order.netProfit / order.salePrice, localeCfg.locale, 1);
  }, [order, localeCfg]);

  /* "Manage cancellation" only while the buyer's request waits for the
     seller's answer; a request already answered or closed needs nothing, and
     the cancellation card keeps showing it. */
  const canManageCancellation =
    order?.cancellation?.bucket === CancellationBucket.ACTION_DUE ||
    order?.cancellation?.bucket === CancellationBucket.ACTION_OVERDUE;

  /*
   * Offer the action only when it can actually do something:
   *   - the order is linked to one of our listings, without which a converted
   *     number could never be pushed to eBay (the fulfillment needs the
   *     listing's eBay item id as its line item);
   *   - Amazon has given us a number to convert;
   *   - it has not already been converted, since a conversion is paid for
   *     and buying a second one for the same shipment is pure loss;
   *   - and nothing has been pushed to eBay yet — the Fulfillment API has no
   *     update endpoint, so a converted number bought after the push would
   *     never reach the buyer. An offered action that then refuses is worse
   *     than no action at all, so this mirrors `shouldRefuseOnDemandConversion`
   *     on the server rather than letting the two drift.
   * The server refuses all four independently — this only keeps a button that
   * would decline out of the seller's way.
   */
  const canConvertTracking = Boolean(
    order?.isTracked && order.amazonTrackingNumber && !order.convertedTrackingNumber && !order.ebayTrackingPushedNumber
  );

  const handleConvertTracking = useCallback(() => {
    if (!id) {
      return;
    }
    convertTracking({ orderId: id })
      .unwrap()
      .then((result) => {
        // `converted: false` is a normal outcome, not a failure — the quota may
        // be spent, or the provider unavailable. The backend names the reason
        // as an i18n key so the seller reads WHY instead of "an error occurred".
        showMessage(
          {
            type: result.converted ? 'success' : 'info',
            headerKey: result.converted ? 'translation:message.success.header' : 'translation:message.info.header',
            descriptionKey: result.converted
              ? 'orders:orders.errors.conversionDone'
              : `orders:${result.reasonKey ?? 'orders.errors.conversionUnavailable'}`,
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t
        );
        void refetch();
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(error),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t
        );
      });
  }, [id, convertTracking, showMessage, closeMessage, t, refetch]);

  /*
   * "Start automatic order": re-arms a purchase that stopped before anything
   * was bought (card declined at the payment step, address, stock, captcha…).
   * Offered only while the server says so (`canStartAutoFulfill`, computed by
   * the same rule the endpoint enforces). It spends real money, so it asks
   * first; the answer says whether the chosen account is in test mode.
   */
  const canStartAutoFulfill = Boolean(order?.canStartAutoFulfill);

  const runStartAutoFulfill = useCallback(() => {
    if (!id) {
      return;
    }
    closeMessage();
    startAutoFulfill({ orderId: id })
      .unwrap()
      .then((result) => {
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:message.success.header',
            descriptionKey: result.dryRun
              ? 'orders:orders.autoFulfill.start.queuedDryRun'
              : 'orders:orders.autoFulfill.start.queued',
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t
        );
        void refetch();
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(error),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t
        );
        void refetch();
      });
  }, [id, startAutoFulfill, showMessage, closeMessage, t, refetch]);

  const handleStartAutoFulfill = useCallback(() => {
    showMessage(
      {
        type: 'warning',
        headerKey: 'orders:orders.autoFulfill.start.confirmTitle',
        descriptionKey: 'orders:orders.autoFulfill.start.confirmDescription',
        primaryButton: { labelKey: 'orders:orders.autoFulfill.start.confirm', onClick: runStartAutoFulfill },
        secondaryButton: { labelKey: 'translation:common.cancel', onClick: closeMessage },
      },
      t
    );
  }, [showMessage, closeMessage, runStartAutoFulfill, t]);

  /*
   * "It is not on Amazon": the seller declares that an automatic purchase whose
   * outcome is unknown did not happen, which brings the automatic order back.
   * The server holds the real rule — it refuses until it has scanned the Amazon
   * account's orders after the click — so this only asks, in words that say
   * what is being asserted, and shows the answer.
   */
  const canConfirmNotPurchased = order?.stage === OrderStage.PURCHASE_UNKNOWN;

  const runConfirmNotPurchased = useCallback(() => {
    if (!id) {
      return;
    }
    closeMessage();
    confirmNotPurchased({ orderId: id })
      .unwrap()
      .then(() => {
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:message.success.header',
            descriptionKey: 'orders:orders.autoFulfill.notPurchased.done',
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t
        );
        void refetch();
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(error),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t
        );
        void refetch();
      });
  }, [id, confirmNotPurchased, showMessage, closeMessage, t, refetch]);

  const handleConfirmNotPurchased = useCallback(() => {
    showMessage(
      {
        type: 'warning',
        headerKey: 'orders:orders.autoFulfill.notPurchased.confirmTitle',
        descriptionKey: 'orders:orders.autoFulfill.notPurchased.confirmDescription',
        primaryButton: { labelKey: 'orders:orders.autoFulfill.notPurchased.confirm', onClick: runConfirmNotPurchased },
        secondaryButton: { labelKey: 'translation:common.cancel', onClick: closeMessage },
      },
      t
    );
  }, [showMessage, closeMessage, runConfirmNotPurchased, t]);

  /* Escape restores the saved text and then blurs; the blur runs before the
     restored draft re-renders, so it must not save the stale one. */
  const skipNoteSaveRef = useRef(false);

  const handleSaveNote = useCallback(() => {
    if (skipNoteSaveRef.current) {
      skipNoteSaveRef.current = false;
      return;
    }
    if (!id || !isNoteDirty) {
      return;
    }
    updateNote({ id, note: noteDraft.trim() || null })
      .unwrap()
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(error),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t
        );
      });
  }, [id, isNoteDirty, noteDraft, updateNote, showMessage, closeMessage, t]);

  const handleNoteKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.currentTarget.blur();
      } else if (e.key === 'Escape') {
        skipNoteSaveRef.current = true;
        setNoteDraft(savedNote);
        e.currentTarget.blur();
      }
    },
    [savedNote]
  );

  /* The answers (accept / decline) live on the Cancellations page, one place per action. */
  const cancellationId = order?.cancellation?.id;
  const handleManageCancellation = useCallback(() => {
    if (cancellationId) {
      localeNavigate(`/cancellations?c=${encodeURIComponent(cancellationId)}`);
    }
  }, [cancellationId, localeNavigate]);

  /* eBay's ship-by date is shown while the seller still has something to do. */
  const shipBy = useMemo(() => {
    if (!order?.shipByDate || !orderStageHasDeadline(order.stage)) {
      return { label: null, urgent: false };
    }
    return { label: fmtDate(order.shipByDate), urgent: isShipByUrgent(order.shipByDate, new Date()) };
  }, [order, fmtDate]);

  const multiItemCount = order?.lineItemCount && order.lineItemCount > 1 ? order.lineItemCount : null;

  const handleBack = () => {
    localeNavigate('/orders');
  };

  const handleLinked = () => {
    void refetch();
  };

  return (
    <>
      <OrderDetailsPageComponent
        order={order}
        isLoading={isLoading}
        isUpdating={isUpdating}
        formatCurrency={fmtCurrency}
        formatDate={fmtDate}
        statusLabel={statusLabel}
        timelineRows={timelineRows}
        roiLabel={roiLabel}
        marginLabel={marginLabel}
        totalAmazonCost={totalAmazonCost}
        amazonTotalBeforeTax={amazonTotalBeforeTax}
        buyerPhoneDisplay={buyerPhoneDisplay}
        onBack={handleBack}
        onOpenLinkAmazon={() => setIsLinkModalOpen(true)}
        onOpenAmazonOrderUrl={
          order?.amazonOrderUrl ? () => window.open(order.amazonOrderUrl, '_blank', 'noopener,noreferrer') : undefined
        }
        canManageCancellation={canManageCancellation}
        canConvertTracking={canConvertTracking}
        isConvertingTracking={isConvertingTracking}
        onConvertTracking={handleConvertTracking}
        canStartAutoFulfill={canStartAutoFulfill}
        isStartingAutoFulfill={isStartingAutoFulfill}
        onStartAutoFulfill={handleStartAutoFulfill}
        canConfirmNotPurchased={canConfirmNotPurchased}
        isConfirmingNotPurchased={isConfirmingNotPurchased}
        onConfirmNotPurchased={handleConfirmNotPurchased}
        shipByLabel={shipBy.label}
        isShipByUrgent={shipBy.urgent}
        multiItemCount={multiItemCount}
        noteDraft={noteDraft}
        noteMaxLength={ORDER_NOTE_MAX_LENGTH}
        isSavingNote={isSavingNote}
        onNoteChange={handleNoteChange}
        onNoteBlur={handleSaveNote}
        onNoteKeyDown={handleNoteKeyDown}
        onManageCancellation={handleManageCancellation}
      />
      {id && (
        <LinkAmazonModal
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          orderId={id}
          hasListing={Boolean(order?.product)}
          onLinked={handleLinked}
        />
      )}
    </>
  );
};
