import type { EbayReturnAction } from '@repo/shared';

import type { ReturnDetailView } from '../returns.types';

export interface ReturnDetailDrawerProps {
  /** The return row id open in the drawer; null = closed. */
  returnId: string | null;
  onClose: () => void;
}

export interface ReturnDetailDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  isError: boolean;
  detail: ReturnDetailView | null;
  /** Opens the order behind the return; absent when that order is not one we hold. */
  onViewOrder?: () => void;
  onOpenOnEbay?: () => void;
  /** Asks for confirmation; the action itself runs from the confirm dialog. */
  onRequestAction: (action: EbayReturnAction) => void;
  /** The action awaiting confirmation, or null. */
  pendingAction: EbayReturnAction | null;
  /** Localized description for the confirm dialog of `pendingAction`. */
  confirmDescription: string;
  onConfirmAction: () => void;
  onCancelAction: () => void;
  isActing: boolean;
}
