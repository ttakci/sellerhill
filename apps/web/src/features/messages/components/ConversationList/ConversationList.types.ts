import type { IconName } from '@repo/ui';

/** One conversation row, already resolved by the page container. */
export interface ConversationRowView {
  id: string;
  otherParty: string;
  /** Single uppercase letter for the row avatar, resolved by the container. */
  avatarLabel: string;
  /** Photo of the listing the thread is about; null → the avatar stands alone. */
  imageUrl: string | null;
  title: string | null;
  snippet: string;
  date: string;
  unreadCount: number;
  referenceId: string | null;
  isSelected: boolean;
  isActive: boolean;
  /** Controls the accent/badge tone: members = brand blue, eBay = warning amber. */
  tone?: 'brand' | 'amber';
}

/** One button in the bulk bar (shown while rows are selected). */
export interface ConversationBulkActionView {
  id: string;
  label: string;
  icon: IconName;
  onClick: () => void;
}

export interface ConversationListProps {
  rows: ConversationRowView[];
  isLoading: boolean;
  /** Folder-specific empty copy, resolved by the container. */
  emptyTitle: string;
  onOpen: (conversationId: string) => void;
  onToggle: (conversationId: string, checked: boolean) => void;
  allSelected: boolean;
  onToggleAll: (checked: boolean) => void;
  selectedCount: number;
  bulkActions: ConversationBulkActionView[];
}
