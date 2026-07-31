import { extractVisibleText, sanitizeListingHtml, truncateHtml } from './sanitize';

describe('extractVisibleText', () => {
  it('ignores attributes so an Amazon-hosted image URL is not buyer-visible text', () => {
    const html =
      '<div class="amazon-grid"><img src="https://images-na.ssl-images-amazon.com/images/I/71abc.jpg" alt="Snack"><p>Fruit flavored snacks</p></div>';

    const text = extractVisibleText(html);

    expect(text.toLowerCase()).not.toContain('amazon');
    expect(text).toContain('Fruit flavored snacks');
  });

  it('drops style and script blocks entirely', () => {
    const html = '<style>.a{background:url(amazon.png)}</style><p>Clean copy</p>';
    expect(extractVisibleText(html)).toBe('Clean copy');
  });

  it('still exposes genuine visible mentions', () => {
    expect(extractVisibleText('<p>Sold by Amazon</p>').toLowerCase()).toContain('amazon');
  });

  it('decodes the entities the renderer escapes', () => {
    expect(extractVisibleText('<p>Fruit &amp; Nut &quot;Mix&quot;</p>')).toBe('Fruit & Nut "Mix"');
  });
});

describe('sanitizeListingHtml', () => {
  it('strips eBay-forbidden active content but keeps CSS', () => {
    const html = '<style>.x{color:red}</style><iframe src="x"></iframe><form><input></form><p>Body</p>';
    const safe = sanitizeListingHtml(html);

    expect(safe).toContain('<style>');
    expect(safe).not.toContain('<iframe');
    expect(safe).not.toContain('<form');
  });
});

describe('truncateHtml', () => {
  it('returns short input untouched', () => {
    expect(truncateHtml('<p>hi</p>', 100)).toBe('<p>hi</p>');
  });

  it('never cuts inside a tag', () => {
    const html = '<p>abcdefgh</p><img src="https://example.com/a-very-long-image-name.jpg">';
    const cut = truncateHtml(html, 30);

    expect(cut).not.toMatch(/<[^>]*$/);
  });
});
