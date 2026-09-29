/**
 * Data half of the Messages page: which store is active, the conversation
 * list, the open thread, the page-open unread recount and the one-shot
 * mark-as-read when a thread with unread messages is opened.
 *
 * Every Message API read carries the URL-state `type` — never a row's own
 * `type` — so a list and its writes always talk about the same folder.
 */

import type { EbayAccountPublicDto, EbayConversationDto, EbayMessageDto } from '@repo/shared';
import { useEffect, useMemo, useRef } from 'react';

import {
  useGetConversationThreadQuery,
  useGetConversationsQuery,
  useRefreshUnreadMutation,
  useSetConversationReadMutation,
} from '../api/messagesApi';
import type { MessagesUrlState } from '../messages.types';

import { folderToStatus, MESSAGES_PAGE_SIZE, MESSAGES_THREAD_LIMIT } from './useMessagesUrlState';

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

  const { data: conversationsPage, isFetching: isListFetching, isLoading: isListLoading } =
    useGetConversationsQuery(
      { ebayAccountId, type, status: folderToStatus(folder), page, limit: MESSAGES_PAGE_SIZE },
      { skip: !activeAccount || !messagingEnabled },
    );
  const conversations = conversationsPage?.items ?? EMPTY_CONVERSATIONS;

  const { data: thread, isFetching: isThreadFetching } = useGetConversationThreadQuery(
    { conversationId: conversationId ?? '', ebayAccountId, type, page: 1, limit: MESSAGES_THREAD_LIMIT },
    { skip: !conversationId || !activeAccount || !messagingEnabled },
  );

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.conversationId === conversationId) ?? null,
    [conversations, conversationId],
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

  /* ─── page-open unread recount: once per store per mount ─── */

  const [refreshUnread] = useRefreshUnreadMutation();
  const refreshedAccounts = useRef(new Set<string>());
  useEffect(() => {
    if (!ebayAccountId || !messagingEnabled || refreshedAccounts.current.has(ebayAccountId)) {
      return;
    }
    refreshedAccounts.current.add(ebayAccountId);
    // Background recount — a failure only leaves the badge at its last value.
    refreshUnread({ ebayAccountId })
      .unwrap()
      .catch(() => undefined);
  }, [ebayAccountId, messagingEnabled, refreshUnread]);

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
    setConversationRead({ conversationId, ebayAccountId, type, read: true })
      .unwrap()
      .catch(() => {
        // Let a later open try again rather than leaving it stuck unread.
        markedRead.current.delete(conversationId);
      });
  }, [conversationId, ebayAccountId, messagingEnabled, hasUnread, type, setConversationRead]);

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
    isListLoading: isListLoading || (isListFetching && conversations.length === 0),
    thread,
    threadMessages,
    isThreadLoading: isThreadFetching && !threadLoaded,
    activeConversation,
    isMine,
    scrollRef,
  };
}
