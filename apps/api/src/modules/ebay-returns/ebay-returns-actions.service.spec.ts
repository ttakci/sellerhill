import { EbayReturnAction, PlatformSettingKey, ReturnBucket, ReturnLabelCarrier } from '@repo/shared';

import {
  buildFullRefundBody,
  buildMarkLabelSentBody,
  buildUploadLabelBody,
  EbayReturnsActionsService,
  labelFileName,
  ReturnActionError,
  validateReturnActionInput,
  type ReturnActionInput,
} from './ebay-returns-actions.service';
import { PostOrderRejectedError } from './post-order.client';

const USER = '00000000-0000-4000-8000-00000000000a';
const ID = '22222222-2222-4222-8222-222222222222';
const ACCOUNT = '11111111-1111-4111-8111-11111111111a';

const detail = (options: string[], over: Record<string, unknown> = {}): Record<string, unknown> => ({
  returnId: '5000000001',
  state: 'RETURN_REQUESTED',
  status: 'RETURN_REQUESTED',
  sellerResponseDue: { activityDue: 'SELLER_APPROVE_REQUEST' },
  sellerTotalRefund: { estimatedRefundAmount: { value: 27.5, currency: 'USD' } },
  sellerAvailableOptions: options.map((actionType) => ({ actionType })),
  ...over,
});

type QueryMock = jest.Mock<Promise<unknown[]>, [string, unknown[]?]>;

function build(options: { enabled?: boolean; suspended?: boolean; sandbox?: boolean; live?: Record<string, unknown> } = {}) {
  const query: QueryMock = jest.fn<Promise<unknown[]>, [string, unknown[]?]>((sql) => {
    if (sql.includes('JOIN ebay_accounts ea')) {
      return Promise.resolve([{ id: ID, return_id: '5000000001', ebay_account_id: ACCOUNT, marketplace_id: 'EBAY_US' }]);
    }
    return Promise.resolve([]);
  });
  const postOrder = {
    isReturnSearchSupported: jest.fn(() => !(options.sandbox ?? false)),
    getReturn: jest.fn(() => Promise.resolve(options.live ?? detail(['SELLER_APPROVE_REQUEST']))),
    decideReturn: jest.fn(() => Promise.resolve({ refundStatus: 'PENDING' })),
    markReturnReceived: jest.fn(() => Promise.resolve()),
    issueReturnRefund: jest.fn(() => Promise.resolve({ refundStatus: 'SUCCESS' })),
    uploadReturnFile: jest.fn(() => Promise.resolve('FILE-1')),
    addReturnShippingLabel: jest.fn(() => Promise.resolve()),
  };
  const sync = { upsertReturn: jest.fn(() => Promise.resolve()) };
  const returns = {
    findOne: jest.fn(() =>
      Promise.resolve({
        id: ID,
        returnId: '5000000001',
        ebayAccountId: ACCOUNT,
        bucket: ReturnBucket.ACTION_DUE,
        currency: 'USD',
        estimatedRefundAmount: 27.5,
        actualRefundAmount: null,
        lastSyncedAt: new Date().toISOString(),
      })
    ),
  };
  const service = new EbayReturnsActionsService(
    { query } as never,
    { getBoolean: jest.fn((key: PlatformSettingKey) => Promise.resolve(key === PlatformSettingKey.EBAY_RETURNS_ACTIONS_ENABLED ? (options.enabled ?? true) : false)) } as never,
    { isSuspended: jest.fn(() => Promise.resolve(options.suspended ?? false)) } as never,
    { getAccountAccessToken: jest.fn(() => Promise.resolve('tok')) } as never,
    postOrder as never,
    returns as never,
    sync as never,
    { resolve: jest.fn(() => Promise.resolve({ intervalHours: 6 })) } as never
  );
  return { service, query, postOrder, sync };
}

const audits = (query: QueryMock): Array<[string, unknown[]?]> =>
  query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO audit_logs'));

describe('EbayReturnsActionsService.act', () => {
  it('refuses every action while the operator switch is off, before touching eBay', async () => {
    const { service, postOrder } = build({ enabled: false });
    await expect(service.act(USER, ID, EbayReturnAction.APPROVE)).rejects.toMatchObject({
      key: 'returns.errors.actionsDisabled',
      status: 409,
    });
    expect(postOrder.getReturn).not.toHaveBeenCalled();
    expect(postOrder.decideReturn).not.toHaveBeenCalled();
  });

  it('refuses a suspended account and a Sandbox deployment', async () => {
    await expect(build({ suspended: true }).service.act(USER, ID, EbayReturnAction.APPROVE)).rejects.toMatchObject({
      key: 'returns.errors.suspended',
    });
    await expect(build({ sandbox: true }).service.act(USER, ID, EbayReturnAction.APPROVE)).rejects.toMatchObject({
      key: 'returns.errors.sandbox',
    });
  });

  it('refuses an action eBay does not list on the LIVE return', async () => {
    const { service, postOrder } = build({ live: detail(['SELLER_DECLINE_REQUEST']) });
    await expect(service.act(USER, ID, EbayReturnAction.APPROVE)).rejects.toMatchObject({
      key: 'returns.errors.actionNotAvailable',
    });
    expect(postOrder.decideReturn).not.toHaveBeenCalled();
  });

  it('approves with the documented decision, audits it and re-reads the return into the row', async () => {
    const { service, query, postOrder, sync } = build();
    await expect(service.act(USER, ID, EbayReturnAction.APPROVE)).resolves.toEqual({
      action: EbayReturnAction.APPROVE,
      refundStatus: 'PENDING',
    });
    expect(postOrder.decideReturn).toHaveBeenCalledWith('tok', 'EBAY_US', '5000000001', { decision: 'APPROVE' });
    expect(audits(query)).toHaveLength(1);
    expect(String(audits(query)[0][1]?.[2])).toContain('"outcome":"sent"');
    expect(sync.upsertReturn).toHaveBeenCalledWith({ id: ACCOUNT, user_id: USER }, expect.objectContaining({ returnId: '5000000001' }));
  });

  it('refunds eBay’s own computed amount as one purchase-price line', async () => {
    const { service, postOrder } = build({ live: detail(['SELLER_ISSUE_REFUND']) });
    await service.act(USER, ID, EbayReturnAction.ISSUE_REFUND);
    expect(postOrder.issueReturnRefund).toHaveBeenCalledWith('tok', 'EBAY_US', '5000000001', {
      refundDetail: {
        itemizedRefundDetail: [{ refundAmount: { value: 27.5, currency: 'USD' }, refundFeeType: 'PURCHASE_PRICE' }],
        totalAmount: { value: 27.5, currency: 'USD' },
      },
    });
  });

  it('refuses a refund when eBay reported no amount', async () => {
    const { service, postOrder } = build({
      live: detail(['SELLER_ISSUE_REFUND'], { sellerTotalRefund: {} }),
    });
    await expect(service.act(USER, ID, EbayReturnAction.ISSUE_REFUND)).rejects.toMatchObject({
      key: 'returns.errors.refundAmountUnknown',
    });
    expect(postOrder.issueReturnRefund).not.toHaveBeenCalled();
  });

  it('marks received with an empty body', async () => {
    const { service, postOrder } = build({ live: detail(['SELLER_MARK_AS_RECEIVED']) });
    await expect(service.act(USER, ID, EbayReturnAction.MARK_RECEIVED)).resolves.toEqual({
      action: EbayReturnAction.MARK_RECEIVED,
      refundStatus: null,
    });
    expect(postOrder.markReturnReceived).toHaveBeenCalledWith('tok', 'EBAY_US', '5000000001', {});
  });

  it('reports eBay’s refusal as a 409 with its own key, and still audits it', async () => {
    const { service, query, postOrder } = build();
    postOrder.decideReturn.mockRejectedValueOnce(new PostOrderRejectedError('no', 400));
    await expect(service.act(USER, ID, EbayReturnAction.APPROVE)).rejects.toMatchObject({
      key: 'returns.errors.ebayRejected',
      status: 409,
    });
    expect(String(audits(query)[0][1]?.[2])).toContain('"outcome":"rejected"');
  });

  it('is an instance of ReturnActionError on every refusal', async () => {
    const { service } = build({ enabled: false });
    await expect(service.act(USER, ID, EbayReturnAction.APPROVE)).rejects.toBeInstanceOf(ReturnActionError);
  });
});

const PDF = { buffer: Buffer.from('%PDF-1.4 label'), mimeType: 'application/pdf', size: 14 };
const LABEL: ReturnActionInput = { carrier: ReturnLabelCarrier.USPS, trackingNumber: ' 9400 1 ', file: PDF };

describe('EbayReturnsActionsService.act — return labels', () => {
  it('uploads the label file, then names it in add_shipping_label with the carrier and tracking number', async () => {
    const { service, query, postOrder } = build({ live: detail(['SELLER_PROVIDE_LABEL']) });
    await expect(service.act(USER, ID, EbayReturnAction.PROVIDE_LABEL, LABEL)).resolves.toEqual({
      action: EbayReturnAction.PROVIDE_LABEL,
      refundStatus: null,
    });
    expect(postOrder.uploadReturnFile).toHaveBeenCalledWith('tok', 'EBAY_US', '5000000001', {
      data: PDF.buffer.toString('base64'),
      fileName: 'return-label-5000000001.pdf',
      filePurpose: 'LABEL_RELATED',
    });
    expect(postOrder.addReturnShippingLabel).toHaveBeenCalledWith('tok', 'EBAY_US', '5000000001', {
      labelAction: 'UPLOAD_LABEL',
      fileId: 'FILE-1',
      carrierEnum: 'USPS',
      trackingNumber: '9400 1',
    });
    expect(String(audits(query)[0][1]?.[2])).toContain('"fileId":"FILE-1"');
  });

  it('refuses an incomplete label with a 400, before reading eBay', async () => {
    const { service, postOrder } = build({ live: detail(['SELLER_PROVIDE_LABEL']) });
    await expect(
      service.act(USER, ID, EbayReturnAction.PROVIDE_LABEL, { ...LABEL, trackingNumber: '' })
    ).rejects.toMatchObject({ key: 'returns.errors.labelDetailsRequired', status: 400 });
    expect(postOrder.getReturn).not.toHaveBeenCalled();
    expect(postOrder.uploadReturnFile).not.toHaveBeenCalled();
  });

  it('refuses the label when eBay does not ask for one', async () => {
    const { service, postOrder } = build({ live: detail(['SELLER_APPROVE_REQUEST']) });
    await expect(service.act(USER, ID, EbayReturnAction.PROVIDE_LABEL, LABEL)).rejects.toMatchObject({
      key: 'returns.errors.actionNotAvailable',
    });
    expect(postOrder.uploadReturnFile).not.toHaveBeenCalled();
  });

  it('audits the uploaded file when eBay refuses add_shipping_label', async () => {
    const { service, query, postOrder } = build({ live: detail(['SELLER_PROVIDE_LABEL']) });
    postOrder.addReturnShippingLabel.mockRejectedValueOnce(new PostOrderRejectedError('no', 400));
    await expect(service.act(USER, ID, EbayReturnAction.PROVIDE_LABEL, LABEL)).rejects.toMatchObject({
      key: 'returns.errors.ebayRejected',
    });
    const audit = String(audits(query)[0][1]?.[2]);
    expect(audit).toContain('"outcome":"rejected"');
    expect(audit).toContain('"fileId":"FILE-1"');
  });

  it('confirms a label already sent with MARK_AS_SENT and no file', async () => {
    const { service, postOrder } = build({ live: detail(['SELLER_PROVIDE_LABEL']) });
    await service.act(USER, ID, EbayReturnAction.MARK_LABEL_SENT);
    expect(postOrder.uploadReturnFile).not.toHaveBeenCalled();
    expect(postOrder.addReturnShippingLabel).toHaveBeenCalledWith(
      'tok',
      'EBAY_US',
      '5000000001',
      expect.objectContaining({ labelAction: 'MARK_AS_SENT', forwardShippingLabelProvided: true })
    );
  });
});

describe('validateReturnActionInput', () => {
  it('asks nothing of the other actions', () => {
    expect(validateReturnActionInput(EbayReturnAction.APPROVE, {})).toBeNull();
    expect(validateReturnActionInput(EbayReturnAction.MARK_LABEL_SENT, {})).toBeNull();
  });

  it('needs a PDF or image file no larger than 5 MB', () => {
    expect(validateReturnActionInput(EbayReturnAction.PROVIDE_LABEL, { ...LABEL, file: undefined })).toBe(
      'returns.errors.labelFileRequired'
    );
    expect(
      validateReturnActionInput(EbayReturnAction.PROVIDE_LABEL, { ...LABEL, file: { ...PDF, mimeType: 'text/plain' } })
    ).toBe('returns.errors.labelFileInvalid');
    expect(
      validateReturnActionInput(EbayReturnAction.PROVIDE_LABEL, { ...LABEL, file: { ...PDF, size: 6 * 1024 * 1024 } })
    ).toBe('returns.errors.labelFileInvalid');
    expect(validateReturnActionInput(EbayReturnAction.PROVIDE_LABEL, LABEL)).toBeNull();
  });

  it('needs a known carrier, a name for OTHER, and a tracking number', () => {
    const check = (over: Partial<ReturnActionInput>) =>
      validateReturnActionInput(EbayReturnAction.PROVIDE_LABEL, { ...LABEL, ...over });
    expect(check({ carrier: 'ROYAL' })).toBe('returns.errors.labelDetailsRequired');
    expect(check({ carrier: ReturnLabelCarrier.OTHER })).toBe('returns.errors.labelDetailsRequired');
    expect(check({ carrier: ReturnLabelCarrier.OTHER, carrierName: 'OnTrac' })).toBeNull();
    expect(check({ trackingNumber: '   ' })).toBe('returns.errors.labelDetailsRequired');
  });
});

describe('label bodies', () => {
  it('sends the carrier name only for OTHER', () => {
    expect(
      buildUploadLabelBody({ carrier: ReturnLabelCarrier.OTHER, carrierName: ' OnTrac ', trackingNumber: 'X1' }, 'F')
    ).toEqual({ labelAction: 'UPLOAD_LABEL', fileId: 'F', carrierEnum: 'OTHER', carrierName: 'OnTrac', trackingNumber: 'X1' });
  });

  it('stamps MARK_AS_SENT with the moment it was confirmed', () => {
    expect(buildMarkLabelSentBody(new Date('2026-10-07T10:00:00.000Z'))).toEqual({
      labelAction: 'MARK_AS_SENT',
      forwardShippingLabelProvided: true,
      labelSentDate: { value: '2026-10-07T10:00:00.000Z' },
    });
  });

  it('names the uploaded file after the return, never after the browser’s file', () => {
    expect(labelFileName('77', 'image/png')).toBe('return-label-77.png');
  });
});

describe('EbayReturnsActionsService.detail', () => {
  it('merges the live read over the stored row and lists the in-app actions', async () => {
    const { service } = build({ live: detail(['SELLER_APPROVE_REQUEST', 'SELLER_SEND_MESSAGE']) });
    const dto = await service.detail(USER, ID);
    expect(dto.live).toBe(true);
    expect(dto.actionsEnabled).toBe(true);
    expect(dto.availableActions).toEqual([EbayReturnAction.APPROVE]);
    expect(dto.ebayOptions).toEqual(['SELLER_APPROVE_REQUEST', 'SELLER_SEND_MESSAGE']);
    expect(dto.bucket).toBe(ReturnBucket.ACTION_DUE);
  });

  it('falls back to the stored row, with no action, when eBay cannot be read', async () => {
    const { service, postOrder } = build();
    postOrder.getReturn.mockRejectedValueOnce(new Error('boom'));
    const dto = await service.detail(USER, ID);
    expect(dto.live).toBe(false);
    expect(dto.availableActions).toEqual([]);
    expect(dto.history).toEqual([]);
  });

  it('offers no action while the switch is off, even when eBay lists them', async () => {
    const { service } = build({ enabled: false });
    const dto = await service.detail(USER, ID);
    expect(dto.live).toBe(true);
    expect(dto.actionsEnabled).toBe(false);
    expect(dto.availableActions).toEqual([]);
  });
});

describe('buildFullRefundBody', () => {
  it('sends the estimated amount twice: as the one line and as the total', () => {
    const body = buildFullRefundBody({ row: { estimatedRefundAmount: 12.3, currency: 'USD' } } as never);
    expect(body.refundDetail.totalAmount).toEqual({ value: 12.3, currency: 'USD' });
    expect(body.refundDetail.itemizedRefundDetail[0].refundAmount).toEqual({ value: 12.3, currency: 'USD' });
  });
});
