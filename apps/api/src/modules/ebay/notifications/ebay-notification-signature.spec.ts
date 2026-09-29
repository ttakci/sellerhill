import { createSign, generateKeyPairSync } from 'crypto';

import {
  formatPublicKeyPem,
  parseSignatureHeader,
  verifyNotificationSignature,
} from './ebay-notification-signature';

function sign(body: string, privateKey: string, digest = 'sha1'): string {
  const s = createSign(digest);
  s.update(body);
  return s.sign(privateKey, 'base64');
}
function header(kid: string, signature: string, digest = 'SHA1'): string {
  return Buffer.from(JSON.stringify({ alg: 'ecdsa', kid, signature, digest })).toString('base64');
}

describe('eBay notification signature', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const oneLine = publicKey.replace(/\n/g, ''); // how eBay returns it
  const body = JSON.stringify({ metadata: { topic: 'NEW_MESSAGE' }, notification: { notificationId: 'n1' } });

  it('parses the Base64 JSON header', () => {
    expect(parseSignatureHeader(header('k1', 'sig'))).toEqual({
      alg: 'ecdsa',
      kid: 'k1',
      signature: 'sig',
      digest: 'SHA1',
    });
    expect(parseSignatureHeader(undefined)).toBeNull();
    expect(parseSignatureHeader('not-base64-json')).toBeNull();
    expect(parseSignatureHeader(Buffer.from('{"alg":"ecdsa"}').toString('base64'))).toBeNull(); // no kid
  });

  it('re-inserts PEM newlines', () => {
    expect(formatPublicKeyPem(oneLine)).toBe(publicKey.trim());
    expect(formatPublicKeyPem(publicKey)).toBe(publicKey.trim());
  });

  it('verifies a SHA1 ECDSA signature over the raw body', () => {
    const h = parseSignatureHeader(header('k1', sign(body, privateKey)))!;
    expect(verifyNotificationSignature(body, h, oneLine)).toBe(true);
  });

  it('accepts a signature made over the re-serialised body (eBay SDK convention)', () => {
    const pretty = JSON.stringify(JSON.parse(body), null, 2);
    const h = parseSignatureHeader(header('k1', sign(body, privateKey)))!;
    expect(verifyNotificationSignature(pretty, h, oneLine)).toBe(true);
  });

  it('honours a SHA256 digest and rejects a tampered body', () => {
    const h = parseSignatureHeader(header('k1', sign(body, privateKey, 'sha256'), 'SHA256'))!;
    expect(verifyNotificationSignature(body, h, oneLine)).toBe(true);
    // Appending whitespace is not a real tamper (JSON.parse ignores it, and the
    // re-serialised fallback would normalise it straight back to `body`), so the
    // negative case has to change actual content to be a meaningful tamper.
    expect(verifyNotificationSignature(body.replace('"n1"', '"n2"'), h, oneLine)).toBe(false);
  });

  it('returns false on garbage instead of throwing', () => {
    expect(verifyNotificationSignature(body, { alg: 'ecdsa', kid: 'k', signature: '!!', digest: 'SHA1' }, 'not a key')).toBe(
      false
    );
  });
});
