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
import { useGetOrderByIdQuery } from '@/features/orders/api/orders.api';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { resolveStoreCurrency } from '@/utils/resolveStoreCurrency';
import { useLocale } from '@/utils/useLocale';

/**
 * The cancellation detail drawer. Reads the request live from eBay when it
 * opens (one Post-Order call, cached by the API) and sends the two answers
 * eBay still lists on it — each behind a confirm dialog, each re-checked by
 * the API against eBay before anything is written.
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

  /* The pending confirm is keyed by the request it was asked for, so a new
     request (or a closed drawer) never inherits the previous one's dialog. */
  const [pending, setPending] = useState<{ id: string; action: EbayCancellationAction } | null>(null);
  const pendingAction = pending && pending.id === cancellationId ? pending.action : null;
  const handleRequestAction = useCallback(
    (action: EbayCancellationAction) => setPending(cancellationId ? { id: cancellationId, action } : null),
    [cancellationId]
  );
  const handleCancelAction = useCallback(() => setPending(null), []);

  const orderId = detail?.row.orderId ?? null;

  /* A decline sends the shipment already pushed to eBay (number AND date — the
     API sends it only when both exist), so the dialog says so only then. The
     order is read only while that dialog is open. */
  const { data: order, isLoading: isOrderLoading } = useGetOrderByIdQuery(orderId ?? '', {
    skip: pendingAction !== EbayCancellationAction.REJECT || !orderId,
  });
  // The decline dialog must not be confirmable before the order answered —
  // its copy would say "no tracking" while the API sends one.
  const isConfirmBusy = isActing || (pendingAction === EbayCancellationAction.REJECT && !!orderId && isOrderLoading);
  const declineTracking =
    order?.ebayTrackingPushedNumber && order.ebayTrackingPushedAt ? order.ebayTrackingPushedNumber : null;

  const confirmDescription = useMemo(() => {
    if (!pendingAction) {
      return '';
    }
    const withTracking = pendingAction === EbayCancellationAction.REJECT && declineTracking;
    return t(`cancellations.confirm.${pendingAction}.${withTracking ? 'bodyWithTracking' : 'body'}`, {
      tracking: declineTracking ?? '',
    });
  }, [pendingAction, declineTracking, t]);

  const handleConfirmAction = useCallback(() => {
    if (!cancellationId || !pending || pending.id !== cancellationId) {
      return;
    }
    const action = pending.action;
    actOnCancellation({ id: cancellationId, action, orderId })
      .unwrap()
      .then(() => {
        setPending(null);
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
        setPending(null);
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
  }, [cancellationId, pending, orderId, actOnCancellation, showMessage, closeMessage, t]);

  const ebayUrl = detail?.ebayUrl ?? null;

  const handleViewOrder = useCallback(() => {
    if (orderId) {
      localeNavigate(`/orders/${orderId}`);
    }
  }, [orderId, localeNavigate]);

  const handleOpenOnEbay = useCallback(() => {
    if (ebayUrl) {
      window.open(ebayUrl, '_blank', 'noopener,noreferrer');
    }
  }, [ebayUrl]);

  return (
    <CancellationDetailDrawerComponent
      isOpen={cancellationId !== null}
      onClose={onClose}
      isLoading={isLoading || (isFetching && !detail)}
      isError={isError}
      detail={detail}
      onViewOrder={orderId ? handleViewOrder : undefined}
      onOpenOnEbay={ebayUrl ? handleOpenOnEbay : undefined}
      onRequestAction={handleRequestAction}
      pendingAction={pendingAction}
      confirmDescription={confirmDescription}
      onConfirmAction={handleConfirmAction}
      onCancelAction={handleCancelAction}
      isActing={isConfirmBusy}
    />
  );
};

CancellationDetailDrawer.displayName = 'CancellationDetailDrawer';
