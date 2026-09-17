// apps/api/src/modules/ebay/ebay-identity.guard.spec.ts
//
// A connected eBay store is identified by eBay's IMMUTABLE user id, never the
// username (migration 108). eBay's own Identity API reference: `userId` "is the
// eBay immutable user ID ... and can always be used to identify the user";
// `username` "can be changed by the user". Keying on the username let a renamed
// account claim a second free trial and gave an honest seller who renamed a
// duplicate store on reconnect. The regression is a one-token change
// (`username || userId`), so it is locked here.

import * as fs from 'fs';
import * as path from 'path';

function read(file: string): string {
  return fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\r\n/g, '\n');
}

describe('eBay store identity', () => {
  const oauth = read('ebay-oauth.service.ts');
  const method = oauth.slice(oauth.indexOf('async getSellerInfo('));
  const body = method.slice(0, method.indexOf('\n  }\n'));

  it('keys the store on the immutable userId', () => {
    expect(body).toMatch(/const sellerId = identity\?\.userId\?\.trim\(\);/);
  });

  it('never lets the username stand in for the identity', () => {
    expect(body).not.toMatch(/sellerId\s*=\s*[^;]*username/);
  });

  it('fails closed when the immutable id cannot be read', () => {
    expect(body).toMatch(/ebay\.errors\.identityUnavailable/);
    expect(body).not.toMatch(/'unknown'/);
  });

  it('never uses the opaque id as a buyer-visible store name', () => {
    expect(body).not.toMatch(/storeName:\s*storeName \|\| sellerId/);
    const processor = fs
      .readFileSync(path.join(__dirname, '..', 'buyer-messaging', 'buyer-message.processor.ts'), 'utf8')
      .replace(/\r\n/g, '\n');
    expect(processor).not.toMatch(/COALESCE\(ea\.store_name, ea\.seller_id\)/);
  });
});
