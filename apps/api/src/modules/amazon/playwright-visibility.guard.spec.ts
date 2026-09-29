// apps/api/src/modules/amazon/playwright-visibility.guard.spec.ts
//
// `locator.isVisible({ timeout })` does not wait. Playwright documents the
// option as ignored ("does not wait for the element to become visible and
// returns immediately"), so a check written as "give it two seconds" answers
// from whatever the DOM holds at that instant. The first live auto-fulfill
// order (2026-09-29) was refused as "no saved addresses and no add-address
// control" because the address step was still a spinner when the check ran.
//
// Every presence check in the Amazon browser code goes through
// `waitFor({ state: 'visible', timeout })` instead, which actually waits. This
// spec keeps the non-waiting form from coming back: it reads like a wait and
// passes every dry-run where the page happens to be fast.

import * as fs from 'fs';
import * as path from 'path';

const FILES = ['amazon-checkout.service.ts', 'amazon-scraping.service.ts', 'amazon-order-parser.service.ts'];

function read(file: string): string {
  return fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\r\n/g, '\n');
}

describe('Playwright visibility checks in the Amazon browser code', () => {
  it.each(FILES)('%s never passes a timeout to isVisible (it is ignored)', (file) => {
    const offenders = read(file)
      .split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      // Comments may name the anti-pattern; code may not use it.
      .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .filter(({ line }) => /\.isVisible\(\s*\{/.test(line));
    expect(offenders).toEqual([]);
  });

  it('the checkout waits for the address step to render before reading it', () => {
    const src = read('amazon-checkout.service.ts');
    const step = src.slice(src.indexOf('private async selectShipToAddress('));
    const body = step.slice(0, step.indexOf('\n  }\n'));
    const readiness = body.indexOf('ADDRESS_STEP_READY_TIMEOUT_MS');
    const firstRead = body.indexOf('CHECKOUT_SELECTORS.addressRadio.join');
    expect(readiness).toBeGreaterThan(-1);
    expect(firstRead).toBeGreaterThan(-1);
    // The wait must come BEFORE the first count()/visibility decision.
    expect(readiness).toBeLessThan(firstRead);
  });
});
