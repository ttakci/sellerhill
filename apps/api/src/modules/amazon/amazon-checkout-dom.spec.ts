import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { chromium, type Browser, type Page, type Route } from 'playwright';

import { AmazonCheckoutService, AutoFulfillBlockedError, type PlacedResult } from './amazon-checkout.service';
import { parseReviewCostLines, type ReviewCostLines } from './order-confirmation';
import { parseOrderCardHeader, parseOrderCardRecipient } from './your-orders-card';

/**
 * The checkout step helpers driven in a real Chromium against the checkout
 * pages Amazon served on 2026-09-30 (`__fixtures__/checkout/`, markup kept,
 * personal data replaced). Order 17-15222-04697 was blocked because the
 * checkout opened with the address step COLLAPSED onto the previous buyer's
 * address and none of the old selectors matched that page; these cases pin the
 * behaviour that replaces it, including the ones that must stop without
 * spending money.
 *
 * Skipped where no Playwright Chromium is installed (CI images without
 * browsers); run locally after `npx playwright install chromium`.
 */
const FIXTURES = path.join(__dirname, '__fixtures__', 'checkout');
const BASE = 'https://checkout.fixture.test/checkout/p/p-TEST/';
const hasBrowser = (() => {
  try {
    return fs.existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();

const describeWithBrowser = hasBrowser ? describe : describe.skip;

const PREVIOUS_BUYER = 'Pat Prior|115 ELM ST, ASHEVILLE, NC, 28801-2007, United States';

/** What Amazon does to an address it saves: USPS upper-case, suffix abbreviated. */
function standardise(address: string): string {
  return address.toUpperCase().replace(/\bCOURT\b/g, 'CT').replace(/\bLANE\b/g, 'LN');
}

describeWithBrowser('AmazonCheckoutService checkout DOM steps (live-captured markup)', () => {
  jest.setTimeout(90_000);

  let browser: Browser;
  let evidenceDir: string;

  beforeAll(async () => {
    evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-checkout-dom-'));
    process.env.FULFILLMENT_EVIDENCE_DIR = evidenceDir;
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
    delete process.env.FULFILLMENT_EVIDENCE_DIR;
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  });

  interface Harness {
    page: Page;
    service: AmazonCheckoutService;
    /** Every spc page the flow reached, as `name|address` (the last is where it ended). */
    spcVisits: string[];
    /** When set, the checkout ignores the entered address and keeps this one. */
    forceShipTo?: string;
  }

  async function open(startPath: string): Promise<Harness> {
    const page = await browser.newPage();
    const service = new AmazonCheckoutService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
    // Real pacing is 4.5 s per step; the DOM behaviour under test does not depend on it.
    (service as unknown as { humanDelay: () => Promise<void> }).humanDelay = () => Promise.resolve();
    const harness: Harness = { page, service, spcVisits: [] };

    await page.route('https://checkout.fixture.test/**', async (route: Route) => {
      const url = new URL(route.request().url());
      const step = url.pathname.split('/').pop();
      if (url.pathname.startsWith('/gp/buy/thankyou/')) {
        return route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(FIXTURES, 'thank-you.html'), 'utf8') });
      }
      const reject = url.searchParams.get('reject') === '1';
      if (step === 'address') {
        return route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(FIXTURES, 'address-select.html'), 'utf8') });
      }
      if (step === 'pay') {
        return route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(FIXTURES, 'pay-select.html'), 'utf8') });
      }
      if (step === 'spc') {
        const requested = url.searchParams.get('addr') ?? PREVIOUS_BUYER;
        const shown = harness.forceShipTo ?? requested;
        harness.spcVisits.push(shown);
        const [name, address] = shown.split('|');
        const body = fs
          .readFileSync(path.join(FIXTURES, 'spc-collapsed.html'), 'utf8')
          .replace(/{{NAME}}/g, name)
          .replace(/{{ADDRESS}}/g, standardise(address))
          .replace(/{{CHANGE_HREF}}/g, reject ? 'address?reject=1' : 'address');
        return route.fulfill({ contentType: 'text/html', body });
      }
      return route.fulfill({ status: 404, body: 'not in fixture' });
    });
    // "Your Orders" is read on Amazon's real host after a placement.
    await page.route('https://www.amazon.com/your-orders/**', (route: Route) =>
      route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(FIXTURES, 'your-orders.html'), 'utf8') })
    );
    await page.goto(startPath.startsWith('https://') ? startPath : BASE + startPath);
    return harness;
  }

  function selectShipTo(h: Harness, ship: Record<string, string>): Promise<void> {
    return (h.service as unknown as {
      selectShipToAddress: (page: Page, ship: Record<string, string>, id: string) => Promise<void>;
    }).selectShipToAddress(h.page, ship, 'eb-dom-test');
  }

  const newBuyer = {
    fullName: 'Sam Buyer',
    street: '4820 Juniper Court',
    street2: '',
    city: 'Fairview',
    state: 'OR',
    zipCode: '97024-1111',
    phone: '9095550100',
  };

  it('collapsed checkout on the previous buyer: opens the step, adds the eBay buyer, ends on the buyer', async () => {
    const h = await open('spc');
    try {
      await selectShipTo(h, newBuyer);

      const last = h.spcVisits[h.spcVisits.length - 1];
      expect(last).toBe('Sam Buyer|4820 Juniper Court, Fairview, OR, 97024-1111, United States');
      // Rendered standardised ("JUNIPER CT") — the recipient check accepted it.
      await expect(h.page.locator('#deliver-to-address-text').textContent()).resolves.toContain('4820 JUNIPER CT');
    } finally {
      await h.page.close();
    }
  });

  it('collapsed checkout already on the buyer: leaves it alone', async () => {
    const h = await open(`spc?addr=${encodeURIComponent('Sam Buyer|4820 Juniper Court, Fairview, OR, 97024-1111, United States')}`);
    try {
      await selectShipTo(h, newBuyer);

      expect(h.spcVisits).toHaveLength(1);
      expect(h.page.url()).toContain('/spc?');
    } finally {
      await h.page.close();
    }
  });

  it('buyer already in the address book: selects that radio, never opens the add form', async () => {
    const h = await open('spc');
    try {
      await selectShipTo(h, {
        fullName: 'Casey Saved',
        street: '77 Maple Lane',
        street2: 'Apartment 3B',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62704',
        phone: '5550000003',
      });

      const last = h.spcVisits[h.spcVisits.length - 1];
      expect(last).toBe('Casey Saved|77 MAPLE LN APT 3B, SPRINGFIELD, IL, 62704-1234, United States');
      await expect(h.page.locator('#a-popover-3').count()).resolves.toBe(0);
    } finally {
      await h.page.close();
    }
  });

  it('Amazon keeps the add-address form open: blocks with its error, never delivers to the pre-selected address', async () => {
    const h = await open('spc?reject=1');
    try {
      const outcome = await selectShipTo(h, newBuyer).then(
        () => null,
        (err: unknown) => err
      );

      expect(outcome).toBeInstanceOf(AutoFulfillBlockedError);
      expect((outcome as AutoFulfillBlockedError).reason).toBe('address');
      expect((outcome as AutoFulfillBlockedError).message).toContain('kept the add-address form open');
      expect((outcome as AutoFulfillBlockedError).message).toContain('No numbers or special characters');
      // Only the initial collapsed page was ever shown: no continue went through.
      expect(h.spcVisits).toHaveLength(1);
    } finally {
      await h.page.close();
    }
  });

  it('checkout ignores the entered address: the final recipient check blocks', async () => {
    const h = await open('spc');
    try {
      // First visit is the initial page; every later one keeps the previous buyer.
      h.forceShipTo = PREVIOUS_BUYER;
      const outcome = await selectShipTo(h, newBuyer).then(
        () => null,
        (err: unknown) => err
      );

      expect(outcome).toBeInstanceOf(AutoFulfillBlockedError);
      expect((outcome as AutoFulfillBlockedError).message).toContain('does not match the eBay buyer');
    } finally {
      await h.page.close();
    }
  });

  it('reads the Order total, not the Items line, from the summary list', async () => {
    const h = await open('spc');
    try {
      const total = await (h.service as unknown as {
        readReviewGrandTotal: (page: Page) => Promise<number>;
      }).readReviewGrandTotal(h.page);

      expect(total).toBe(9.41);
    } finally {
      await h.page.close();
    }
  });

  it('payment step: clicks "Use this payment method" (the aria-labelled input)', async () => {
    const h = await open('pay');
    try {
      await (h.service as unknown as { selectDefaultPayment: (page: Page) => Promise<void> }).selectDefaultPayment(h.page);
      await h.page.waitForURL(/\/spc\?/);

      expect(h.page.url()).toContain('from=pay');
    } finally {
      await h.page.close();
    }
  });

  function parseConfirmation(h: Harness, costs: ReviewCostLines): Promise<PlacedResult> {
    return (h.service as unknown as {
      parseConfirmation: (page: Page, costs: ReviewCostLines) => Promise<PlacedResult>;
    }).parseConfirmation(h.page, costs);
  }

  it('review summary splits into items / shipping / tax that reconcile to the Order total', async () => {
    const h = await open('spc');
    try {
      const text = await h.page.locator('#subtotals-marketplace-table').innerText();
      expect(parseReviewCostLines(text, 9.41)).toEqual({ items: 8.79, shipping: 0, tax: 0.62 });
    } finally {
      await h.page.close();
    }
  });

  it('the 2026-09 thank-you page proves the placement without an order id; costs come from the review', async () => {
    const h = await open('https://checkout.fixture.test/gp/buy/thankyou/handlers/display.html?purchaseId=111-0000000-0000000');
    try {
      await expect(parseConfirmation(h, { items: 8.79, shipping: 0, tax: 0.62 })).resolves.toEqual({
        amazonOrderId: null,
        purchasePrice: 8.79,
        tax: 0.62,
        shipping: 0,
      });
    } finally {
      await h.page.close();
    }
  });

  function resolveFromHistory(h: Harness, asin: string, takenIds: string[]): Promise<string | null> {
    (h.service as unknown as { db: unknown }).db = {
      query: (_sql: string, params: [string[]]) =>
        Promise.resolve(params[0].filter((id) => takenIds.includes(id)).map((id) => ({ amazon_order_id: id }))),
    };
    return (h.service as unknown as {
      resolveOrderIdFromHistory: (page: Page, asin: string, marketplace: string, id: string) => Promise<string | null>;
    }).resolveOrderIdFromHistory(h.page, asin, 'AMAZON_US', 'eb-dom-test');
  }

  it('Your Orders (live markup): reads the newest card for our ASIN, never from its embedded script', async () => {
    const h = await open('spc');
    try {
      await expect(resolveFromHistory(h, 'B0SHTEST01', [])).resolves.toBe('111-2222222-3333333');
      // The decoy ASIN lives only inside the first card's script and in the second card.
      await expect(resolveFromHistory(h, 'B0OTHER001', [])).resolves.toBe('111-4444444-5555555');
    } finally {
      await h.page.close();
    }
  });

  it('Your Orders: an id another order already holds is not reused', async () => {
    const h = await open('spc');
    try {
      await expect(resolveFromHistory(h, 'B0SHTEST01', ['111-2222222-3333333'])).resolves.toBeNull();
    } finally {
      await h.page.close();
    }
  });

  it('Your Orders: the card header yields the placed date and total the cost-capture matcher needs', async () => {
    const h = await open('spc');
    try {
      await h.page.goto('https://www.amazon.com/your-orders/orders');
      const headers = await h.page.locator('.order-card .order-header').allTextContents();
      const parsed = headers.map(parseOrderCardHeader);
      expect(parsed.map((p) => p.grandTotal)).toEqual([9.47, 14.88, 1.14]);
      expect(parsed.map((p) => p.orderDate?.toDateString())).toEqual([
        new Date(2026, 8, 30).toDateString(),
        new Date(2026, 8, 29).toDateString(),
        new Date(2026, 6, 27).toDateString(),
      ]);
      // "Ship to" — the matcher's buyer check. The third card has none (like a
      // digital order) and must read as unknown, never as someone.
      const recipients = await h.page.locator('.order-card').evaluateAll((cards) =>
        cards.map((card) => [
          card.querySelector('.yohtmlc-recipient .a-popover-trigger')?.textContent ?? '',
          card.querySelector('.yohtmlc-recipient')?.textContent ?? '',
        ]),
      );
      expect(recipients.map(([name, block]) => parseOrderCardRecipient(name, block))).toEqual([
        { name: 'Sam Buyer', zip: '97024' },
        { name: 'Lee Other', zip: '72764' },
        { name: null, zip: null },
      ]);
    } finally {
      await h.page.close();
    }
  });

  it('a page with neither an order id nor "Order placed" is no_confirmation', async () => {
    const h = await open('pay');
    try {
      const outcome = await parseConfirmation(h, { items: 8.79, shipping: 0, tax: 0.62 }).then(
        () => null,
        (err: unknown) => err
      );
      expect(outcome).toBeInstanceOf(AutoFulfillBlockedError);
      expect((outcome as AutoFulfillBlockedError).reason).toBe('no_confirmation');
    } finally {
      await h.page.close();
    }
  });
});
