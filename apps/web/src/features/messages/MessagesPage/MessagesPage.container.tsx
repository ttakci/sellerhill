/**
 * MessagesPage Container
 *
 * URL state (`?store=&type=&folder=&c=&page=`) → data (useMessagesInbox) →
 * writes (useMessagesActions) → view models for the presentational panes.
 * A store connected before the messaging scopes existed gets the reconnect
 * prompt and costs no Message API call at all (every query is skipped).
 */

import { EBAY_MESSAGE_MAX_LENGTH, EbayConversationStatus, EbayConversationType, EbayMessageMediaType, MessagesFolder, type EbayAccountPublicDto } from '@repo/shared';
import { formatDate, getLocaleConfig, useIsMobile, useLoading, useMediaQuery, useTheme, type IconName, type SelectOption } from '@repo/ui';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConversationBulkActionView, ConversationRowView } from '../components/ConversationList';
import type { ThreadActionView, ThreadMessageView } from '../components/ConversationThread';
import { useMessagesActions } from '../hooks/useMessagesActions';
import { useMessagesInbox } from '../hooks/useMessagesInbox';
import { MESSAGES_PAGE_SIZE, useMessagesUrlState } from '../hooks/useMessagesUrlState';

import { MessagesPageComponent } from './MessagesPage.component';
import type { MessagesCompactFilters, MessagesFolderGroupView, MessagesPagination, MessagesStoreSelector } from './MessagesPage.types';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';

const FOLDERS: MessagesFolder[] = [MessagesFolder.ALL, MessagesFolder.UNREAD, MessagesFolder.ARCHIVE, MessagesFolder.DELETED];
const TYPES: EbayConversationType[] = [EbayConversationType.FROM_MEMBERS, EbayConversationType.FROM_EBAY];

const FOLDER_ICON: Record<MessagesFolder, IconName> = {
  [MessagesFolder.ALL]: 'inbox',
  [MessagesFolder.UNREAD]: 'mail',
  [MessagesFolder.ARCHIVE]: 'archive',
  [MessagesFolder.DELETED]: 'trash',
};

const TYPE_ICON: Record<EbayConversationType, IconName> = {
  [EbayConversationType.FROM_MEMBERS]: 'users',
  [EbayConversationType.FROM_EBAY]: 'bell',
};

const TYPE_LABEL_KEY: Record<EbayConversationType, string> = {
  [EbayConversationType.FROM_MEMBERS]: 'messages.folders.members',
  [EbayConversationType.FROM_EBAY]: 'messages.folders.ebay',
};

/** eBay's own wording for the unread entry of each type ("Unread from members" / "Unread from eBay"). */
const UNREAD_LABEL_KEY: Record<EbayConversationType, string> = {
  [EbayConversationType.FROM_MEMBERS]: 'messages.folders.unreadMembers',
  [EbayConversationType.FROM_EBAY]: 'messages.folders.unreadEbay',
};

const FOLDER_LABEL_KEY: Record<MessagesFolder, string> = {
  [MessagesFolder.ALL]: 'messages.folders.all',
  [MessagesFolder.UNREAD]: 'messages.folders.unread',
  [MessagesFolder.ARCHIVE]: 'messages.folders.archive',
  [MessagesFolder.DELETED]: 'messages.folders.deleted',
};

const EMPTY_KEY: Record<MessagesFolder, string> = {
  [MessagesFolder.ALL]: 'messages.list.empty',
  [MessagesFolder.UNREAD]: 'messages.list.emptyUnread',
  [MessagesFolder.ARCHIVE]: 'messages.list.emptyArchive',
  [MessagesFolder.DELETED]: 'messages.list.emptyDeleted',
};

/** Attachments render only over https. */
const isSafeMediaUrl = (url: string | null | undefined): boolean =>
  typeof url === 'string' && url.startsWith('https://');

/**
 * eBay's own system notices ("We sent your payout") carry a full inline-
 * styled e-mail template as `messageBody`; buyer/seller messages are plain
 * text. eBay's Message API gives no content-type field, so this is a sniff:
 * a leading tag is enough — a plain-text message from a real buyer never
 * opens with one.
 */
const looksLikeHtml = (body: string): boolean => /^\s*<[a-z!]/i.test(body);

/** List snippets are one line of plain text — an HTML body is stripped to its tags-out text first. */
const toSnippet = (body: string | undefined): string => {
  const raw = body ?? '';
  const text = looksLikeHtml(raw) ? raw.replace(/<[^>]*>/g, ' ') : raw;
  return text.replace(/\s+/g, ' ').trim();
};

/** First letter for the avatar disc; eBay usernames are ASCII so `charAt` is safe. */
const avatarInitial = (name: string | null | undefined): string => {
  const trimmed = (name ?? '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
};

/** "Unread (12)" — the count is omitted at 0 so a clean inbox reads clean. */
const withCount = (label: string, count: number): string => (count > 0 ? `${label} (${count})` : label);

/** Same store label the dashboard filter shows. */
const storeLabel = (account: EbayAccountPublicDto): string =>
  account.storeName || account.ebayUsername || account.sellerId;

export const MessagesPageContainer = (): React.ReactElement => {
  const { t, i18n } = useTranslation(['messages', 'translation']);
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  /** The folder rail (RailPane) replaces the toolbar's compact type/folder
   * switch starting at this width — below it, the toolbar is what carries
   * that control. */
  const isRailVisible = useMediaQuery(`(min-width: ${theme.breakpoints.xl})`);

  const { state, setStore, setType, setFolder, setTypeAndFolder, openConversation, setPage } =
    useMessagesUrlState();
  const { type, folder, conversationId, page } = state;

  const inbox = useMessagesInbox(state);
  const { accounts, conversations, activeAccount, activeConversation, threadMessages, isMine } = inbox;

  const pageIds = useMemo(
    () => conversations.map((conversation) => conversation.conversationId),
    [conversations],
  );

  const actions = useMessagesActions({
    ebayAccountId: inbox.ebayAccountId,
    marketplaceId: activeAccount?.marketplaceId,
    type,
    conversationId,
    pageIds,
    scopeKey: `${inbox.ebayAccountId}|${type}|${folder}|${page}`,
    openConversation,
    onMarkedUnread: inbox.forgetMarkedRead,
  });
  const { selectedIds, applyRead, applyStatus, confirmDelete } = actions;

  /* Blocking mutations only — the initial list/thread fetch shows its own state. */
  useLoading(actions.isReplying || actions.isBulkUpdating);

  /* ─── formatting ─── */

  const languageCode = (i18n.language || 'en').split('-')[0];
  const { locale } = useMemo(() => getLocaleConfig(languageCode), [languageCode]);

  const formatListDate = useCallback(
    (iso: string): string => {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) {
        return '';
      }
      const isToday = date.toDateString() === new Date().toDateString();
      return isToday
        ? formatDate(iso, locale, { day: undefined, month: undefined, hour: '2-digit', minute: '2-digit' })
        : formatDate(iso, locale);
    },
    [locale],
  );

  const formatMessageDate = useCallback(
    (iso: string): string =>
      Number.isNaN(Date.parse(iso)) ? '' : formatDate(iso, locale, { hour: '2-digit', minute: '2-digit' }),
    [locale],
  );

  /* ─── list ─── */

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const rows = useMemo<ConversationRowView[]>(
    () =>
      conversations.map((conversation) => {
        const otherParty = conversation.otherPartyUsername ?? conversation.latestMessage?.senderUsername ?? '—';
        return {
          id: conversation.conversationId,
          otherParty,
          avatarLabel: avatarInitial(otherParty),
          imageUrl: conversation.imageUrl ?? null,
          title: conversation.title,
          snippet: toSnippet(conversation.latestMessage?.body),
          date: formatListDate(conversation.latestMessage?.createdAt ?? conversation.createdAt),
          unreadCount: conversation.unreadCount,
          referenceId: conversation.referenceId,
          isSelected: selectedSet.has(conversation.conversationId),
          isActive: conversation.conversationId === conversationId,
        };
      }),
    [conversations, conversationId, selectedSet, formatListDate],
  );

  /* In the archive and deleted folders the counterpart of "archive" is "move back to the inbox". */
  const inArchive = folder === MessagesFolder.ARCHIVE || folder === MessagesFolder.DELETED;
  const archiveTarget = inArchive ? EbayConversationStatus.ACTIVE : EbayConversationStatus.ARCHIVE;
  const archiveLabel = inArchive ? t('messages.actions.unarchive') : t('messages.actions.archive');
  const archiveIcon: IconName = inArchive ? 'inbox' : 'archive';

  const bulkActions = useMemo<ConversationBulkActionView[]>(
    () => [
      {
        id: 'read',
        label: t('messages.actions.markRead'),
        icon: 'mail-open',
        onClick: () => void applyRead(selectedIds, true),
      },
      {
        id: 'archive',
        label: archiveLabel,
        icon: archiveIcon,
        onClick: () => void applyStatus(selectedIds, archiveTarget),
      },
      {
        id: 'delete',
        label: t('messages.actions.delete'),
        icon: 'trash',
        onClick: () => confirmDelete(selectedIds),
      },
    ],
    [t, selectedIds, applyRead, applyStatus, confirmDelete, archiveLabel, archiveIcon, archiveTarget],
  );

  const pagination = useMemo<MessagesPagination | null>(
    () =>
      inbox.conversationsTotal > 0
        ? {
            count: inbox.conversationsTotal,
            page,
            rowsPerPage: MESSAGES_PAGE_SIZE,
            rowsPerPageOptions: [MESSAGES_PAGE_SIZE],
            onPageChange: setPage,
            onRowsPerPageChange: () => setPage(1),
            labelRowsPerPage: t('translation:common.rowsPerPage'),
            labelInfo: t('translation:common.showing_info'),
          }
        : null,
    [inbox.conversationsTotal, page, setPage, t],
  );

  /* ─── thread ─── */

  const messages = useMemo<ThreadMessageView[]>(
    () =>
      threadMessages.map((message) => {
        const mine = isMine(message.senderUsername);
        return {
          id: message.messageId,
          body: message.body,
          bodyIsHtml: looksLikeHtml(message.body),
          senderLabel: mine ? t('messages.thread.you') : message.senderUsername,
          isMine: mine,
          date: formatMessageDate(message.createdAt),
          // Only https links become an <a href>/<img src>: a media URL is
          // eBay-supplied text, and anything else (javascript:, data:, http:)
          // is dropped rather than rendered.
          media: message.media
            .filter((media) => isSafeMediaUrl(media.mediaUrl))
            .map((media, index) => ({
              key: `${message.messageId}-${index}`,
              name: media.mediaName,
              url: media.mediaUrl,
              isImage: String(media.mediaType) === String(EbayMessageMediaType.IMAGE),
            })),
        };
      }),
    [threadMessages, isMine, t, formatMessageDate],
  );

  const otherParty =
    activeConversation?.otherPartyUsername ??
    threadMessages.find((message) => !isMine(message.senderUsername))?.senderUsername ??
    null;
  const threadTitle =
    inbox.thread?.title ?? activeConversation?.title ?? otherParty ?? t('messages.page.title');
  const threadAvatarLabel = avatarInitial(otherParty ?? threadTitle);

  const threadActions = useMemo<ThreadActionView[]>(() => {
    if (!conversationId) {
      return [];
    }
    const ids = [conversationId];
    return [
      {
        id: 'unread',
        label: t('messages.actions.markUnread'),
        icon: 'mail',
        onClick: () => void applyRead(ids, false),
      },
      {
        id: 'archive',
        label: archiveLabel,
        icon: archiveIcon,
        onClick: () => void applyStatus(ids, archiveTarget),
      },
      {
        id: 'delete',
        label: t('messages.actions.delete'),
        icon: 'trash',
        onClick: () => confirmDelete(ids),
      },
    ];
  }, [conversationId, t, applyRead, applyStatus, confirmDelete, archiveLabel, archiveIcon, archiveTarget]);

  /* ─── folders: the rail (≥ lg) and its compact stand-in (< lg) ─── */

  /** Unread conversations per type, counted live from eBay. */
  const unreadByType = useMemo<Record<EbayConversationType, number>>(
    () => ({
      [EbayConversationType.FROM_MEMBERS]: inbox.unreadBreakdown?.members ?? 0,
      [EbayConversationType.FROM_EBAY]: inbox.unreadBreakdown?.ebay ?? 0,
    }),
    [inbox.unreadBreakdown],
  );

  /*
   * The rail mirrors eBay's own Messages page (operator request, 2026-10-01;
   * the competitor does the same): an Inbox group with "From members",
   * "Unread from members", "From eBay", "Unread from eBay" in eBay's order,
   * then Archive and Deleted. eBay's API needs a conversation TYPE on every
   * read, so there is no combined "all types" entry and Archive / Deleted are
   * split by type under their own headings.
   */
  const folderGroups = useMemo<MessagesFolderGroupView[]>(() => {
    const item = (
      groupType: EbayConversationType,
      groupFolder: MessagesFolder,
      label: string,
      icon: IconName,
    ) => ({
      key: `${groupType}-${groupFolder}`,
      label,
      icon,
      count: groupFolder === MessagesFolder.UNREAD ? unreadByType[groupType] : 0,
      isActive: type === groupType && folder === groupFolder,
      onSelect: () => setTypeAndFolder(groupType, groupFolder),
    });
    const byType = (groupFolder: MessagesFolder) =>
      TYPES.map((groupType) => item(groupType, groupFolder, t(TYPE_LABEL_KEY[groupType]), TYPE_ICON[groupType]));
    return [
      {
        key: 'inbox',
        label: t('messages.folders.inbox'),
        items: TYPES.flatMap((groupType) => [
          item(groupType, MessagesFolder.ALL, t(TYPE_LABEL_KEY[groupType]), TYPE_ICON[groupType]),
          item(groupType, MessagesFolder.UNREAD, t(UNREAD_LABEL_KEY[groupType]), FOLDER_ICON[MessagesFolder.UNREAD]),
        ]),
      },
      { key: 'archive', label: t(FOLDER_LABEL_KEY[MessagesFolder.ARCHIVE]), items: byType(MessagesFolder.ARCHIVE) },
      { key: 'deleted', label: t(FOLDER_LABEL_KEY[MessagesFolder.DELETED]), items: byType(MessagesFolder.DELETED) },
    ];
  }, [t, type, folder, setTypeAndFolder, unreadByType]);

  const compactFilters = useMemo<MessagesCompactFilters>(
    () => ({
      typeItems: TYPES.map((entry) => ({
        id: entry,
        label: withCount(t(TYPE_LABEL_KEY[entry]), unreadByType[entry]),
        icon: TYPE_ICON[entry],
      })),
      typeValue: type,
      onTypeChange: (value: string) => {
        const next = TYPES.find((entry) => String(entry) === value);
        if (next) {
          setType(next);
        }
      },
      folderOptions: FOLDERS.map((entry) => ({
        value: entry,
        label:
          entry === MessagesFolder.UNREAD
            ? withCount(t(FOLDER_LABEL_KEY[entry]), unreadByType[type])
            : t(FOLDER_LABEL_KEY[entry]),
      })),
      folderValue: folder,
      onFolderChange: (value: string) => {
        const next = FOLDERS.find((entry) => String(entry) === value);
        if (next) {
          setFolder(next);
        }
      },
    }),
    [t, type, folder, setType, setFolder, unreadByType],
  );

  /* ─── store filter — only worth showing with more than one store ─── */

  const storeSelector = useMemo<MessagesStoreSelector | null>(() => {
    if (accounts.length < 2 || !activeAccount) {
      return null;
    }
    const options: SelectOption[] = accounts.map((account) => ({
      value: account.id,
      label: storeLabel(account),
    }));
    return { value: activeAccount.id, options, onChange: (value) => setStore(String(value)) };
  }, [accounts, activeAccount, setStore]);

  /* ─── mobile: list OR thread; the header's back arrow clears `?c=` ─── */

  const threadOpenOnPhone = isMobile && !!conversationId;
  const handleBack = useCallback(() => openConversation(null), [openConversation]);

  /**
   * The toolbar exists to carry the compact type/folder switch (below `xl`,
   * where the rail is hidden) and the store switcher (2+ stores). With a
   * single store at `xl`+ neither renders, and an unconditional `showToolbar`
   * left a bordered, shadowed bar with nothing inside it.
   */
  const needsCompactFilters = inbox.messagingEnabled && !isRailVisible;
  const showToolbar = !threadOpenOnPhone && (needsCompactFilters || !!storeSelector);

  return (
    <EbayAccountGuard>
      <MessagesPageComponent
        title={t('messages.page.title')}
        subtitle={threadOpenOnPhone ? '' : t('messages.page.subtitle')}
        onBack={threadOpenOnPhone ? handleBack : undefined}
        backLabel={t('messages.thread.backToList')}
        showToolbar={showToolbar}
        storeSelector={storeSelector}
        messagingEnabled={inbox.messagingEnabled}
        onReconnect={actions.handleReconnect}
        isReconnecting={actions.isReconnecting}
        reconnectTitle={t('messages.reconnect.title')}
        reconnectDescription={t('messages.reconnect.description')}
        reconnectAction={t('messages.reconnect.action')}
        folderGroups={folderGroups}
        compactFilters={compactFilters}
        threadOpen={!!conversationId}
        listProps={{
          rows,
          isLoading: inbox.isListLoading,
          emptyTitle: t(EMPTY_KEY[folder]),
          onOpen: openConversation,
          onToggle: actions.toggleOne,
          allSelected: actions.allSelected,
          onToggleAll: actions.toggleAll,
          selectedCount: selectedIds.length,
          bulkActions,
        }}
        pagination={pagination}
        threadProps={{
          hasConversation: !!conversationId,
          isLoading: inbox.isThreadLoading,
          title: threadTitle,
          otherParty,
          avatarLabel: threadAvatarLabel,
          referenceId: activeConversation?.referenceId ?? null,
          messages,
          actions: threadActions,
          canReply: type !== EbayConversationType.FROM_EBAY,
          draft: actions.draft,
          onDraftChange: actions.setDraft,
          onSend: actions.handleSend,
          isSending: actions.isReplying,
          maxLength: EBAY_MESSAGE_MAX_LENGTH,
          scrollRef: inbox.scrollRef,
        }}
      />
    </EbayAccountGuard>
  );
};

export default MessagesPageContainer;
