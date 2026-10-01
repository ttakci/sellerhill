import { mapReturnDetail } from './return-detail-mapper';

const DETAIL = {
  returnId: '5000000001',
  orderId: '12-34567-89012',
  state: 'RETURN_REQUESTED',
  status: 'RETURN_REQUESTED',
  currentType: 'MONEY_BACK',
  buyerLoginName: 'buyer_one',
  creationInfo: {
    item: { itemId: '110000000006', transactionId: '7', returnQuantity: 1 },
    reason: 'ARRIVED_DAMAGED',
    reasonType: 'SNAD',
    comments: { content: 'The box arrived crushed.' },
    creationDate: { value: '2026-09-28T10:00:00.000Z' },
  },
  sellerResponseDue: { activityDue: 'SELLER_APPROVE_REQUEST', respondByDate: { value: '2026-10-03T10:00:00.000Z' } },
  sellerTotalRefund: { estimatedRefundAmount: { value: 27.5, currency: 'USD' } },
  sellerAvailableOptions: [
    { actionType: 'SELLER_APPROVE_REQUEST', actionURL: 'https://www.ebay.com/rtn/Return/ReturnDetails?returnId=5000000001' },
    { actionType: 'SELLER_DECLINE_REQUEST', actionURL: 'http://insecure.example/x' },
    { actionType: 'SELLER_APPROVE_REQUEST' },
    { actionType: '' },
  ],
  responseHistory: [
    {
      activity: 'SELLER_APPROVE_REQUEST',
      author: 'seller_x',
      creationDate: { value: '2026-09-29T10:00:00.000Z' },
      fromState: 'RETURN_REQUESTED',
      toState: 'ITEM_READY_TO_SHIP',
      notes: ' approved ',
      attributes: { RMA: 'RMA-1', partialRefundAmount: { value: 5, currency: 'USD' } },
    },
    {
      activity: 'BUYER_CREATE_RETURN',
      author: 'buyer_one',
      creationDate: { value: '2026-09-28T10:00:00.000Z' },
    },
    'not an entry',
  ],
  returnShipmentInfo: {
    allShipmentTrackings: [
      {
        carrierName: 'USPS',
        trackingNumber: '9400111111111111111111',
        actualShipDate: { value: '2026-09-30T08:00:00.000Z' },
        deliveryStatus: 'IN_TRANSIT',
        markAsReceived: false,
        labelId: 'LBL1',
      },
    ],
  },
  closeInfo: { returnCloseReason: 'REFUND_ISSUED', returnCloseDate: { value: '2026-10-05T10:00:00.000Z' } },
  itemDetail: { itemPrice: { value: '24.99', currency: 'USD' } },
};

describe('mapReturnDetail', () => {
  it('maps the row through the summary mapper and the live-only parts beside it', () => {
    const mapped = mapReturnDetail(DETAIL);
    expect(mapped).not.toBeNull();
    expect(mapped!.row.returnId).toBe('5000000001');
    expect(mapped!.row.sellerActivityDue).toBe('SELLER_APPROVE_REQUEST');
    expect(mapped!.row.estimatedRefundAmount).toBe(27.5);
    expect(mapped!.returnType).toBe('MONEY_BACK');
    expect(mapped!.itemPrice).toBe(24.99);
    expect(mapped!.closeReason).toBe('REFUND_ISSUED');
    expect(mapped!.closedAt).toBe('2026-10-05T10:00:00.000Z');
  });

  it('keeps every option once, in order, and only an https action URL', () => {
    const mapped = mapReturnDetail(DETAIL)!;
    expect(mapped.options).toEqual(['SELLER_APPROVE_REQUEST', 'SELLER_DECLINE_REQUEST']);
    expect(mapped.actionUrl).toBe('https://www.ebay.com/rtn/Return/ReturnDetails?returnId=5000000001');
  });

  it('orders the history oldest first and drops entries that are not objects', () => {
    const history = mapReturnDetail(DETAIL)!.history;
    expect(history.map((h) => h.activity)).toEqual(['BUYER_CREATE_RETURN', 'SELLER_APPROVE_REQUEST']);
    expect(history[1]).toMatchObject({
      author: 'seller_x',
      fromState: 'RETURN_REQUESTED',
      toState: 'ITEM_READY_TO_SHIP',
      notes: 'approved',
      rma: 'RMA-1',
      partialRefundAmount: 5,
      trackingNumber: null,
    });
  });

  it('maps the return shipments', () => {
    expect(mapReturnDetail(DETAIL)!.shipments).toEqual([
      {
        trackingNumber: '9400111111111111111111',
        carrier: 'USPS',
        shippedAt: '2026-09-30T08:00:00.000Z',
        deliveredAt: null,
        deliveryStatus: 'IN_TRANSIT',
        markedReceived: false,
        labelId: 'LBL1',
      },
    ]);
  });

  it('is total: a detail with only a returnId maps to empty parts, no returnId maps to null', () => {
    const minimal = mapReturnDetail({ returnId: 42 })!;
    expect(minimal.row.returnId).toBe('42');
    expect(minimal.history).toEqual([]);
    expect(minimal.shipments).toEqual([]);
    expect(minimal.options).toEqual([]);
    expect(minimal.actionUrl).toBeNull();
    expect(mapReturnDetail({ state: 'CLOSED' })).toBeNull();
    expect(mapReturnDetail(null)).toBeNull();
  });
});
