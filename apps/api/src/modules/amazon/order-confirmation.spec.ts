import { isOrderPlacedPage, parseReviewCostLines, pickOrderIdFromHistoryCards } from './order-confirmation';

describe('parseReviewCostLines', () => {
  it('splits the 2026-09 review summary (innerText of #subtotals-marketplace-table)', () => {
    const text = 'Items:\n$8.79\nShipping & handling:\n$0.00\nEstimated tax to be collected:\n$0.62\nOrder total:\n$9.41';
    expect(parseReviewCostLines(text, 9.41)).toEqual({ items: 8.79, shipping: 0, tax: 0.62 });
  });

  it('reads an "Items (2):" label and thousands separators', () => {
    const text = 'Items (2): $1,208.00 Shipping & handling: $4.99 Estimated tax to be collected: $96.64';
    expect(parseReviewCostLines(text, 1309.63)).toEqual({ items: 1208, shipping: 4.99, tax: 96.64 });
  });

  it('derives items from the total when the items line is missing, so the three reconcile', () => {
    expect(parseReviewCostLines('Estimated tax to be collected: $0.62', 9.41)).toEqual({
      items: 8.79,
      shipping: 0,
      tax: 0.62,
    });
    expect(parseReviewCostLines('', 12.5)).toEqual({ items: 12.5, shipping: 0, tax: 0 });
  });

  it('never reads "Order total" as the items line', () => {
    expect(parseReviewCostLines('Order total: $9.41', 9.41).items).toBe(9.41);
  });
});

describe('isOrderPlacedPage', () => {
  it('accepts the thank-you route on its own', () => {
    expect(
      isOrderPlacedPage('https://www.amazon.com/gp/buy/thankyou/handlers/display.html?purchaseId=111-0000000-0000000', null)
    ).toBe(true);
  });

  it('accepts the "Order placed" heading on any URL', () => {
    expect(isOrderPlacedPage('https://www.amazon.com/checkout/p/p-1/spc', 'Order placed, thanks!')).toBe(true);
  });

  it('refuses a checkout page, a decline and an empty heading', () => {
    expect(isOrderPlacedPage('https://www.amazon.com/checkout/p/p-1/spc', null)).toBe(false);
    expect(isOrderPlacedPage('https://www.amazon.com/checkout/p/p-1/pay', 'There was a problem with your payment')).toBe(
      false
    );
    expect(isOrderPlacedPage('https://www.amazon.com/checkout/p/p-1/spc', '')).toBe(false);
  });
});

describe('pickOrderIdFromHistoryCards', () => {
  const card = (id: string, asin: string, viaHref = true): string =>
    viaHref
      ? `<div class="order-card"><a href="/gp/your-account/order-details?orderID=${id}">View order details</a><a href="/dp/${asin}?ref=x">item</a></div>`
      : `<div class="order-card"><span>ORDER # ${id}</span><a href="/gp/product/${asin}/ref=x">item</a></div>`;

  it('takes the newest card that links our ASIN', () => {
    const cards = [card('111-1111111-1111111', 'B0OTHER001'), card('222-2222222-2222222', 'B0SHTEST01')];
    expect(pickOrderIdFromHistoryCards(cards, 'B0SHTEST01', new Set())).toBe('222-2222222-2222222');
  });

  it('reads the id from the card text when there is no orderID link', () => {
    expect(pickOrderIdFromHistoryCards([card('333-3333333-3333333', 'B0SHTEST01', false)], 'B0SHTEST01', new Set())).toBe(
      '333-3333333-3333333'
    );
  });

  it('skips an id another order already carries — an older purchase of the same item', () => {
    const cards = [card('111-1111111-1111111', 'B0SHTEST01'), card('222-2222222-2222222', 'B0SHTEST01')];
    expect(pickOrderIdFromHistoryCards(cards, 'B0SHTEST01', new Set(['111-1111111-1111111']))).toBe(
      '222-2222222-2222222'
    );
    expect(
      pickOrderIdFromHistoryCards(
        cards,
        'B0SHTEST01',
        new Set(['111-1111111-1111111', '222-2222222-2222222'])
      )
    ).toBeNull();
  });

  it('does not match an ASIN that merely starts with ours', () => {
    expect(pickOrderIdFromHistoryCards([card('111-1111111-1111111', 'B0SHTEST019')], 'B0SHTEST01', new Set())).toBeNull();
  });

  it('only looks at the newest cards', () => {
    const cards = [
      ...Array.from({ length: 5 }, (_, i) => card(`10${i}-0000000-0000000`, 'B0OTHER001')),
      card('999-9999999-9999999', 'B0SHTEST01'),
    ];
    expect(pickOrderIdFromHistoryCards(cards, 'B0SHTEST01', new Set())).toBeNull();
  });
});
