export interface AmazonMatchCandidate {
  asin?: string;
  quantity: number;
  grandTotal: number;
  orderDate: string; // ISO date
}
export interface EbayMatchCandidate {
  asin?: string;
  quantity: number;
  saleTotal: number;
  orderDate: string; // ISO date
}
export interface ScoreInput {
  amazon: AmazonMatchCandidate;
  ebay: EbayMatchCandidate;
  tolerancePct: number;
  windowDays: number;
}
export interface ScoreResult {
  match: boolean;
  score: number;
}

const DAY_MS = 86_400_000;

/**
 * Strict multi-signal matcher. Requires ALL of: same ASIN, same quantity,
 * amount within tolerance, date within window. Any miss -> no match (never
 * force-link, to avoid wrong cost attribution).
 */
export function scoreAmazonOrderMatch(input: ScoreInput): ScoreResult {
  const { amazon, ebay, tolerancePct, windowDays } = input;
  let score = 0;

  if (!amazon.asin || !ebay.asin || amazon.asin !== ebay.asin) {
    return { match: false, score: 0 };
  }
  score += 40;

  if (amazon.quantity !== ebay.quantity) {
    return { match: false, score: 0 };
  }
  score += 20;

  const ref = Math.max(amazon.grandTotal, ebay.saleTotal) || 1;
  const diffPct = (Math.abs(amazon.grandTotal - ebay.saleTotal) / ref) * 100;
  if (diffPct > tolerancePct) {
    return { match: false, score: 0 };
  }
  score += Math.round(40 * (1 - diffPct / 100));

  const aTime = new Date(amazon.orderDate).getTime();
  const eTime = new Date(ebay.orderDate).getTime();
  if (Number.isNaN(aTime) || Number.isNaN(eTime)) {
    return { match: false, score: 0 };
  }
  const dayDiff = Math.abs(aTime - eTime) / DAY_MS;
  if (dayDiff > windowDays) {
    return { match: false, score: 0 };
  }
  score += Math.max(0, 20 - Math.round(dayDiff));

  return { match: true, score };
}
