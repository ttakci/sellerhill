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
  title: string;
  otherParty: string | null;
  referenceId: string | null;
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
