import { createVerify } from 'crypto';

export interface EbaySignatureHeader {
  alg: string;
  kid: string;
  signature: string;
  digest: string;
}

/** Base64 JSON `{alg,kid,signature,digest}` → object, or null when malformed. Never throws. */
export function parseSignatureHeader(header: string | undefined): EbaySignatureHeader | null {
  if (!header) {return null;}
  try {
    const parsed = JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as Record<string, unknown>;
    const kid = parsed.kid;
    const signature = parsed.signature;
    if (typeof kid !== 'string' || !kid || typeof signature !== 'string' || !signature) {return null;}
    return {
      alg: typeof parsed.alg === 'string' ? parsed.alg : 'ecdsa',
      kid,
      signature,
      digest: typeof parsed.digest === 'string' ? parsed.digest : 'SHA1',
    };
  } catch {
    return null;
  }
}

const BEGIN = '-----BEGIN PUBLIC KEY-----';
const END = '-----END PUBLIC KEY-----';

/** eBay returns the PEM on one line; Node needs the newlines around the markers. */
export function formatPublicKeyPem(key: string): string {
  const inner = key.replace(BEGIN, '').replace(END, '').replace(/\s+/g, '');
  const lines = inner.match(/.{1,64}/g) ?? [];
  return `${BEGIN}\n${lines.join('\n')}\n${END}`;
}

function digestAlgorithm(digest: string): string {
  return digest.toUpperCase() === 'SHA256' ? 'sha256' : 'sha1';
}

/**
 * Verifies ECDSA over `digest` (SHA1 default; SHA256 accepted). Tries the raw
 * body first, then JSON.stringify(JSON.parse(raw)) — eBay's SDK verifies the
 * re-serialised body. Returns false, never throws.
 */
export function verifyNotificationSignature(
  rawBody: string,
  header: EbaySignatureHeader,
  publicKeyPem: string
): boolean {
  const pem = formatPublicKeyPem(publicKeyPem);
  const algorithm = digestAlgorithm(header.digest);
  const candidates = [rawBody];
  try {
    candidates.push(JSON.stringify(JSON.parse(rawBody)));
  } catch {
    /* not JSON — raw only */
  }
  for (const candidate of candidates) {
    try {
      const verifier = createVerify(algorithm);
      verifier.update(candidate);
      if (verifier.verify(pem, header.signature, 'base64')) {return true;}
    } catch {
      /* bad key / bad signature encoding → keep trying, then false */
    }
  }
  return false;
}
