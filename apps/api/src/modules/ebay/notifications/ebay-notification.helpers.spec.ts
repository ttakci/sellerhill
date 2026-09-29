import { EbayConversationType } from '@repo/shared';

import {
  extractIdFromLocation,
  isValidNotificationVerificationToken,
  parseNewMessageData,
  parseNotificationEnvelope,
} from './ebay-notification.helpers';

describe('parseNotificationEnvelope', () => {
  it('reads the id, topic and attempt count', () => {
    const p = parseNotificationEnvelope({
      metadata: { topic: 'NEW_MESSAGE' },
      notification: {
        notificationId: 'a_b',
        eventDate: '2026-01-01T00:00:00.000Z',
        publishAttemptCount: 2,
        data: { x: 1 },
      },
    });
    expect(p).toEqual({
      notificationId: 'a_b',
      topic: 'NEW_MESSAGE',
      eventDate: '2026-01-01T00:00:00.000Z',
      publishAttemptCount: 2,
      data: { x: 1 },
    });
  });
  it('returns null without an id or topic', () => {
    expect(parseNotificationEnvelope({ notification: { data: {} } })).toBeNull();
    expect(parseNotificationEnvelope(null)).toBeNull();
    expect(parseNotificationEnvelope('x')).toBeNull();
  });
});

describe('parseNewMessageData', () => {
  it('maps the documented fields', () => {
    expect(
      parseNewMessageData({
        messageId: 'm',
        conversationId: 'c',
        conversationType: 'FROM_MEMBERS',
        recipientUserName: 'seller1',
        senderUserName: 'buyer',
        readStatus: false,
      })
    ).toEqual({
      messageId: 'm',
      conversationId: 'c',
      conversationType: EbayConversationType.FROM_MEMBERS,
      recipientUserName: 'seller1',
      senderUserName: 'buyer',
      readStatus: false,
    });
  });
  it('rejects an unknown conversation type or missing recipient', () => {
    expect(
      parseNewMessageData({ messageId: 'm', conversationId: 'c', conversationType: 'FROM_MARS', recipientUserName: 's' })
    ).toBeNull();
    expect(parseNewMessageData({ messageId: 'm', conversationId: 'c', conversationType: 'FROM_EBAY' })).toBeNull();
  });
});

describe('extractIdFromLocation', () => {
  it.each([
    ['/commerce/notification/v1/destination/abc', 'abc'],
    ['https://api.ebay.com/commerce/notification/v1/subscription/s-1/', 's-1'],
    ['/x/y?z=1', 'y'],
  ])('%s → %s', (loc, id) => expect(extractIdFromLocation(loc)).toBe(id));
  it('is undefined for junk', () => {
    for (const v of ['', '/', undefined, 3, {}]) {expect(extractIdFromLocation(v)).toBeUndefined();}
  });
});

describe('isValidNotificationVerificationToken', () => {
  it('accepts 32–80 of [A-Za-z0-9_-] only', () => {
    expect(isValidNotificationVerificationToken('a'.repeat(32))).toBe(true);
    expect(isValidNotificationVerificationToken('a'.repeat(31))).toBe(false);
    expect(isValidNotificationVerificationToken('a'.repeat(81))).toBe(false);
    expect(isValidNotificationVerificationToken('a'.repeat(31) + '!')).toBe(false);
  });
});
