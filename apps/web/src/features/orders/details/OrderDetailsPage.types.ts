import type { OrderDto } from '@repo/shared';

import type { OrderTimelineRow } from '../shared/order-timeline.types';

export interface OrderDetailsPageProps {
  order: OrderDto | undefined;
  isLoading: boolean;
  isUpdating: boolean;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
  /** eBay's own order status, localized — shown as a fact in the eBay card. */
  statusLabel: string;
  /**
   * The order's steps (received → bought → shipped → tracking on eBay →
   * delivered), resolved for display. The step the order is standing on
   * carries the stage's meaning, its action and the automatic-purchase reason
   * — which is why the hero no longer prints them as loose sentences.
   */
  timelineRows: OrderTimelineRow[];
  roiLabel: string;
  /** Net margin on the sale (profit ÷ sale price), formatted; null when the sale is zero. */
  marginLabel: string | null;
  totalAmazonCost: number;
  /** Amazon's "Total before tax" line: item subtotal + shipping & handling. */
  amazonTotalBeforeTax: number;
  /** The buyer's phone as eBay prints it (`+1 843-408-1812`), or null. */
  buyerPhoneDisplay: string | null;
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
  /**
   * `OrderDto.canStartAutoFulfill` — the automatic purchase stopped before
   * anything was bought and may be started again by hand.
   */
  canStartAutoFulfill: boolean;
  isStartingAutoFulfill: boolean;
  onStartAutoFulfill?: () => void;
  /**
   * The order is in the `purchase_unknown` stage: the Place Order click went
   * out and nothing confirmed it. The seller may declare it "not purchased" —
   * the server allows that only once it has scanned the Amazon account's
   * orders after the click.
   */
  canConfirmNotPurchased: boolean;
  isConfirmingNotPurchased: boolean;
  onConfirmNotPurchased?: () => void;
  /** eBay's ship-by date, formatted, while the seller still has to act; else null. */
  shipByLabel: string | null;
  /** The ship-by date is less than a day away, or already past. */
  isShipByUrgent: boolean;
  /** How many items the eBay order holds when it is more than one, else null. */
  multiItemCount: number | null;
  canCopyAddress: boolean;
}
