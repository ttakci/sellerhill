/**
 * Write half of the Messages page: reply draft + send, row selection, bulk
 * archive / delete / mark read, the thread header's own actions, and the
 * reconnect redirect for a store connected before messaging existed.
 *
 * Every write carries `typeOf(id)`: the folder's type, or the row's own in
 * Archive / Deleted, where both types share one list.
 */

import { EBAY_BULK_CONVERSATIONS_MAX, EbayConversationStatus, type EbayConversationMutableStatus } from '@repo/shared';
import { useUI } from '@repo/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useBulkConversationStatusMutation,
  useReplyToConversationMutation,
  useSetConversationReadMutation,
} from '../api/messagesApi';
import type { MessagesActionsInput, MessagesApiError } from '../messages.types';

import { useLazyGetEbayConnectUrlQuery } from '@/features/ebay/api/ebayApi';
import { getErrorI18nKey } from '@/utils/errorHandler';

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

export function useMessagesActions({
  ebayAccountId,
  marketplaceId,
  typeOf,
  conversationId,
  pageIds,
  scopeKey,
  openConversation,
  onMarkedUnread,
}: MessagesActionsInput) {
  const { i18n } = useTranslation(['messages', 'translation']);
  const { showMessage, closeMessage } = useUI();

  const [replyToConversation, { isLoading: isReplying }] = useReplyToConversationMutation();
  const [bulkConversationStatus, { isLoading: isBulkUpdating }] = useBulkConversationStatusMutation();
  const [setConversationRead, { isLoading: isSettingRead }] = useSetConversationReadMutation();
  const [getConnectUrl, { isLoading: isReconnecting }] = useLazyGetEbayConnectUrlQuery();

  const showError = useCallback(
    (error?: MessagesApiError, descriptionKey?: string) => {
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey: descriptionKey ?? getErrorI18nKey(error),
          primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
        },
        i18n.t.bind(i18n),
      );
    },
    [showMessage, closeMessage, i18n],
  );

  /* ─── reply ─── */

  const [draft, setDraft] = useState('');
  useEffect(() => {
    setDraft('');
  }, [conversationId]);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || !conversationId || !ebayAccountId) {
      return;
    }
    // The draft is cleared only once eBay accepted the message.
    replyToConversation({ conversationId, ebayAccountId, type: typeOf(conversationId), text })
      .unwrap()
      .then(() => setDraft(''))
      .catch((error: MessagesApiError) => showError(error));
  }, [draft, conversationId, ebayAccountId, typeOf, replyToConversation, showError]);

  /* ─── selection ─── */

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setSelected(new Set());
  }, [scopeKey]);

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => setSelected(checked ? new Set(pageIds) : new Set()),
    [pageIds],
  );

  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const selectedIds = useMemo(() => [...selected], [selected]);

  /* ─── status writes ─── */

  /** eBay takes at most 10 ids per bulk call, so larger selections go in chunks. */
  const applyStatus = useCallback(
    async (ids: string[], status: EbayConversationMutableStatus): Promise<void> => {
      if (!ebayAccountId || ids.length === 0) {
        return;
      }
      try {
        // One bulk call carries one type, so a mixed Archive / Deleted selection is split by type.
        const byType = new Map<ReturnType<typeof typeOf>, string[]>();
        for (const id of ids) {
          byType.set(typeOf(id), [...(byType.get(typeOf(id)) ?? []), id]);
        }
        const results = await Promise.all(
          [...byType].flatMap(([type, typeIds]) =>
            chunk(typeIds, EBAY_BULK_CONVERSATIONS_MAX).map((conversationIds) =>
              bulkConversationStatus({ ebayAccountId, type, conversationIds, status }).unwrap(),
            ),
          ),
        );
        setSelected(new Set());
        if (conversationId && ids.includes(conversationId)) {
          openConversation(null);
        }
        if (results.some((result) => result.failed.length > 0)) {
          showError(undefined, 'ebay:ebay.errors.messagingUnavailable');
        }
      } catch (error) {
        showError(error as MessagesApiError);
      }
    },
    [ebayAccountId, typeOf, conversationId, bulkConversationStatus, openConversation, showError],
  );

  const applyRead = useCallback(
    async (ids: string[], read: boolean): Promise<void> => {
      if (!ebayAccountId || ids.length === 0) {
        return;
      }
      try {
        await Promise.all(
          ids.map((id) => setConversationRead({ conversationId: id, ebayAccountId, type: typeOf(id), read }).unwrap()),
        );
        setSelected(new Set());
        if (!read) {
          // Reopening one of these must mark it read again.
          onMarkedUnread(ids);
        }
        // Marking the open thread unread returns to the list — staying on it
        // would leave a thread on screen that the inbox now calls unread.
        if (!read && conversationId && ids.includes(conversationId)) {
          openConversation(null);
        }
      } catch (error) {
        showError(error as MessagesApiError);
      }
    },
    [ebayAccountId, typeOf, conversationId, setConversationRead, openConversation, onMarkedUnread, showError],
  );

  /** Deleting has no undo here, so it asks first. */
  const confirmDelete = useCallback(
    (ids: string[]) => {
      showMessage(
        {
          type: 'warning',
          headerKey: 'messages:messages.actions.delete',
          descriptionKey: 'messages:messages.actions.deleteConfirm',
          primaryButton: {
            labelKey: 'messages:messages.actions.delete',
            variant: 'danger',
            onClick: () => {
              closeMessage();
              void applyStatus(ids, EbayConversationStatus.DELETE);
            },
          },
          secondaryButton: { labelKey: 'translation:common.cancel', onClick: closeMessage },
        },
        i18n.t.bind(i18n),
      );
    },
    [showMessage, closeMessage, applyStatus, i18n],
  );

  /* ─── reconnect (store connected before the messaging scopes existed) ─── */

  const handleReconnect = useCallback(() => {
    getConnectUrl({ marketplaceId })
      .unwrap()
      .then((result) => {
        window.location.href = result.url;
      })
      .catch((error: MessagesApiError) => showError(error));
  }, [getConnectUrl, marketplaceId, showError]);

  return {
    draft,
    setDraft,
    handleSend,
    isReplying,
    isBulkUpdating: isBulkUpdating || isSettingRead,
    selectedIds,
    toggleOne,
    toggleAll,
    allSelected,
    applyStatus,
    applyRead,
    confirmDelete,
    handleReconnect,
    isReconnecting,
  };
}
