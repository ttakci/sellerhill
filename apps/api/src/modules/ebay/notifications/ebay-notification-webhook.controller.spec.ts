import { createHash, createSign, generateKeyPairSync } from 'crypto';

import { HttpException } from '@nestjs/common';

import { EbayNotificationWebhookController } from './ebay-notification-webhook.controller';

const { publicKey, privateKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const body = JSON.stringify({
  metadata: { topic: 'NEW_MESSAGE' },
  notification: {
    notificationId: 'n1',
    publishAttemptCount: 1,
    data: {
      messageId: 'm',
      conversationId: 'c',
      conversationType: 'FROM_MEMBERS',
      recipientUserName: 's',
      readStatus: false,
    },
  },
});

const sign = (payload: string): string => {
  const signer = createSign('sha1');
  signer.update(payload);
  return signer.sign(privateKey, 'base64');
};

const sig = (payload: string, kid = 'k1-signing-key'): string =>
  Buffer.from(
    JSON.stringify({ alg: 'ecdsa', kid, signature: sign(payload), digest: 'SHA1' }),
  ).toString('base64');

const req = (raw: string, signature?: string): never =>
  ({
    rawBody: Buffer.from(raw),
    body: JSON.parse(raw) as unknown,
    headers: signature ? { 'x-ebay-signature': signature, 'content-type': 'application/json' } : {},
  }) as never;

describe('EbayNotificationWebhookController', () => {
  let service: Record<string, jest.Mock>;
  let db: { query: jest.Mock };
  let ctl: EbayNotificationWebhookController;

  beforeEach(() => {
    service = {
      isEnabled: jest.fn().mockReturnValue(true),
      verificationToken: jest.fn().mockReturnValue('v'.repeat(40)),
      endpointUrl: jest.fn().mockReturnValue('https://app.x.com/api/v1/ebay/notifications'),
      publicKey: jest.fn().mockResolvedValue(publicKey),
      recordDelivery: jest.fn().mockResolvedValue({ stored: true, outcome: 'counted' }),
    };
    db = { query: jest.fn().mockResolvedValue([]) };
    ctl = new EbayNotificationWebhookController(service as never, db as never);
  });

  it('answers the challenge with sha256(code + token + endpoint)', () => {
    const { challengeResponse } = ctl.handleChallenge('abc');
    const expected = createHash('sha256')
      .update('abc' + 'v'.repeat(40) + 'https://app.x.com/api/v1/ebay/notifications')
      .digest('hex');
    expect(challengeResponse).toBe(expected);
  });

  it('400s a challenge with no challenge_code', () => {
    expect(() => ctl.handleChallenge(undefined)).toThrow(HttpException);
  });

  it('503s the challenge when notifications are disabled', () => {
    service.isEnabled.mockReturnValue(false);
    expect(() => ctl.handleChallenge('abc')).toThrow(HttpException);
  });

  it('verifies, records and answers 204 — and captures the raw body first', async () => {
    await expect(ctl.handleNotification(req(body, sig(body)))).resolves.toBeUndefined();
    expect(service.recordDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ notificationId: 'n1', topic: 'NEW_MESSAGE' }),
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ebay_notification_raw_captures'),
      [expect.any(String), body, true, true],
    );
  });

  it('412s a bad or missing signature and records nothing', async () => {
    // A CONTENT mutation: whitespace alone would round-trip through the
    // re-serialisation fallback and still verify.
    const tampered = body.replace('"n1"', '"n2"');
    await expect(ctl.handleNotification(req(body))).rejects.toMatchObject({ status: 412 });
    await expect(ctl.handleNotification(req(tampered, sig(body)))).rejects.toMatchObject({
      status: 412,
    });
    expect(service.recordDelivery).not.toHaveBeenCalled();
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('raw_captures'), [
      expect.any(String),
      tampered,
      false,
      true,
    ]);
  });

  it('412s when the kid is unknown', async () => {
    service.publicKey.mockResolvedValue(null);
    await expect(ctl.handleNotification(req(body, sig(body)))).rejects.toMatchObject({
      status: 412,
    });
    expect(service.recordDelivery).not.toHaveBeenCalled();
  });

  it('503s a POST while notifications are disabled, before reading or recording anything', async () => {
    service.isEnabled.mockReturnValue(false);
    await expect(ctl.handleNotification(req(body, sig(body)))).rejects.toMatchObject({
      status: 503,
    });
    expect(service.publicKey).not.toHaveBeenCalled();
    expect(service.recordDelivery).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('412s a malformed kid without a key lookup and captures only the first 1 KB', async () => {
    const big = JSON.stringify({ padding: 'x'.repeat(5_000) });
    await expect(ctl.handleNotification(req(big, sig(big, 'k1')))).rejects.toMatchObject({
      status: 412,
    });
    await expect(
      ctl.handleNotification(req(big, sig(big, 'bad kid/../with spaces'))),
    ).rejects.toMatchObject({ status: 412 });
    expect(service.publicKey).not.toHaveBeenCalled();
    expect(service.recordDelivery).not.toHaveBeenCalled();
    expect(db.query).toHaveBeenCalledTimes(2);
    for (const call of db.query.mock.calls as unknown[][]) {
      const params = call[1] as [string, string, boolean, boolean];
      expect(params[1]).toBe(big.slice(0, 1_024));
      expect(params[2]).toBe(false);
    }
  });

  it('captures an unsigned request truncated to 1 KB, a signed one up to 20 KB', async () => {
    const big = JSON.stringify({ padding: 'x'.repeat(30_000) });
    await expect(ctl.handleNotification(req(big))).rejects.toMatchObject({ status: 412 });
    service.publicKey.mockResolvedValue(null);
    await expect(ctl.handleNotification(req(big, sig(big)))).rejects.toMatchObject({ status: 412 });
    const captured = (db.query.mock.calls as unknown[][]).map((c) => (c[1] as [string, string])[1]);
    expect(captured[0]).toHaveLength(1_024);
    expect(captured[1]).toHaveLength(20_000);
  });

  it('400s a verified body that is not a notification', async () => {
    const junk = JSON.stringify({ hello: 1 });
    await expect(ctl.handleNotification(req(junk, sig(junk)))).rejects.toMatchObject({
      status: 400,
    });
    expect(service.recordDelivery).not.toHaveBeenCalled();
  });

  it('still answers when the raw capture itself fails', async () => {
    db.query.mockRejectedValue(new Error('db down'));
    await expect(ctl.handleNotification(req(body, sig(body)))).resolves.toBeUndefined();
    expect(service.recordDelivery).toHaveBeenCalled();
  });
});
