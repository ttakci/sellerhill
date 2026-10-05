import type { IconName } from '@repo/ui';
import type React from 'react';

/** One attachment, resolved by the page container. */
export interface ThreadMediaView {
  key: string;
  name: string;
  url: string;
  isImage: boolean;
}

/** One message bubble, resolved by the page container. */
export interface ThreadMessageView {
  id: string;
  body: string;
  /**
   * True when `body` is an HTML document rather than plain text — eBay's own
   * system notices (e.g. "We sent your payout") carry a full inline-styled
   * e-mail template. Resolved once by the container so the presentation
   * layer never re-sniffs the string.
   */
  bodyIsHtml: boolean;
  /** "You" for the store's own messages, else the sender's eBay username. */
  senderLabel: string;
  isMine: boolean;
  date: string;
  media: ThreadMediaView[];
}

/** One button in the thread header. */
export interface ThreadActionView {
  id: string;
  label: string;
  icon: IconName;
  onClick: () => void;
}

export interface ConversationThreadProps {
  /** False while no conversation is selected — the pane shows its empty state. */
  hasConversation: boolean;
  isLoading: boolean;
  /** Buyer/eBay account shown as the conversation heading. */
  title: string;
  /** eBay subject or listing title shown in the contextual item strip. */
  subject: string | null;
  otherParty: string | null;
  /** Single uppercase letter for the header avatar, resolved by the container. */
  avatarLabel: string;
  referenceId: string | null;
  /** Listing thumbnail when the referenced item exists in the seller's catalog. */
  imageUrl: string | null;
  messages: ThreadMessageView[];
  actions: ThreadActionView[];
  /** False for FROM_EBAY conversations, which eBay does not accept replies to. */
  canReply: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  maxLength: number;
  /** The scrolling message list; the container keeps it pinned to the newest message. */
  scrollRef: React.RefObject<HTMLDivElement>;
}
