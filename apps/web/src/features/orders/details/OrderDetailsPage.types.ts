import type { OrderDto } from '@repo/shared';

export interface OrderDetailsPageProps {
  order: OrderDto | undefined;
  isLoading: boolean;
  isUpdating: boolean;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
  statusLabel: string;
  roiLabel: string;
  totalAmazonCost: number;
  onBack: () => void;
  onCopyAddress: () => void;
  onOpenLinkAmazon: () => void;
  onOpenAmazonOrderUrl?: () => void;
  /**
   * Whether this order's tracking can still be converted: Amazon has given us a
   * number, it has not already been converted, and nothing has been pushed to
   * eBay yet. A conversion is paid for, so offering the action on an
   * already-converted order would invite paying twice for one shipment — and
   * eBay's Fulfillment API has no update endpoint, so offering it once the raw
   * number is already on eBay would offer an action that can no longer help.
   */
  canConvertTracking: boolean;
  isConvertingTracking: boolean;
  onConvertTracking?: () => void;
  canCopyAddress: boolean;
}
