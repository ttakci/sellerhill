import { parseOrderCardHeader, stripScriptBlocks } from './your-orders-card';

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

describe('stripScriptBlocks', () => {
  it('removes scripts of any type, keeping the markup around them', () => {
    const html =
      '<div><script>var a = "/dp/B0OTHER001";</script><a href="/dp/B0SHTEST01">x</a>' +
      '<script type="text/template">999-9999999-9999999</script></div>';
    expect(stripScriptBlocks(html)).toBe('<div><a href="/dp/B0SHTEST01">x</a></div>');
  });
});
