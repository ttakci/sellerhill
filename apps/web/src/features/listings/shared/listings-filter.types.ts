export interface NumericRange {
  min: string;
  max: string;
}

export interface ListingsFilterState {
  search: string;
  category: string;
  status: string;
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
