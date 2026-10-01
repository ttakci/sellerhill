import {
  SCAN_CUTOFF_SLACK_DAYS,
  parseOrderCardHeader,
  parseOrderCardRecipient,
  scanCutoffMs,
  stripScriptBlocks,
} from './your-orders-card';

describe('parseOrderCardHeader', () => {
  // textContent of a live card's `.order-header` (2026-10-01), names changed.
  const live =
    '\n  Order placed\n  September 30, 2026\n  Total\n  $9.47\n  Ship to\n  Sam Buyer\n  Sam Buyer\n' +
    '  4820 JUNIPER CT FAIRVIEW, OR 97024-1111\n  United States\n  Order #\n  111-2222222-3333333\n' +
    '  View order details\n  View invoice\n';

  it('reads the placed date and the total by label', () => {
    const { orderDate, grandTotal } = parseOrderCardHeader(live);
    expect(grandTotal).toBe(9.47);
    expect(orderDate?.getFullYear()).toBe(2026);
    expect(orderDate?.getMonth()).toBe(8);
    expect(orderDate?.getDate()).toBe(30);
  });

  it('reads the upper-cased innerText form and a thousands separator', () => {
    const { orderDate, grandTotal } = parseOrderCardHeader('ORDER PLACED\nJuly 7, 2026\nTOTAL\n$1,208.40\nSHIP TO');
    expect(grandTotal).toBe(1208.4);
    expect(orderDate?.getDate()).toBe(7);
  });

  it('returns null — never now, never 0 — for fields it cannot read', () => {
    expect(parseOrderCardHeader('Ship to Sam Buyer Order # 111-2222222-3333333')).toEqual({
      orderDate: null,
      grandTotal: null,
    });
  });
});

describe('parseOrderCardRecipient', () => {
  const block =
    '\n  Ship to\n  Sam Buyer\n  Sam Buyer\n  4820 JUNIPER CT\n  FAIRVIEW, OR 97024-1111\n  United States\n';

  it('reads the name and the 5-digit postcode of the ship-to', () => {
    expect(parseOrderCardRecipient('  Sam Buyer\n', block)).toEqual({ name: 'Sam Buyer', zip: '97024' });
  });

  it('never takes a five-digit house number for the postcode', () => {
    const text = 'Ship to Sam Buyer 12345 MAIN ST SPRINGDALE, AR 72764 United States';
    expect(parseOrderCardRecipient('Sam Buyer', text).zip).toBe('72764');
  });

  it('reads a postcode that textContent ran into the next row', () => {
    expect(parseOrderCardRecipient('Lee Other', 'Ship toLee Other12345 OAK STSPRINGDALE, AR 72764United States').zip).toBe(
      '72764',
    );
  });

  it('returns null for what it cannot read (digital orders have no ship-to)', () => {
    expect(parseOrderCardRecipient('', '')).toEqual({ name: null, zip: null });
    expect(parseOrderCardRecipient('Sam Buyer', 'Ship to Sam Buyer 12345 MAIN ST').zip).toBeNull();
  });
});

describe('stripScriptBlocks', () => {
  it('removes scripts of any type, keeping the markup around them', () => {
    const html =
      '<div><script>var a = "/dp/B0OTHER001";</script><a href="/dp/B0SHTEST01">x</a>' +
      '<script type="text/template">999-9999999-9999999</script></div>';
    expect(stripScriptBlocks(html)).toBe('<div><a href="/dp/B0SHTEST01">x</a></div>');
  });
});

describe('scanCutoffMs', () => {
  // A card carries a date only, parsed as that day's midnight; `since` is an
  // instant. Compared directly, every order placed on the same calendar day as
  // the previous scan read as "older than the cutoff" and was never seen.
  it('admits an order placed on the same day as the previous scan', () => {
    const previousScan = new Date('2026-09-30T09:00:00Z');
    const cardDate = new Date('2026-09-30T00:00:00Z').getTime();
    expect(cardDate).toBeGreaterThanOrEqual(scanCutoffMs(previousScan));
  });

  it('admits the day before as well (the account prints dates in its own timezone)', () => {
    const previousScan = new Date('2026-10-01T01:00:00Z');
    const cardDate = new Date('2026-09-30T00:00:00Z').getTime();
    expect(cardDate).toBeGreaterThanOrEqual(scanCutoffMs(previousScan));
  });

  it('still cuts off older history', () => {
    const previousScan = new Date('2026-09-30T09:00:00Z');
    const cardDate = new Date('2026-09-28T00:00:00Z').getTime();
    expect(cardDate).toBeLessThan(scanCutoffMs(previousScan));
  });

  it('is the start of the since-day less the slack, whatever the time of day', () => {
    const expected = Date.UTC(2026, 8, 30) - SCAN_CUTOFF_SLACK_DAYS * 86_400_000;
    expect(scanCutoffMs(new Date('2026-09-30T00:00:00Z'))).toBe(expected);
    expect(scanCutoffMs(new Date('2026-09-30T23:59:59Z'))).toBe(expected);
  });
});
