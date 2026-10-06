import { describe, expect, it } from 'vitest';

import { formatCampaignMetric, sumCampaignMetric, aggregateCampaignRoas } from './CampaignList.helpers';

describe('honest campaign metrics', () => {
  it('keeps missing and nonfinite values unavailable, but preserves explicit zero', () => {
    expect(formatCampaignMetric(null, 'currency')).toBe('—');
    expect(formatCampaignMetric({ sales: 0 }, 'currency', 'sales')).toBe('$0.00');
    expect(formatCampaignMetric({}, 'currency', 'sales')).toBe('—');
    expect(formatCampaignMetric({ sales: Infinity }, 'currency', 'sales')).toBe('—');
    expect(formatCampaignMetric({ clicks: 0 }, 'number', 'clicks')).toBe('0');
  });
  it('requires every included campaign to provide a value', () => {
    expect(sumCampaignMetric([{ metrics: { sales: 3 } }, { metrics: null }], 'sales')).toBeNull();
    expect(sumCampaignMetric([{ metrics: { sales: 3 } }, { metrics: {} }], 'sales')).toBeNull();
    expect(sumCampaignMetric([], 'sales')).toBeNull();
    expect(sumCampaignMetric([{ metrics: { sales: 3 } }, { metrics: { sales: 0 } }], 'sales')).toBe(3);
  });
  it('derives ROAS from complete sales and fees totals rather than campaign ratios', () => {
    expect(
      aggregateCampaignRoas([
        { metrics: { sales: 100, adFees: 10, roas: 10 } },
        { metrics: { sales: 20, adFees: 10, roas: 2 } },
      ])
    ).toBe(6);
    expect(aggregateCampaignRoas([{ metrics: { sales: 0, adFees: 10 } }])).toBe(0);
    expect(aggregateCampaignRoas([{ metrics: { sales: 3, adFees: 0 } }])).toBeNull();
    expect(aggregateCampaignRoas([{ metrics: { sales: 3 } }])).toBeNull();
  });
});
