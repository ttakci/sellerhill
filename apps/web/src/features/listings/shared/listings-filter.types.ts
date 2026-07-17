export interface NumericRange {
  min: string;
  max: string;
}

export interface ListingsFilterState {
  search: string;
  category: string;
  /** Only active | inactive (empty = both operational statuses). Draft/error/retrying not used in list UI. */
  status: string;
  /** Connected eBay store id */
  ebayAccountId: string;
  price: NumericRange;
  purchasePrice: NumericRange;
  estimatedProfit: NumericRange;
  roi: NumericRange;
  profitMargin: NumericRange;
  soldCount: NumericRange;
  watchCount: NumericRange;
  viewCount: NumericRange;
  quantity: NumericRange;
  sourceStock: NumericRange;
}
