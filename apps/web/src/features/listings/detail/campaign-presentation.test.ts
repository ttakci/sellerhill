import { describe, expect, it } from 'vitest';

import { listingCampaignPresentation } from './campaign-presentation';

const campaign = {
  campaignId: '123',
  name: 'Spring',
  status: 'RUNNING',
  fundingModel: 'COST_PER_SALE',
  adRateStrategy: 'FIXED',
  adRate: 5,
  appliedAdRate: 5,
};

describe('listingCampaignPresentation', () => {
  it('returns null without an association', () => {
    expect(listingCampaignPresentation({ adCampaign: null })).toBeNull();
    expect(listingCampaignPresentation({})).toBeNull();
  });

  it('links an active fixed-rate campaign with no note', () => {
    expect(listingCampaignPresentation({ adCampaign: campaign })).toEqual({
      campaignId: '123',
      name: 'Spring',
      rate: 5,
      note: null,
    });
  });

  it('explains a dynamic strategy as not followed', () => {
    const dynamic = { ...campaign, adRateStrategy: 'DYNAMIC', adRate: null, appliedAdRate: 0 };
    expect(listingCampaignPresentation({ adCampaign: dynamic })?.note).toBe('not-followed');
    expect(listingCampaignPresentation({ adCampaign: { ...campaign, status: 'PAUSED' } })?.note).toBe('not-followed');
  });

  it('reads a margin override from the override fields, even with a nonzero applied rate', () => {
    expect(listingCampaignPresentation({ adCampaign: campaign, marginPercentOverride: 12 })?.note).toBe(
      'margin-override'
    );
    expect(listingCampaignPresentation({ adCampaign: campaign, marginFixedOverride: 1.5 })?.note).toBe(
      'margin-override'
    );
    expect(listingCampaignPresentation({ adCampaign: campaign, marginPercentOverride: null })?.note).toBeNull();
  });
});
