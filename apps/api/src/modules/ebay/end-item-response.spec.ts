import { interpretEndItemResponse } from './end-item-response';

const wrap = (ack: string, extra = '') =>
  `<?xml version="1.0" encoding="UTF-8"?><EndItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">` +
  `<Timestamp>2026-09-28T09:12:29.291Z</Timestamp><Ack>${ack}</Ack><Version>1291</Version>` +
  `<Build>E1291_CORE_APILW_19110890_R1</Build>${extra}</EndItemResponse>`;

describe('interpretEndItemResponse', () => {
  it('treats Success and Warning as ended', () => {
    expect(interpretEndItemResponse(wrap('Success'))).toEqual({ kind: 'ended' });
    expect(interpretEndItemResponse(wrap('Warning'))).toEqual({ kind: 'ended' });
  });

  it('treats error 1047 (auction closed) as already ended', () => {
    const body = wrap(
      'Failure',
      '<Errors><ShortMessage>Auction closed.</ShortMessage><LongMessage>The auction has been closed.</LongMessage><ErrorCode>1047</ErrorCode></Errors>'
    );
    expect(interpretEndItemResponse(body)).toEqual({ kind: 'already_ended' });
  });

  it('never reads "291" appearing elsewhere in a failure body as already-ended', () => {
    const body = wrap(
      'Failure',
      '<Errors><ShortMessage>Not allowed.</ShortMessage><LongMessage>Item 110291778528 cannot be ended.</LongMessage><ErrorCode>21916</ErrorCode></Errors>'
    );
    expect(interpretEndItemResponse(body)).toEqual({ kind: 'failed', message: 'Item 110291778528 cannot be ended.' });
  });

  it('reports a failure with no message as unknown, not as success', () => {
    expect(interpretEndItemResponse(wrap('Failure'))).toEqual({ kind: 'failed', message: 'Unknown eBay API error' });
  });

  it('does not treat PartialFailure as ended', () => {
    expect(interpretEndItemResponse(wrap('PartialFailure')).kind).toBe('failed');
  });
});
