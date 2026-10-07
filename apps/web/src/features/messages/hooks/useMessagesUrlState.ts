/**
 * URL-backed Messages page state: store, conversation type, folder, open
 * conversation and list page. Keeping it in the query string makes a
 * conversation link shareable and survives a refresh — and it is what drives
 * the mobile list/thread stack (`?c=` set → thread, cleared → list).
 */

import { EbayConversationStatus, EbayConversationType, MessagesFolder } from '@repo/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { MessagesUrlParam, UseMessagesUrlStateResult } from '../messages.types';

import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';

/** Conversations per list page. eBay caps a Message API read at 50. */
export const MESSAGES_PAGE_SIZE = 25;

/** Messages loaded for one thread (eBay's own per-read cap). */
export const MESSAGES_THREAD_LIMIT = 50;

const parseEnum = <T extends string>(raw: string | null, allowed: T[], fallback: T): T =>
  allowed.includes(raw as T) ? (raw as T) : fallback;

/**
 * The folder rail is a client grouping; this is the `conversation_status` it
 * sends to eBay. "All" sends ACTIVE so archived and deleted conversations never
 * appear there; UNREAD, ARCHIVE and DELETE are filtered by eBay itself.
 */
export function folderToStatus(folder: MessagesFolder): EbayConversationStatus {
  if (folder === MessagesFolder.UNREAD) {
    return EbayConversationStatus.UNREAD;
  }
  if (folder === MessagesFolder.ARCHIVE) {
    return EbayConversationStatus.ARCHIVE;
  }
  if (folder === MessagesFolder.DELETED) {
    return EbayConversationStatus.DELETE;
  }
  return EbayConversationStatus.ACTIVE;
}

/** Archive and Deleted show both conversation types in one list, as eBay's own page does. */
export const isMergedFolder = (folder: MessagesFolder): boolean =>
  folder === MessagesFolder.ARCHIVE || folder === MessagesFolder.DELETED;

export function useMessagesUrlState(): UseMessagesUrlStateResult {
  const [params, setParams] = useSearchParams();

  const type = parseEnum(
    params.get('type'),
    Object.values(EbayConversationType),
    EbayConversationType.FROM_MEMBERS,
  );
  const folder = parseEnum(params.get('folder'), Object.values(MessagesFolder), MessagesFolder.ALL);
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  // The store is the top bar's active store; a switch there drops `c` and `page`.
  const store = useActiveStore().activeStoreId;
  const conversationId = params.get('c');

  const patch = useCallback(
    (changes: Partial<Record<MessagesUrlParam, string | null>>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === undefined || value === '' || (key === 'page' && value === '1')) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const setType = useCallback(
    (value: EbayConversationType) => patch({ type: value, c: null, page: null }),
    [patch],
  );
  const setFolder = useCallback(
    (value: MessagesFolder) => patch({ folder: value, c: null, page: null }),
    [patch],
  );
  const setTypeAndFolder = useCallback(
    (nextType: EbayConversationType, nextFolder: MessagesFolder) =>
      patch({ type: nextType, folder: nextFolder, c: null, page: null }),
    [patch],
  );
  const openConversation = useCallback((id: string | null) => patch({ c: id }), [patch]);
  const setPage = useCallback((value: number) => patch({ page: String(value), c: null }), [patch]);

  return useMemo(
    () => ({
      state: { store, type, folder, conversationId, page },
      setType,
      setFolder,
      setTypeAndFolder,
      openConversation,
      setPage,
    }),
    [store, type, folder, conversationId, page, setType, setFolder, setTypeAndFolder, openConversation, setPage],
  );
}
