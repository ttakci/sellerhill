import { SourceStockStatus } from '../domain/products/source-product.types';

/**
 * The single place Amazon stock becomes display text. AT_LEAST means "at
 * least this many" (Amazon shows no count above 20, or the seller's order
 * limit hides it), so it renders as `N+`; every other status is a real count.
 */
export function formatSourceStock(
  stock: number | null | undefined,
  status: SourceStockStatus | null | undefined,
): string {
  if (stock === null || stock === undefined) {
    return '—';
  }
  return status === SourceStockStatus.AT_LEAST ? `${stock}+` : String(stock);
}
