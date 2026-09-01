// apps/api/src/modules/amazon/tracking-webhook.helpers.spec.ts
//
// The payload fixtures below are the provider's OWN examples, pasted from
// their 2026-08-26 answer. They are the only authority for this shape — the
// published OpenAPI is 3.0.3 and has no `webhooks:` section, so it documents
// the event names and the signature header and nothing else. Treat a change
// here as a contract change, not a refactor.

import { createHmac } from 'crypto';

import { AquilineProblemCode, AquilineWebhookEvent } from '@repo/shared';

import {
  decideTrackingProblem,
  isStaleTrackingEvent,
  parseTrackingWebhookPayload,
  SUBSCRIBED_TRACKING_EVENTS,
  TrackingProblemTransition,
  verifyTrackingWebhookSignature,
} from './tracking-webhook.helpers';

const SECRET = 'whsec_test';
const sign = (body: string): string =>
  `sha256=${createHmac('sha256', SECRET).update(body, 'utf8').digest('hex')}`;

/** Provider's own `tracking.html.applied` example, verbatim. */
const APPLIED = {
  event: 'tracking.html.applied',
  createdAt: '2026-08-26T18:30:00.000Z',
  data: {
    profileId: 'seller-us-1',
    orderId: '113-0000000-0000000',
    outcome: 'applied',
  },
};

/** Provider's own `tracking.html.rejected` example, verbatim. */
const REJECTED = {
  event: 'tracking.html.rejected',
  createdAt: '2026-08-26T18:30:00.000Z',
  data: {
    profileId: 'seller-us-1',
    orderId: '113-0000000-0000000',
    outcome: 'rejected',
    problemCode: 'amazon_session_expired',
    message: 'Amazon session expired. Sign in to Amazon and upload the tracking page again.',
  },
};

describe('verifyTrackingWebhookSignature', () => {
  it('accepts the provider format sha256=<hex>', () => {
    const body = JSON.stringify(APPLIED);
    expect(verifyTrackingWebhookSignature(sign(body), body, SECRET)).toBe(true);
  });

  it('rejects a signature computed over a different body', () => {
    const body = JSON.stringify(APPLIED);
    expect(verifyTrackingWebhookSignature(sign('{}'), body, SECRET)).toBe(false);
  });

  it('rejects a missing header, an empty secret and a non-hex signature', () => {
    const body = JSON.stringify(APPLIED);
    expect(verifyTrackingWebhookSignature(undefined, body, SECRET)).toBe(false);
    expect(verifyTrackingWebhookSignature(sign(body), body, '')).toBe(false);
    expect(verifyTrackingWebhookSignature('sha256=nothex', body, SECRET)).toBe(false);
  });
});

describe('parseTrackingWebhookPayload', () => {
  it("parses the provider's own applied example", () => {
    const parsed = parseTrackingWebhookPayload(APPLIED);
    expect(parsed).not.toBeNull();
    expect(parsed?.event).toBe(AquilineWebhookEvent.HTML_APPLIED);
    expect(parsed?.data.profileId).toBe('seller-us-1');
    expect(parsed?.data.orderId).toBe('113-0000000-0000000');
    expect(parsed?.data.outcome).toBe('applied');
  });

  it("parses the provider's own rejected example, including problemCode and message", () => {
    const parsed = parseTrackingWebhookPayload(REJECTED);
    expect(parsed?.data.problemCode).toBe(AquilineProblemCode.AMAZON_SESSION_EXPIRED);
    expect(parsed?.data.message).toContain('Amazon session expired');
  });

  it('parses tracking.problem.cleared, which carries previousProblemCode', () => {
    const parsed = parseTrackingWebhookPayload({
      event: 'tracking.problem.cleared',
      createdAt: '2026-08-26T18:30:00.000Z',
      data: {
        profileId: 'seller-us-1',
        orderId: '113-0000000-0000000',
        previousProblemCode: 'amazon_session_expired',
      },
    });
    expect(parsed?.data.previousProblemCode).toBe(AquilineProblemCode.AMAZON_SESSION_EXPIRED);
    expect(parsed?.data.problemCode).toBeNull();
  });

  it('rejects a body missing any of the four identity fields', () => {
    const base = APPLIED.data;
    expect(parseTrackingWebhookPayload({ createdAt: APPLIED.createdAt, data: base })).toBeNull();
    expect(parseTrackingWebhookPayload({ event: 'x', data: base })).toBeNull();
    expect(
      parseTrackingWebhookPayload({ event: 'x', createdAt: APPLIED.createdAt, data: { orderId: 'o' } }),
    ).toBeNull();
    expect(
      parseTrackingWebhookPayload({
        event: 'x',
        createdAt: APPLIED.createdAt,
        data: { profileId: 'p' },
      }),
    ).toBeNull();
  });

  it('rejects an unparseable createdAt', () => {
    expect(
      parseTrackingWebhookPayload({ ...APPLIED, createdAt: 'yesterday' }),
    ).toBeNull();
  });

  it('survives non-object bodies without throwing', () => {
    for (const bad of [null, undefined, 'string', 42, []]) {
      expect(parseTrackingWebhookPayload(bad)).toBeNull();
    }
  });

  it('keeps an unknown event name as a raw string rather than dropping it', () => {
    // The provider can add events. Dropping one we do not know would lose an
    // inbox record; casting it into our enum would let it masquerade as known.
    const parsed = parseTrackingWebhookPayload({ ...APPLIED, event: 'tracking.something.new' });
    expect(parsed?.event).toBe('tracking.something.new');
  });
});

describe('decideTrackingProblem', () => {
  const payload = (event: string, data: Record<string, unknown> = {}) =>
    parseTrackingWebhookPayload({
      event,
      createdAt: APPLIED.createdAt,
      data: { profileId: 'p', orderId: 'o', ...data },
    })!;

  it('clears on tracking.html.applied — the only event proving the upload landed', () => {
    expect(decideTrackingProblem(payload(AquilineWebhookEvent.HTML_APPLIED)).transition).toBe(
      TrackingProblemTransition.CLEAR,
    );
  });

  it('clears on tracking.problem.cleared', () => {
    expect(decideTrackingProblem(payload(AquilineWebhookEvent.PROBLEM_CLEARED)).transition).toBe(
      TrackingProblemTransition.CLEAR,
    );
  });

  it('does NOT clear on a bare tracking.html.accepted', () => {
    // "accepted" means stored and validated, NOT applied — the provider's docs
    // say never to treat success alone as applied. Clearing a real prior
    // problem here would hide a fault that has not actually been fixed.
    expect(decideTrackingProblem(payload(AquilineWebhookEvent.HTML_ACCEPTED)).transition).toBe(
      TrackingProblemTransition.NONE,
    );
  });

  it('sets when tracking.html.accepted carries a degraded problemCode', () => {
    const decision = decideTrackingProblem(
      payload(AquilineWebhookEvent.HTML_ACCEPTED, { problemCode: 'wrong_page_type' }),
    );
    expect(decision.transition).toBe(TrackingProblemTransition.SET);
    expect(decision.problemCode).toBe(AquilineProblemCode.WRONG_PAGE_TYPE);
  });

  it('sets on rejected and on problem.opened', () => {
    for (const event of [AquilineWebhookEvent.HTML_REJECTED, AquilineWebhookEvent.PROBLEM_OPENED]) {
      const decision = decideTrackingProblem(
        payload(event, { problemCode: 'amazon_session_expired' }),
      );
      expect(decision.transition).toBe(TrackingProblemTransition.SET);
      expect(decision.problemCode).toBe(AquilineProblemCode.AMAZON_SESSION_EXPIRED);
    }
  });

  it('flags an unknown problem code and stores null rather than a raw string', () => {
    // A code we have no i18n key for must never reach a seller verbatim.
    const decision = decideTrackingProblem(
      payload(AquilineWebhookEvent.PROBLEM_OPENED, { problemCode: 'something_they_added' }),
    );
    expect(decision.transition).toBe(TrackingProblemTransition.SET);
    expect(decision.problemCode).toBeNull();
    expect(decision.unknownCode).toBe(true);
  });

  it('does not overwrite a stored code when a problem event carries no code', () => {
    const decision = decideTrackingProblem(payload(AquilineWebhookEvent.PROBLEM_OPENED));
    expect(decision.transition).toBe(TrackingProblemTransition.NONE);
  });

  it('ignores an event name it does not recognise', () => {
    expect(decideTrackingProblem(payload('tracking.something.new')).transition).toBe(
      TrackingProblemTransition.NONE,
    );
  });
});

describe('isStaleTrackingEvent', () => {
  const now = Date.parse('2026-08-26T12:00:00Z');

  it('accepts a fresh event', () => {
    expect(isStaleTrackingEvent('2026-08-26T11:30:00Z', now, 1440)).toBe(false);
  });

  it('rejects one older than the window', () => {
    expect(isStaleTrackingEvent('2026-08-24T11:30:00Z', now, 1440)).toBe(true);
  });

  it('accepts a future-dated event — clock skew is normal, dropping live traffic is not', () => {
    expect(isStaleTrackingEvent('2026-08-26T12:05:00Z', now, 1440)).toBe(false);
  });

  it('treats an unparseable timestamp as stale', () => {
    expect(isStaleTrackingEvent('not a date', now, 1440)).toBe(true);
  });
});

describe('SUBSCRIBED_TRACKING_EVENTS', () => {
  it('subscribes to all five events the provider emits', () => {
    expect([...SUBSCRIBED_TRACKING_EVENTS].sort()).toEqual(
      [
        AquilineWebhookEvent.HTML_ACCEPTED,
        AquilineWebhookEvent.HTML_APPLIED,
        AquilineWebhookEvent.HTML_REJECTED,
        AquilineWebhookEvent.PROBLEM_OPENED,
        AquilineWebhookEvent.PROBLEM_CLEARED,
      ].sort(),
    );
  });

  it('contains no v3 shipment.* event — that vocabulary was the wrong API', () => {
    for (const event of SUBSCRIBED_TRACKING_EVENTS) {
      expect(event.startsWith('shipment.')).toBe(false);
    }
  });
});
