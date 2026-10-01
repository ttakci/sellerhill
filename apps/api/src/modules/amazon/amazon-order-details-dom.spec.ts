import * as fs from 'node:fs';
import * as path from 'node:path';

import { chromium, type Browser, type Page } from 'playwright';

import { AmazonOrderParserService } from './amazon-order-parser.service';

/**
 * `parseOrderPage` driven in a real Chromium against the order-details page
 * Amazon served on 2026-10-01 (`__fixtures__/checkout/order-details.html`,
 * markup kept, personal data replaced). A manual link of this order came back
 * "cost details couldn't be read"; these cases pin what the page yields.
 *
 * Skipped where no Playwright Chromium is installed; run locally after
 * `npx playwright install chromium`.
 */
const FIXTURE = path.join(__dirname, '__fixtures__', 'checkout', 'order-details.html');
const ORDER_ID = '111-2222222-3333333';
const hasBrowser = (() => {
  try {
    return fs.existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();

const describeWithBrowser = hasBrowser ? describe : describe.skip;

describeWithBrowser('AmazonOrderParserService.parseOrderPage (live-captured order-details markup)', () => {
  jest.setTimeout(90_000);

  let browser: Browser;
  let page: Page;
  const service = new AmazonOrderParserService();

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setContent(fs.readFileSync(FIXTURE, 'utf8'));
  });

  afterEach(async () => {
    await page.close();
  });

  it("reads Amazon's five cost lines", async () => {
    const data = await service.parseOrderPage(page, ORDER_ID);

    expect(data.costCaptureFailed).toBe(false);
    expect(data.subtotal).toBe(8.79);
    expect(data.shipping).toBe(0);
    expect(data.tax).toBe(0.68);
    expect(data.grandTotal).toBe(9.47);
  });

  it('proves the order id from the visible text and reads the ETA as not shipped', async () => {
    const data = await service.parseOrderPage(page, ORDER_ID);

    expect(data.orderIdOnPage).toBe(true);
    expect(data.status).toBe('pending');
    expect(data.trackingUrl).toContain('/progress-tracker/package');
    expect(data.trackingNumber).toBeUndefined();
  });

  it('does not take another order id as proof', async () => {
    const data = await service.parseOrderPage(page, '111-9999999-9999999');

    expect(data.orderIdOnPage).toBe(false);
  });

  it('still reports unreadable costs when the cost block is gone', async () => {
    await page.evaluate(() => document.querySelector('#od-subtotals')?.remove());

    const data = await service.parseOrderPage(page, ORDER_ID);

    expect(data.costCaptureFailed).toBe(true);
    expect(data.orderIdOnPage).toBe(true);
  });
});
