// apps/api/src/modules/ebay-returns/return-mapper.spec.ts
//
// Fixtures use only fields and enumeration values that appear in eBay's own
// reference (docs/ebay-reference/post-order/post-order_v2_return_search__get.txt
// and post-order/types/*.txt).

import { mapReturnSummary } from './return-mapper';

const fullMember = {
  returnId: '5000000002',
  orderId: '12-34567-89012',
  state: 'RETURN_REQUESTED',
  status: 'RETURN_REQUESTED',
  currentType: 'MONEY_BACK',
  buyerLoginName: 'buyer_one',
  sellerLoginName: 'seller_one',
  creationInfo: {
    comments: { content: 'The box arrived crushed.', language: 'en' },
    creationDate: { value: '2015-08-05T20:18:17.000Z' },
    item: { itemId: '110000000006', transactionId: '800000009', returnQuantity: 1 },
    reason: 'ARRIVED_DAMAGED',
    reasonType: 'SNAD',
    type: 'MONEY_BACK',
  },
  sellerResponseDue: {
    activityDue: 'SELLER_APPROVE_REQUEST',
    respondByDate: { value: '2015-08-09T20:18:17.000Z' },
  },
  sellerTotalRefund: {
    estimatedRefundAmount: { value: 27.5, currency: 'USD' },
    actualRefundAmount: { value: 20, currency: 'USD' },
  },
  buyerTotalRefund: { estimatedRefundAmount: { value: 99, currency: 'EUR' } },
  escalationInfo: { caseId: '5100000001' },
  sellerAvailableOptions: [{ actionType: 'SELLER_APPROVE_REQUEST' }],
};

describe('mapReturnSummary', () => {
  it('maps a fully populated documented member onto the ebay_returns columns', () => {
    expect(mapReturnSummary(fullMember)).toEqual({
      returnId: '5000000002',
      ebayOrderId: '12-34567-89012',
      ebayItemId: '110000000006',
      ebayTransactionId: '800000009',
      returnQuantity: 1,
      state: 'RETURN_REQUESTED',
      status: 'RETURN_REQUESTED',
      currentType: 'MONEY_BACK',
      reason: 'ARRIVED_DAMAGED',
      reasonType: 'SNAD',
      buyerComment: 'The box arrived crushed.',
      buyerLoginName: 'buyer_one',
      sellerActivityDue: 'SELLER_APPROVE_REQUEST',
      sellerRespondBy: '2015-08-09T20:18:17.000Z',
      estimatedRefundAmount: 27.5,
      actualRefundAmount: 20,
      currency: 'USD',
      escalationCaseId: '5100000001',
      createdOnEbayAt: '2015-08-05T20:18:17.000Z',
    });
  });

  it('reads the SELLER refund, never the buyer one', () => {
    const row = mapReturnSummary({
      returnId: '1',
      buyerTotalRefund: { estimatedRefundAmount: { value: 99, currency: 'EUR' } },
    });
    expect(row?.estimatedRefundAmount).toBeNull();
    expect(row?.currency).toBeNull();
  });

  it('maps every missing container to null', () => {
    expect(mapReturnSummary({ returnId: '5000000003' })).toEqual({
      returnId: '5000000003',
      ebayOrderId: null,
      ebayItemId: null,
      ebayTransactionId: null,
      returnQuantity: null,
      state: null,
      status: null,
      currentType: null,
      reason: null,
      reasonType: null,
      buyerComment: null,
      buyerLoginName: null,
      sellerActivityDue: null,
      sellerRespondBy: null,
      estimatedRefundAmount: null,
      actualRefundAmount: null,
      currency: null,
      escalationCaseId: null,
      createdOnEbayAt: null,
    });
  });

  it('maps partially present containers without throwing', () => {
    const row = mapReturnSummary({
      returnId: '7',
      creationInfo: { item: {} },
      sellerResponseDue: { activityDue: 'SELLER_ISSUE_REFUND' },
      sellerTotalRefund: { estimatedRefundAmount: {} },
      escalationInfo: {},
    });
    expect(row).toMatchObject({
      ebayItemId: null,
      returnQuantity: null,
      sellerActivityDue: 'SELLER_ISSUE_REFUND',
      sellerRespondBy: null,
      estimatedRefundAmount: null,
      escalationCaseId: null,
    });
  });

  it.each([
    ['no returnId', { orderId: '12-34567-89012', state: 'CLOSED' }],
    ['an empty returnId', { returnId: '   ' }],
    ['a null returnId', { returnId: null }],
    ['an object returnId', { returnId: { value: '1' } }],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'return'],
    ['an array', [{ returnId: '1' }]],
  ])('returns null for %s', (_label, member) => {
    expect(mapReturnSummary(member)).toBeNull();
  });

  it('keeps an id eBay serialised as a number', () => {
    const row = mapReturnSummary({ returnId: 5000000004, creationInfo: { item: { itemId: 110000000006 } } });
    expect(row?.returnId).toBe('5000000004');
    expect(row?.ebayItemId).toBe('110000000006');
  });

  it('parses numbers given as numeric strings', () => {
    const row = mapReturnSummary({
      returnId: '8',
      creationInfo: { item: { returnQuantity: '2' } },
      sellerTotalRefund: {
        estimatedRefundAmount: { value: '27.50', currency: 'usd' },
        actualRefundAmount: { value: ' 10 ' },
      },
    });
    expect(row?.returnQuantity).toBe(2);
    expect(row?.estimatedRefundAmount).toBe(27.5);
    expect(row?.actualRefundAmount).toBe(10);
    expect(row?.currency).toBe('USD');
  });

  it('keeps a real zero amount apart from a missing one', () => {
    const row = mapReturnSummary({
      returnId: '9',
      sellerTotalRefund: { estimatedRefundAmount: { value: 0, currency: 'USD' } },
    });
    expect(row?.estimatedRefundAmount).toBe(0);
    expect(row?.actualRefundAmount).toBeNull();
  });

  it.each([
    ['text', 'abc'],
    ['an empty string', ''],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['an object', { amount: 1 }],
    ['a boolean', true],
  ])('maps a non-numeric amount (%s) to null', (_label, value) => {
    const row = mapReturnSummary({ returnId: '10', sellerTotalRefund: { estimatedRefundAmount: { value } } });
    expect(row?.estimatedRefundAmount).toBeNull();
  });

  it.each([
    ['a fraction', 1.5],
    ['a negative', -1],
    ['text', 'two'],
    ['beyond a Postgres integer', 3_000_000_000],
  ])('maps a returnQuantity that is not a whole quantity (%s) to null', (_label, returnQuantity) => {
    const row = mapReturnSummary({ returnId: '11', creationInfo: { item: { returnQuantity } } });
    expect(row?.returnQuantity).toBeNull();
  });

  it.each([
    ['text', 'not-a-date'],
    ['an empty string', ''],
    ['a number', 1438805897000],
    ['an impossible date', '2015-13-45T99:99:99.000Z'],
    ['null', null],
  ])('maps an invalid date (%s) to null', (_label, value) => {
    const row = mapReturnSummary({
      returnId: '12',
      creationInfo: { creationDate: { value } },
      sellerResponseDue: { activityDue: 'SELLER_APPROVE_REQUEST', respondByDate: { value } },
    });
    expect(row?.createdOnEbayAt).toBeNull();
    expect(row?.sellerRespondBy).toBeNull();
    // The action is still due; only its deadline is unknown.
    expect(row?.sellerActivityDue).toBe('SELLER_APPROVE_REQUEST');
  });

  it('normalises a valid date to ISO 8601 UTC', () => {
    const row = mapReturnSummary({ returnId: '13', creationInfo: { creationDate: { value: '2021-05-15T03:52:39Z' } } });
    expect(row?.createdOnEbayAt).toBe('2021-05-15T03:52:39.000Z');
  });

  it('stores an enumeration value it has never seen, unchanged', () => {
    const row = mapReturnSummary({
      returnId: '14',
      state: 'SOME_FUTURE_STATE',
      status: 'SOME_FUTURE_STATUS',
      creationInfo: { reason: 'SOME_FUTURE_REASON', reasonType: 'SOME_FUTURE_TYPE' },
      sellerResponseDue: { activityDue: 'SOME_FUTURE_ACTIVITY' },
    });
    expect(row).toMatchObject({
      state: 'SOME_FUTURE_STATE',
      status: 'SOME_FUTURE_STATUS',
      reason: 'SOME_FUTURE_REASON',
      reasonType: 'SOME_FUTURE_TYPE',
      sellerActivityDue: 'SOME_FUTURE_ACTIVITY',
    });
  });

  it('never stores an empty string where eBay sent a blank value', () => {
    const row = mapReturnSummary({
      returnId: '15',
      state: '',
      buyerLoginName: '  ',
      creationInfo: { comments: { content: '   ' } },
      sellerResponseDue: { activityDue: '' },
    });
    expect(row?.state).toBeNull();
    expect(row?.buyerLoginName).toBeNull();
    expect(row?.buyerComment).toBeNull();
    // An empty string here would read as "an action is due" in the SQL bucket.
    expect(row?.sellerActivityDue).toBeNull();
  });

  it('does not store a currency that is not a three-letter code', () => {
    const row = mapReturnSummary({
      returnId: '16',
      sellerTotalRefund: { estimatedRefundAmount: { value: 5, currency: 'US Dollar' } },
    });
    expect(row?.estimatedRefundAmount).toBe(5);
    expect(row?.currency).toBeNull();
  });

  it('falls back to the actual amount’s currency when the estimate carries none', () => {
    const row = mapReturnSummary({
      returnId: '17',
      sellerTotalRefund: { actualRefundAmount: { value: 5, currency: 'GBP' } },
    });
    expect(row?.currency).toBe('GBP');
  });

  it('never throws on hostile shapes', () => {
    const hostile: unknown[] = [
      { returnId: '18', creationInfo: 'x', sellerResponseDue: 5, sellerTotalRefund: [], escalationInfo: null },
      { returnId: '19', creationInfo: { item: 'x', comments: 7, creationDate: [] } },
      { returnId: '20', sellerResponseDue: { respondByDate: 'soon' } },
    ];
    for (const member of hostile) {
      expect(() => mapReturnSummary(member)).not.toThrow();
      expect(mapReturnSummary(member)).not.toBeNull();
    }
  });
});
