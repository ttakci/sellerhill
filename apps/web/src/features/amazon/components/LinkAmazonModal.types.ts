export interface LinkResult {
  success: boolean;
  message: string;
  linked?: boolean;
  reason?: 'cost_capture_failed';
}

export interface LinkAmazonModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  /**
   * Whether the order is linked to one of our listings (`OrderDto.product` is
   * populated exactly when `orders.listing_id` is set).
   *
   * False means the eBay listing was never imported here. Linking the Amazon
   * order still captures real costs, but the shipped transition resolves the
   * eBay line item from the listing — without one the tracking push is refused
   * as permanently unpushable and never retried, so the buyer never gets a
   * tracking number. Hence the warning before the form.
   */
  hasListing: boolean;
  onLinked: () => void;
}
