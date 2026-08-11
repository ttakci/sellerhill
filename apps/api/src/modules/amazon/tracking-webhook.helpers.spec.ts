// apps/api/src/modules/amazon/tracking-webhook.helpers.spec.ts
//
// The load-bearing cases here are the ones that would silently lose or
// duplicate a buyer-visible event: a delivery arriving under the provider's
// catch-all event name, a status_change with no newEvents, and signature
// forgery.

import { createHmac } from 'crypto';

import { OrderStatus, TrackingWebhookEvent, type TrackingWebhookPayload } from '@repo/shared';

import {
  isSignificantChange,
  isStaleTrackingEvent,
  parseTrackingWebhookPayload,
  resolveWebhookOrderStatus,
  SUBSCRIBED_TRACKING_EVENTS,
  verifyTrackingWebhookSignature,
} from './tracking-webhook.helpers';

const SECRET = 'whsec_test_value';
const sign = (body: string, secret = SECRET): string =>
  `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;

const payload = (over: Partial<TrackingWebhookPayload['data']> & { type?: string; occurredAt?: string } = {}): TrackingWebhookPayload => ({
  type: over.type ?? TrackingWebhookEvent.DELIVERED,
  occurredAt: over.occurredAt ?? '2026-08-11T10:00:00Z',
  data: {
    trackingNumber: over.trackingNumber ?? 'AQUAA6435850826YQ',
    status: over.status ?? null,
    statusCode: over.statusCode ?? null,
    changeType: over.changeType ?? null,
    newEvents: over.newEvents ?? [],
  },
});

describe('verifyTrackingWebhookSignature', () => {
  const body = '{"type":"shipment.delivered","data":{"trackingNumber":"AQUAA1YQ"}}';

  it('accepts a correct signature', () => {
    expect(verifyTrackingWebhookSignature(sign(body), body, SECRET)).toBe(true);
  });

  it('accepts a bare hex digest without the sha256= prefix', () => {
    const bare = createHmac('sha256', SECRET).update(body, 'utf8').digest('hex');
    expect(verifyTrackingWebhookSignature(bare, body, SECRET)).toBe(true);
  });

  it('rejects a signature computed over different bytes', () => {
    // This is why verification must run on the RAW body: re-serialising a
    // parsed object changes key order/whitespace and produces exactly this.
    expect(verifyTrackingWebhookSignature(sign(body), `${body} `, SECRET)).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    expect(verifyTrackingWebhookSignature(sign(body, 'other'), body, SECRET)).toBe(false);
  });

  it('fails closed on a missing header or missing secret', () => {
    expect(verifyTrackingWebhookSignature(undefined, body, SECRET)).toBe(false);
    expect(verifyTrackingWebhookSignature('', body, SECRET)).toBe(false);
    expect(verifyTrackingWebhookSignature(sign(body), body, '')).toBe(false);
  });

  it('rejects malformed, truncated and non-hex signatures without throwing', () => {
    // timingSafeEqual throws on a length mismatch — a crash here would be a
    // 500 and the provider would retry a forged request three more times.
    for (const bad of ['sha256=', 'sha256=zz', 'sha256=abcd', 'not-a-signature', 'sha256=' + 'a'.repeat(63)]) {
      expect(() => verifyTrackingWebhookSignature(bad, body, SECRET)).not.toThrow();
      expect(verifyTrackingWebhookSignature(bad, body, SECRET)).toBe(false);
    }
  });
});

describe('parseTrackingWebhookPayload', () => {
  it('parses a well-formed payload and trims the tracking number', () => {
    const parsed = parseTrackingWebhookPayload({
      type: 'shipment.delivered',
      occurredAt: '2026-08-11T10:00:00Z',
      data: { trackingNumber: '  AQUAA6435850826YQ  ', status: 'delivered', changeType: 'status_change' },
    });
    expect(parsed?.data.trackingNumber).toBe('AQUAA6435850826YQ');
    expect(parsed?.data.changeType).toBe('status_change');
    expect(parsed?.data.newEvents).toEqual([]);
  });

  it('rejects a payload missing any of the three fields we key on', () => {
    expect(parseTrackingWebhookPayload({ occurredAt: '2026-08-11T10:00:00Z', data: { trackingNumber: 'A' } })).toBeNull();
    expect(parseTrackingWebhookPayload({ type: 'x', data: { trackingNumber: 'A' } })).toBeNull();
    expect(parseTrackingWebhookPayload({ type: 'x', occurredAt: '2026-08-11T10:00:00Z', data: {} })).toBeNull();
    expect(parseTrackingWebhookPayload({ type: 'x', occurredAt: '2026-08-11T10:00:00Z' })).toBeNull();
  });

  it('rejects an unparseable occurredAt', () => {
    expect(
      parseTrackingWebhookPayload({ type: 'x', occurredAt: 'yesterday', data: { trackingNumber: 'A' } }),
    ).toBeNull();
  });

  it('rejects non-objects instead of throwing', () => {
    for (const bad of [null, undefined, 'string', 42, []]) {
      expect(parseTrackingWebhookPayload(bad)).toBeNull();
    }
  });
});

describe('resolveWebhookOrderStatus', () => {
  it('maps the explicit delivered event to COMPLETED', () => {
    expect(resolveWebhookOrderStatus(payload())).toBe(OrderStatus.COMPLETED);
  });

  it('maps a delivery arriving under the catch-all event to COMPLETED', () => {
    // shipment.updated is the provider's fallback for statuses it has not
    // mapped. Keying only on the event NAME would drop this delivery.
    expect(
      resolveWebhookOrderStatus(
        payload({ type: TrackingWebhookEvent.UPDATED, status: 'delivered' }),
      ),
    ).toBe(OrderStatus.COMPLETED);
    expect(
      resolveWebhookOrderStatus(
        payload({ type: TrackingWebhookEvent.UPDATED, status: null, statusCode: 'Delivered' }),
      ),
    ).toBe(OrderStatus.COMPLETED);
  });

  it('returns null for the catch-all carrying a non-delivered status', () => {
    expect(
      resolveWebhookOrderStatus(payload({ type: TrackingWebhookEvent.UPDATED, status: 'Shipping' })),
    ).toBeNull();
    expect(resolveWebhookOrderStatus(payload({ type: TrackingWebhookEvent.UPDATED }))).toBeNull();
  });

  it('takes no action on intermediate or exception events', () => {
    // The order is already SHIPPED when a conversion exists, so in_transit and
    // out_for_delivery carry nothing we store. An exception is a carrier
    // problem for an operator to read, not an automatic eBay-side action.
    for (const type of [
      TrackingWebhookEvent.IN_TRANSIT,
      TrackingWebhookEvent.OUT_FOR_DELIVERY,
      TrackingWebhookEvent.EXCEPTION,
      TrackingWebhookEvent.PICKUP_UPDATED,
    ]) {
      expect(resolveWebhookOrderStatus(payload({ type }))).toBeNull();
    }
  });
});

describe('isStaleTrackingEvent', () => {
  const now = Date.parse('2026-08-11T12:00:00Z');

  it('accepts a recent event', () => {
    expect(isStaleTrackingEvent('2026-08-11T11:30:00Z', now, 120)).toBe(false);
  });

  it('rejects an event older than the window', () => {
    expect(isStaleTrackingEvent('2026-08-10T12:00:00Z', now, 120)).toBe(true);
  });

  it('accepts a future-dated event — clock skew is normal, dropping live traffic is not', () => {
    expect(isStaleTrackingEvent('2026-08-11T12:05:00Z', now, 120)).toBe(false);
  });

  it('treats an unparseable timestamp as stale', () => {
    expect(isStaleTrackingEvent('never', now, 120)).toBe(true);
  });
});

describe('isSignificantChange', () => {
  it('treats a status_change with no new events as significant', () => {
    // The provider documents exactly this case. A handler keyed on
    // newEvents.length would miss every delivery sent this way.
    expect(isSignificantChange(payload({ changeType: 'status_change', newEvents: [] }))).toBe(true);
  });

  it('treats an event_append with no new events as insignificant', () => {
    expect(isSignificantChange(payload({ changeType: 'event_append', newEvents: [] }))).toBe(false);
  });

  it('treats an event_append carrying events as significant', () => {
    expect(
      isSignificantChange(
        payload({ changeType: 'event_append', newEvents: [{ content: 'Out for delivery', time: '2026-08-11 09:00:00' }] }),
      ),
    ).toBe(true);
  });

  it('defaults to significant when changeType is absent or unrecognised', () => {
    expect(isSignificantChange(payload({ changeType: null }))).toBe(true);
    expect(isSignificantChange(payload({ changeType: 'something_new' }))).toBe(true);
  });
});

describe('SUBSCRIBED_TRACKING_EVENTS', () => {
  it('includes the catch-all, without which a delivery can be missed', () => {
    expect(SUBSCRIBED_TRACKING_EVENTS).toContain(TrackingWebhookEvent.DELIVERED);
    expect(SUBSCRIBED_TRACKING_EVENTS).toContain(TrackingWebhookEvent.UPDATED);
  });

  it('does not subscribe to intermediate noise we take no action on', () => {
    expect(SUBSCRIBED_TRACKING_EVENTS).not.toContain(TrackingWebhookEvent.IN_TRANSIT);
    expect(SUBSCRIBED_TRACKING_EVENTS).not.toContain(TrackingWebhookEvent.PICKUP_UPDATED);
  });
});
