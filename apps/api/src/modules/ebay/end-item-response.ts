export type EndItemOutcome =
  | { kind: 'ended' }
  | { kind: 'already_ended' }
  | { kind: 'failed'; message: string };

/** Trading `EndItem` error code for "Auction closed" — the listing is already ended. */
const EBAY_ERROR_AUCTION_CLOSED = '1047';

/**
 * Reads a Trading `EndItem` response.
 *
 * "Already ended" is decided from the structured `<ErrorCode>` only. A
 * substring test over the whole body matched item ids, timestamps and the
 * API version/build, so an unrelated failure was swallowed as success and the
 * caller marked a still-live listing INACTIVE.
 */
export function interpretEndItemResponse(body: string): EndItemOutcome {
  if (body.includes('<Ack>Success</Ack>') || body.includes('<Ack>Warning</Ack>')) {
    return { kind: 'ended' };
  }

  const codes = [...body.matchAll(/<ErrorCode>(\d+)<\/ErrorCode>/g)].map((match) => match[1]);
  if (codes.includes(EBAY_ERROR_AUCTION_CLOSED)) {
    return { kind: 'already_ended' };
  }

  const message = body.match(/<LongMessage>(.*?)<\/LongMessage>/)?.[1];
  return { kind: 'failed', message: message ?? 'Unknown eBay API error' };
}
