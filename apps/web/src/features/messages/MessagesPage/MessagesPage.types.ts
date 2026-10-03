import type {
  SelectOption,
  IconName,
  SegmentedControlOption,
  TabNavItem,
  TablePaginationProps,
} from '@repo/ui';

import type { ConversationListProps } from '../components/ConversationList';
import type { ConversationThreadProps } from '../components/ConversationThread';

/** One entry in the desktop folder rail. */
export interface MessagesFolderItemView {
  key: string;
  label: string;
  icon: IconName;
  /** Unread conversations behind this folder; 0 / undefined renders no badge. */
  count?: number;
  isActive: boolean;
  onSelect: () => void;
}

/** One group of the rail — "From members" / "From eBay". */
export interface MessagesFolderGroupView {
  key: string;
  label: string;
  items: MessagesFolderItemView[];
}

/** Below `xl` the rail collapses into a type switch + a folder switch. */
export interface MessagesCompactFilters {
  typeItems: TabNavItem[];
  typeValue: string;
  onTypeChange: (value: string) => void;
  folderOptions: SegmentedControlOption[];
  folderValue: string;
  onFolderChange: (value: string) => void;
}

export interface MessagesStoreSelector {
  value: string;
  options: SelectOption[];
  onChange: (value: string | number) => void;
}

export type MessagesPagination = Pick<
  TablePaginationProps,
  'count' | 'page' | 'rowsPerPage' | 'onPageChange' | 'onRowsPerPageChange' | 'labelRowsPerPage' | 'labelInfo'
> & { rowsPerPageOptions: number[] };

export interface MessagesPageComponentProps {
  title: string;
  subtitle: string;
  /** Mobile only: set while a thread is open — returns to the list. */
  onBack?: () => void;
  backLabel: string;
  /** Hide the toolbar on a phone while the thread fills the screen. */
  showToolbar: boolean;
  storeSelector: MessagesStoreSelector | null;
  /** False when the active store was connected before messaging existed. */
  messagingEnabled: boolean;
  onReconnect: () => void;
  isReconnecting: boolean;
  reconnectTitle: string;
  reconnectDescription: string;
  reconnectAction: string;
  folderGroups: MessagesFolderGroupView[];
  compactFilters: MessagesCompactFilters;
  /** Drives the single-column stack below `md`: list OR thread. */
  threadOpen: boolean;
  listProps: ConversationListProps;
  pagination: MessagesPagination | null;
  threadProps: ConversationThreadProps;
}
