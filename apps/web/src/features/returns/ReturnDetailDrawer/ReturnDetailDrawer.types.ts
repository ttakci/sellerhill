import type { EbayReturnAction, ReturnLabelCarrier } from '@repo/shared';
import type { SelectOption } from '@repo/ui';
import type React from 'react';

import type { ReturnDetailView } from '../returns.types';

import type { OrderCardProps } from '@/features/orders/shared/OrderCard';

export interface ReturnDetailDrawerProps {
  /** The return row id open in the drawer; null = closed. */
  returnId: string | null;
  onClose: () => void;
}

/** One radio of the answer form — the action and its already-translated label. */
export interface ReturnChoiceView {
  action: EbayReturnAction;
  label: string;
}

/** Which label field the seller left empty or got wrong — flagged red after Send. */
export interface ReturnLabelErrors {
  file: string | null;
  carrier: string | null;
  carrierName: string | null;
  tracking: string | null;
}

export interface ReturnDetailDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  isError: boolean;
  detail: ReturnDetailView | null;
  /** The radios, in eBay's order (approve → label → mark received → refund). */
  choices: ReturnChoiceView[];
  /** The action picked on the form, or null. */
  choice: EbayReturnAction | null;
  onChoiceChange: (value: string) => void;
  /** True after Send was pressed with nothing picked. */
  choiceMissing: boolean;
  /** "Upload a label" only — the chosen file's name, the carrier, its name for Other, the tracking number. */
  labelFileName: string;
  onLabelFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  carrier: ReturnLabelCarrier | null;
  carrierOptions: SelectOption[];
  onCarrierChange: (value: string | number) => void;
  carrierName: string;
  onCarrierNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  tracking: string;
  onTrackingChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  labelErrors: ReturnLabelErrors;
  onSend: () => void;
  isActing: boolean;
  /** The order card's facts (order no, buyer, quantity, type, dates, ASIN, eBay ID). */
  orderMeta: OrderCardProps['meta'];
  /** The order card's figures row — the money of the return. */
  orderStats: OrderCardProps['stats'];
  /** Opens our order page; absent when the order is not one we hold. */
  onOpenOrder?: () => void;
}
