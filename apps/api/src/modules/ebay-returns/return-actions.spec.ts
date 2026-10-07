import {
  EbayReturnAction,
  isEbayReturnAction,
  resolveReturnActions,
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
    // eBay asks for a label: the seller uploads one, or says one was already sent.
    expect(resolveReturnActions(['SELLER_PROVIDE_LABEL', 'SELLER_ISSUE_REFUND'], true)).toEqual([
      EbayReturnAction.PROVIDE_LABEL,
      EbayReturnAction.MARK_LABEL_SENT,
      EbayReturnAction.ISSUE_REFUND,
    ]);
  });

  it('maps every action to a documented ActivityOptionEnum value', () => {
    expect(RETURN_ACTION_EBAY_OPTION).toEqual({
      approve: 'SELLER_APPROVE_REQUEST',
      provide_label: 'SELLER_PROVIDE_LABEL',
      mark_label_sent: 'SELLER_PROVIDE_LABEL',
      mark_received: 'SELLER_MARK_AS_RECEIVED',
      issue_refund: 'SELLER_ISSUE_REFUND',
    });
  });

  it('recognises only the in-app action values', () => {
    expect(isEbayReturnAction('approve')).toBe(true);
    expect(isEbayReturnAction('provide_label')).toBe(true);
    expect(isEbayReturnAction('decline')).toBe(false);
    expect(isEbayReturnAction(undefined)).toBe(false);
  });
});
