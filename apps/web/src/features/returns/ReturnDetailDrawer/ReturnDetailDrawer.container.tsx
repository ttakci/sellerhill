import { type EbayReturnAction } from '@repo/shared';
import { getLocaleConfig, useUI } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useActOnReturnMutation, useGetReturnDetailQuery } from '../api/returns.api';
import { toReturnDetailView } from '../shared/return-detail.mapper';

import { ReturnDetailDrawerComponent } from './ReturnDetailDrawer.component';
import type { ReturnDetailDrawerProps } from './ReturnDetailDrawer.types';

import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { resolveStoreCurrency } from '@/utils/resolveStoreCurrency';
import { useLocale } from '@/utils/useLocale';

/**
 * The return detail drawer. Reads the return LIVE from eBay when it opens
 * (one Post-Order call) and runs the in-app actions eBay lists on it — each
 * behind a confirm dialog, each answered by the API's own re-read.
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

  /* The pending confirm is keyed by the return it was asked for, so a new
     return (or a closed drawer) never inherits the previous one's dialog. */
  const [pending, setPending] = useState<{ id: string; action: EbayReturnAction } | null>(null);
  const pendingAction = pending && pending.id === returnId ? pending.action : null;
  const handleRequestAction = useCallback(
    (action: EbayReturnAction) => setPending(returnId ? { id: returnId, action } : null),
    [returnId]
  );
  const handleCancelAction = useCallback(() => setPending(null), []);

  const confirmDescription = useMemo(() => {
    if (!pendingAction) {
      return '';
    }
    return t(`returns.actions.confirm.${pendingAction}`, { amount: detail?.refundToIssue ?? '' });
  }, [pendingAction, detail?.refundToIssue, t]);

  const handleConfirmAction = useCallback(() => {
    if (!returnId || !pending || pending.id !== returnId) {
      return;
    }
    const action = pending.action;
    actOnReturn({ id: returnId, action })
      .unwrap()
      .then(() => {
        setPending(null);
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
        setPending(null);
        // The API names WHY as an i18n key (`returns.errors.*`): eBay no longer
        // lists the option, the account is suspended, eBay refused the call…
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
  }, [returnId, pending, actOnReturn, showMessage, closeMessage, t]);

  const orderId = detail?.row.orderId ?? null;
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
    <ReturnDetailDrawerComponent
      isOpen={returnId !== null}
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
      isActing={isActing}
    />
  );
};

ReturnDetailDrawer.displayName = 'ReturnDetailDrawer';
