import type { EbayCancellationAction } from '@repo/shared';

import type { CancellationDetailView } from '../cancellations.types';

export interface CancellationDetailDrawerProps {
  /** The cancellation row id open in the drawer; null = closed. */
  cancellationId: string | null;
  onClose: () => void;
}

export interface CancellationDetailDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  isError: boolean;
  detail: CancellationDetailView | null;
  /** Opens the order behind the request; absent when that order is not one we hold. */
  onViewOrder?: () => void;
  onOpenOnEbay?: () => void;
  /** Asks for confirmation; the answer itself is sent from the confirm dialog. */
  onRequestAction: (action: EbayCancellationAction) => void;
  /** The answer awaiting confirmation, or null. */
  pendingAction: EbayCancellationAction | null;
  /** Localized description for the confirm dialog of `pendingAction`. */
  confirmDescription: string;
  onConfirmAction: () => void;
  onCancelAction: () => void;
  isActing: boolean;
}
