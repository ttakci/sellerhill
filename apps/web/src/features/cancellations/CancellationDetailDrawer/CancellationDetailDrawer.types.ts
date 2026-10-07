import type { EbayCancellationAction } from '@repo/shared';
import type React from 'react';


import type { CancellationDetailView } from '../cancellations.types';

import type { OrderCardProps } from '@/features/orders/shared/OrderCard';

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
  /** BCP-47 locale for the shipment date picker. */
  locale: string;
  /** The answer picked on the form (eBay's own Accept / Decline choice), or null. */
  choice: EbayCancellationAction | null;
  onChoiceChange: (value: string) => void;
  /** Decline only — the day the order shipped (`yyyy-mm-dd`, optional). */
  shipDate: string;
  onShipDateChange: (value: string) => void;
  /** Decline only — the tracking number (optional). */
  tracking: string;
  onTrackingChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** True after Send was pressed with no answer picked. */
  choiceMissing: boolean;
  onSend: () => void;
  isActing: boolean;
  /** The order card's facts (order no linked to eBay, buyer, dates, ASIN, eBay ID). */
  orderMeta: OrderCardProps['meta'];
  /** The order card's figures row — the money of the request. */
  orderStats: OrderCardProps['stats'];
  /** Opens our order page; absent when the order is not one we hold. */
  onOpenOrder?: () => void;
}
