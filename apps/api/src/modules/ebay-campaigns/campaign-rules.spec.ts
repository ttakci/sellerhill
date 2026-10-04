import {
  CampaignReadOnlyReason,
  EbayAdRateStrategy,
  EbayCampaignFundingModel,
  EbayCampaignStatus,
  campaignReadOnlyReason,
  isValidBidPercentage,
  resolveAppliedAdRate,
} from '@repo/shared';

const base = {
  rate: 5.5,
  strategy: EbayAdRateStrategy.FIXED,
  fundingModel: EbayCampaignFundingModel.COST_PER_SALE,
  campaignStatus: EbayCampaignStatus.RUNNING,
};

describe('resolveAppliedAdRate', () => {
  it('a running fixed cost-per-sale ad applies its rate', () => {
    expect(resolveAppliedAdRate(base)).toBe(5.5);
    expect(resolveAppliedAdRate({ ...base, rate: '7.0' })).toBe(7);
  });
  it('an omitted strategy is eBay’s default, FIXED', () => {
    expect(resolveAppliedAdRate({ ...base, strategy: null })).toBe(5.5);
  });
  it('paused, ended, dynamic, cost-per-click or no ad apply nothing', () => {
    expect(resolveAppliedAdRate({ ...base, campaignStatus: EbayCampaignStatus.PAUSED })).toBe(0);
    expect(resolveAppliedAdRate({ ...base, campaignStatus: EbayCampaignStatus.ENDED })).toBe(0);
    expect(resolveAppliedAdRate({ ...base, strategy: EbayAdRateStrategy.DYNAMIC })).toBe(0);
    expect(resolveAppliedAdRate({ ...base, fundingModel: EbayCampaignFundingModel.COST_PER_CLICK })).toBe(0);
    expect(resolveAppliedAdRate({ ...base, rate: null })).toBe(0);
    expect(resolveAppliedAdRate({ ...base, campaignStatus: null })).toBe(0);
  });
  it('a rate outside eBay’s bounds is never applied', () => {
    expect(resolveAppliedAdRate({ ...base, rate: 1.9 })).toBe(0);
    expect(resolveAppliedAdRate({ ...base, rate: 100.1 })).toBe(0);
    expect(resolveAppliedAdRate({ ...base, rate: 'abc' })).toBe(0);
  });
});

describe('campaignReadOnlyReason', () => {
  const c = { status: 'RUNNING', fundingModel: 'COST_PER_SALE', adRateStrategy: null, ruleBased: false };
  it('a manual fixed cost-per-sale campaign is editable', () => expect(campaignReadOnlyReason(c)).toBeNull());
  it('names why the others are read-only', () => {
    expect(campaignReadOnlyReason({ ...c, ruleBased: true })).toBe(CampaignReadOnlyReason.RULE_BASED);
    expect(campaignReadOnlyReason({ ...c, fundingModel: 'COST_PER_CLICK' })).toBe(CampaignReadOnlyReason.COST_PER_CLICK);
    expect(campaignReadOnlyReason({ ...c, adRateStrategy: 'DYNAMIC' })).toBe(CampaignReadOnlyReason.DYNAMIC_RATE);
    expect(campaignReadOnlyReason({ ...c, status: 'ENDED' })).toBe(CampaignReadOnlyReason.ENDED);
  });
});

describe('isValidBidPercentage', () => {
  it.each([2, 2.0, 5.5, 100])('accepts %p', (v) => expect(isValidBidPercentage(v)).toBe(true));
  it.each([1.9, 100.1, 5.55, NaN, '5', null])('refuses %p', (v) => expect(isValidBidPercentage(v)).toBe(false));
});
