import {
  EbayReturnAction,
  isEbayReturnAction,
  resolveReturnActions,
  resolveReturnOptionsOnEbay,
  RETURN_ACTION_EBAY_OPTION,
} from '@repo/shared';

describe('resolveReturnActions', () => {
  const ALL = ['SELLER_APPROVE_REQUEST', 'SELLER_DECLINE_REQUEST', 'SELLER_MARK_AS_RECEIVED', 'SELLER_ISSUE_REFUND', 'SELLER_SEND_MESSAGE'];

  it('offers nothing while the operator switch is off', () => {
    expect(resolveReturnActions(ALL, false)).toEqual([]);
  });

  it('offers exactly the in-app actions eBay lists, in a fixed order', () => {
    expect(resolveReturnActions(['SELLER_ISSUE_REFUND', 'SELLER_APPROVE_REQUEST'], true)).toEqual([
      EbayReturnAction.APPROVE,
      EbayReturnAction.ISSUE_REFUND,
    ]);
    expect(resolveReturnActions(['SELLER_MARK_AS_RECEIVED'], true)).toEqual([EbayReturnAction.MARK_RECEIVED]);
    expect(resolveReturnActions(['SELLER_DECLINE_REQUEST'], true)).toEqual([]);
  });

  it('names the eBay options nothing in-app covers', () => {
    expect(resolveReturnOptionsOnEbay(ALL)).toEqual(['SELLER_DECLINE_REQUEST', 'SELLER_SEND_MESSAGE']);
  });

  it('maps every action to a documented ActivityOptionEnum value', () => {
    expect(RETURN_ACTION_EBAY_OPTION).toEqual({
      approve: 'SELLER_APPROVE_REQUEST',
      mark_received: 'SELLER_MARK_AS_RECEIVED',
      issue_refund: 'SELLER_ISSUE_REFUND',
    });
  });

  it('recognises only the three action values', () => {
    expect(isEbayReturnAction('approve')).toBe(true);
    expect(isEbayReturnAction('decline')).toBe(false);
    expect(isEbayReturnAction(undefined)).toBe(false);
  });
});
