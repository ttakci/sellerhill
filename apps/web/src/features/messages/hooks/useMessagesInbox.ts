/**
 * Data half of the Messages page: which store is active, the conversation
 * list, the open thread, the live unread count per conversation type and the
 * one-shot mark-as-read when a thread with unread messages is opened.
 *
 * Every Message API read carries the URL-state `type` — never a row's own
 * `type` — so a list and its writes always talk about the same folder.
 */

import type { EbayAccountPublicDto, EbayConversationDto, EbayMessageDto } from '@repo/shared';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  MESSAGES_BREAKDOWN_POLL_INTERVAL_MS,
  useGetConversationThreadQuery,
  useGetConversationsQuery,
  useGetUnreadBreakdownQuery,
  useSetConversationReadMutation,
} from '../api/messagesApi';
import type { MessagesUrlState } from '../messages.types';

import { folderToStatus, isMergedFolder, MESSAGES_PAGE_SIZE, MESSAGES_THREAD_LIMIT } from './useMessagesUrlState';

import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';

const EMPTY_ACCOUNTS: EbayAccountPublicDto[] = [];
const EMPTY_CONVERSATIONS: EbayConversationDto[] = [];

/** The `?store=` account, else the first store that can message, else the first store. */
function resolveActiveAccount(
  accounts: EbayAccountPublicDto[],
  store: string | null,
): EbayAccountPublicDto | null {
  return (
    accounts.find((account) => account.id === store) ??
    accounts.find((account) => account.messagingEnabled) ??
    accounts[0] ??
    null
  );
}

const byCreatedAt = (a: EbayMessageDto, b: EbayMessageDto): number =>
  Date.parse(a.createdAt) - Date.parse(b.createdAt);

export function useMessagesInbox(state: MessagesUrlState) {
  const { store, type, folder, conversationId, page } = state;

  const { data: accountsData } = useGetEbayAccountsQuery();
  const accounts = accountsData?.items ?? EMPTY_ACCOUNTS;
  const activeAccount = useMemo(() => resolveActiveAccount(accounts, store), [accounts, store]);
  const ebayAccountId = activeAccount?.id ?? '';
  const messagingEnabled = activeAccount?.messagingEnabled ?? false;

  const merged = isMergedFolder(folder);
  // `currentData`, not `data`: a folder whose read fails must not keep showing the previous folder's list.
  const { currentData: conversationsPage, isFetching: isListFetching, isLoading: isListLoading } =
    useGetConversationsQuery(
      { ebayAccountId, type: merged ? undefined : type, status: folderToStatus(folder), page, limit: MESSAGES_PAGE_SIZE },
      // Every visit reads eBay again: "did my message go, did they answer" must not come from a cache.
      { skip: !activeAccount || !messagingEnabled, refetchOnMountOrArgChange: true },
    );
  const conversations = conversationsPage?.items ?? EMPTY_CONVERSATIONS;

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.conversationId === conversationId) ?? null,
    [conversations, conversationId],
  );

  /** Archive / Deleted mix both types, so a row's own type is what eBay needs there; elsewhere the folder's. */
  const typeOf = useCallback(
    (id: string | null) =>
      (merged ? conversations.find((conversation) => conversation.conversationId === id)?.type : undefined) ?? type,
    [merged, conversations, type],
  );
  const threadType = typeOf(conversationId);

  const { data: thread, isFetching: isThreadFetching } = useGetConversationThreadQuery(
    { conversationId: conversationId ?? '', ebayAccountId, type: threadType, page: 1, limit: MESSAGES_THREAD_LIMIT },
    { skip: !conversationId || !activeAccount || !messagingEnabled, refetchOnMountOrArgChange: true },
  );

  /** The store's own identities, lower-cased — a message from any of them is "mine". */
  const ownNames = useMemo(
    () =>
      [activeAccount?.ebayUsername, activeAccount?.sellerId, activeAccount?.storeName]
        .filter((name): name is string => !!name)
        .map((name) => name.toLowerCase()),
    [activeAccount],
  );
  const isMine = useMemo(
    () => (sender: string | null | undefined): boolean => !!sender && ownNames.includes(sender.toLowerCase()),
    [ownNames],
  );

  const threadMessages = useMemo(
    () => (thread && thread.conversationId === conversationId ? [...thread.messages].sort(byCreatedAt) : []),
    [thread, conversationId],
  );

  /* ─── unread per conversation type — counted live from eBay, which also
   * corrects the sidebar badge (the server stores the recount) ─── */

  const { data: unreadBreakdown, refetch: refetchBreakdown } = useGetUnreadBreakdownQuery(
    { ebayAccountId },
    {
      skip: !ebayAccountId || !messagingEnabled,
      pollingInterval: MESSAGES_BREAKDOWN_POLL_INTERVAL_MS,
      refetchOnMountOrArgChange: true,
    },
  );

  // eBay sends no notice when a message is READ on its own site, so coming back
  // to this tab recounts (which also corrects the sidebar badge). Scoped here —
  // the store-wide RTK focus listener is not wired up in this app.
  useEffect(() => {
    if (!ebayAccountId || !messagingEnabled) {
      return undefined;
    }
    const handleFocus = (): void => {
      void refetchBreakdown();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [ebayAccountId, messagingEnabled, refetchBreakdown]);

  /* ─── opening an unread thread marks it read — once per conversation id ─── */

  const [setConversationRead] = useSetConversationReadMutation();
  const markedRead = useRef(new Set<string>());
  const threadLoaded = threadMessages.length > 0;
  const hasUnread =
    (activeConversation?.unreadCount ?? 0) > 0 ||
    threadMessages.some((message) => !message.read && !isMine(message.senderUsername));

  useEffect(() => {
    if (!conversationId || !ebayAccountId || !messagingEnabled || markedRead.current.has(conversationId)) {
      return;
    }
    if (!hasUnread) {
      return;
    }
    markedRead.current.add(conversationId);
    setConversationRead({ conversationId, ebayAccountId, type: threadType, read: true })
      .unwrap()
      .catch(() => {
        // Let a later open try again rather than leaving it stuck unread.
        markedRead.current.delete(conversationId);
      });
  }, [conversationId, ebayAccountId, messagingEnabled, hasUnread, threadType, setConversationRead]);

  /** Marked unread by the seller: the next open of these must mark them read again. */
  const forgetMarkedRead = useCallback((ids: string[]) => {
    for (const id of ids) {
      markedRead.current.delete(id);
    }
  }, []);

  /* ─── keep the thread pinned to its newest message ─── */

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [threadMessages, conversationId]);

  return {
    accounts,
    activeAccount,
    ebayAccountId,
    messagingEnabled,
    conversations,
    conversationsTotal: conversationsPage?.total ?? 0,
    unreadBreakdown,
    isListLoading: isListLoading || (isListFetching && conversations.length === 0),
    thread,
    threadMessages,
    isThreadLoading: isThreadFetching && !threadLoaded,
    activeConversation,
    typeOf,
    threadType,
    isMine,
    scrollRef,
    forgetMarkedRead,
  };
}
