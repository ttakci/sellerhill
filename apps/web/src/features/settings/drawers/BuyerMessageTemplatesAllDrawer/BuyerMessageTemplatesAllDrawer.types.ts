import type { BuyerMessageEventType, BuyerMessageTemplate } from '@repo/shared';

export type BuyerMessageEventFilter = BuyerMessageEventType | 'all';

export interface BuyerMessageTemplatesAllDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  templates: BuyerMessageTemplate[];
  onEdit: (id: string) => void;
}

export interface BuyerMessageTemplatesAllDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  templates: BuyerMessageTemplate[];
  eventFilter: BuyerMessageEventFilter;
  eventFilterOptions: Array<{ value: BuyerMessageEventFilter; label: string }>;
  onEventFilterChange: (value: BuyerMessageEventFilter) => void;
  defaultBadgeLabel: string;
  customBadgeLabel: string;
  /** Currently selected template id, or null when nothing is selected. */
  selectedId: string | null;
  /** True until a card is selected — disables the footer "Continue" action. */
  isContinueDisabled: boolean;
  /** Selects (or toggles off) a card by id. */
  onSelect: (id: string) => void;
  /** Opens the edit flow for the currently selected template. */
  onContinue: () => void;
  /** Opens the delete confirmation for a template. */
  onDeleteRequest: (id: string) => void;
  isDeleting: boolean;
  titleLabel: string;
  subtitleLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  deleteLabel: string;
  isConfirmOpen: boolean;
  confirmDescription: string;
  confirmLabel: string;
  cancelLabel: string;
  onCloseConfirm: () => void;
  onConfirmDelete: () => void;
}
