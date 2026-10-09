import { describe, expect, it } from 'vitest';

import {
  aggregateCampaignRoas,
  filterCampaigns,
  formatCampaignMetric,
  sortCampaigns,
  sumCampaignMetric,
} from './CampaignList.helpers';
import { CampaignSortKey, CampaignTab } from './CampaignsPage.types';

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

describe('campaign list filter and sort', () => {
  const rows = [
    { campaignId: 'c1', name: 'Summer', status: 'RUNNING', metrics: { sales: 10, adFees: 5 } },
    { campaignId: 'c2', name: 'autumn', status: 'PAUSED', metrics: null },
    { campaignId: 'c3', name: 'Winter', status: 'ENDED', metrics: { sales: 40, adFees: 4 } },
    { campaignId: 'c4', name: 'Spring', status: 'SCHEDULED', metrics: { sales: 10, adFees: 1 } },
  ];
  const ids = (list: { campaignId: string }[]) => list.map((row) => row.campaignId);

  it('keeps a status with no tab of its own under All only', () => {
    expect(ids(filterCampaigns(rows, CampaignTab.ALL, ''))).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(ids(filterCampaigns(rows, CampaignTab.RUNNING, ''))).toEqual(['c1']);
    expect(ids(filterCampaigns(rows, CampaignTab.ENDED, ''))).toEqual(['c3']);
  });
  it('searches name and id without case', () => {
    expect(ids(filterCampaigns(rows, CampaignTab.ALL, ' AUT '))).toEqual(['c2']);
    expect(ids(filterCampaigns(rows, CampaignTab.ALL, 'c3'))).toEqual(['c3']);
  });
  it('sorts unknown figures last in both directions and keeps ties in API order', () => {
    expect(ids(sortCampaigns(rows, CampaignSortKey.SALES, 'desc'))).toEqual(['c3', 'c1', 'c4', 'c2']);
    expect(ids(sortCampaigns(rows, CampaignSortKey.SALES, 'asc'))).toEqual(['c1', 'c4', 'c3', 'c2']);
    expect(ids(sortCampaigns(rows, CampaignSortKey.ROAS, 'desc'))).toEqual(['c3', 'c4', 'c1', 'c2']);
    expect(ids(sortCampaigns(rows, CampaignSortKey.NAME, 'asc'))).toEqual(['c2', 'c4', 'c1', 'c3']);
  });
});
