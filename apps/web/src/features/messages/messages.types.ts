import type { EbayConversationType, EbayMarketplaceId, MessagesFolder } from '@repo/shared';

import type { getErrorI18nKey } from '@/utils/errorHandler';

/** An RTK Query error as `getErrorI18nKey` accepts it. */
export type MessagesApiError = Parameters<typeof getErrorI18nKey>[0];

/** What `useMessagesActions` needs from the page. */
export interface MessagesActionsInput {
  ebayAccountId: string;
  marketplaceId: EbayMarketplaceId | undefined;
  type: EbayConversationType;
  conversationId: string | null;
  /** Ids on the current list page — "select all" selects these. */
  pageIds: string[];
  /** Changes whenever the list scope changes (store/type/folder/page): selection resets. */
  scopeKey: string;
  openConversation: (id: string | null) => void;
  /** Called with the ids just marked UNREAD, so the inbox's once-per-id mark-read guard forgets them. */
  onMarkedUnread: (ids: string[]) => void;
}

/** The Messages page's URL-backed state (`?store=&type=&folder=&c=&page=`). */
export interface MessagesUrlState {
  /** The top bar's active store (`useActiveStore`); null while the stores load. */
  store: string | null;
  /** `?type=` — FROM_MEMBERS or FROM_EBAY; every Message API read needs one. */
  type: EbayConversationType;
  /** `?folder=` — all / unread / archive. */
  folder: MessagesFolder;
  /** `?c=` — the open conversation id. */
  conversationId: string | null;
  /** `?page=` — 1-based list page. */
  page: number;
}

/** The URL parameters `useMessagesUrlState` writes. */
export type MessagesUrlParam = 'store' | 'type' | 'folder' | 'c' | 'page';

export interface UseMessagesUrlStateResult {
  state: MessagesUrlState;
  setType: (value: EbayConversationType) => void;
  setFolder: (value: MessagesFolder) => void;
  /** Also sets type + folder in one write (the folder rail picks both at once). */
  setTypeAndFolder: (type: EbayConversationType, folder: MessagesFolder) => void;
  openConversation: (id: string | null) => void;
  setPage: (page: number) => void;
}
