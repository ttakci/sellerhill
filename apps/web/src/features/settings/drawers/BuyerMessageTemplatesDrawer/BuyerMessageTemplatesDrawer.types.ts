import type { BuyerMessageTemplate } from '@repo/shared';

export interface BuyerMessageTemplatesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  templates: BuyerMessageTemplate[];
  /** Card click -> straight to the edit form (no select-then-continue step). */
  onEdit: (id: string) => void;
  /** "New template" card -> opens the create form. */
  onCreate: () => void;
  /** "View all" carousel card (shown once templates exceed the carousel cap). */
  onViewAll: () => void;
}

export interface BuyerMessageTemplatesDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  templates: BuyerMessageTemplate[];
  onEdit: (id: string) => void;
  onCreate: () => void;
  onViewAll: () => void;
  defaultBadgeLabel: string;
  customBadgeLabel: string;
  eventLabel: (eventType: BuyerMessageTemplate['eventType']) => string;
  onDeleteRequest: (id: string) => void;
  deleteLabel: string;
  isDeleting: boolean;
  isConfirmOpen: boolean;
  confirmDescription: string;
  confirmLabel: string;
  cancelLabel: string;
  onCloseConfirm: () => void;
  onConfirmDelete: () => void;
}
