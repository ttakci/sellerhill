import { buildListingTemplateContext, renderListingTemplate } from '@repo/shared';

/**
 * Regression coverage for the bug that shipped raw `{{{product_description}}}`
 * and `{{#feature_bullets}}` onto live eBay listings: the backend renderer
 * understood a different placeholder vocabulary than the templates were written
 * in, and had no section support at all.
 */
describe('renderListingTemplate', () => {
  const context = buildListingTemplateContext({
    title: 'Fruit Roll-Ups Variety Pack',
    description: '<p>Fruit flavored snacks</p>',
    brand: 'Fruit by the Foot',
    asin: 'B00TEST123',
    features: ['Gluten free', '16 pouches'],
    specs: { Brand: 'Fruit by the Foot', Flavor: 'Assorted' },
    imageUrls: ['https://img/1.jpg', 'https://img/2.jpg'],
    price: 12.05,
    currency: 'USD',
  });

  it('renders the triple-brace description as raw HTML', () => {
    expect(renderListingTemplate('<div>{{{product_description}}}</div>', context)).toBe(
      '<div><p>Fruit flavored snacks</p></div>'
    );
  });

  it('expands array sections with {{.}}', () => {
    const html = renderListingTemplate('<ul>{{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}</ul>', context);
    expect(html).toContain('<li>Gluten free</li>');
    expect(html).toContain('<li>16 pouches</li>');
  });

  it('builds product_details from specs', () => {
    const html = renderListingTemplate('{{#product_details}}<li>{{.}}</li>{{/product_details}}', context);
    expect(html).toContain('<li>Flavor: Assorted</li>');
  });

  it('renders the first image for main_image', () => {
    expect(renderListingTemplate('<img src="{{main_image}}">', context)).toBe('<img src="https://img/1.jpg">');
  });

  it('escapes double-brace values', () => {
    const html = renderListingTemplate('<h1>{{title}}</h1>', buildListingTemplateContext({ title: 'A <b>B' }));
    expect(html).toBe('<h1>A &lt;b&gt;B</h1>');
  });

  it('supports the legacy backend vocabulary', () => {
    const html = renderListingTemplate('{{{description}}}|{{brand}}', context);
    expect(html).toBe('<p>Fruit flavored snacks</p>|Fruit by the Foot');
  });

  it('drops sections whose data is empty instead of leaving markup', () => {
    const empty = buildListingTemplateContext({ title: 'X' });
    expect(renderListingTemplate('{{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}', empty)).toBe('');
  });

  it('renders inverted sections when data is missing', () => {
    const empty = buildListingTemplateContext({ title: 'X' });
    expect(renderListingTemplate('{{^feature_bullets}}<p>No details</p>{{/feature_bullets}}', empty)).toBe(
      '<p>No details</p>'
    );
  });

  it('never leaks unresolved placeholders to the listing', () => {
    const html = renderListingTemplate('<p>{{{totally_unknown}}}</p><p>{{also_unknown}}</p>', context);
    expect(html).toBe('<p></p><p></p>');
  });

  it('renders condition and quantity empty, because the publish path never passes them', () => {
    // processDescriptionTemplate builds its context without these two, so a
    // template using them publishes a blank. Predefined templates are forbidden
    // from referencing them (predefined-templates.guard.spec.ts); this locks the
    // reason why.
    expect(renderListingTemplate('[{{condition}}][{{quantity}}]', context)).toBe('[][]');
  });

  it('exposes presence flags so a list block can be hidden when the list is empty', () => {
    // A section cannot nest inside a section of the SAME key, so
    // `{{#product_details}}` cannot both wrap a heading and repeat its rows.
    // Without these flags a spec-less product renders a styled heading over a void.
    const template =
      '{{#has_details}}<h2>Details</h2><ul>{{#product_details}}<li>{{.}}</li>{{/product_details}}</ul>{{/has_details}}';

    const withData = renderListingTemplate(template, context);
    expect(withData).toContain('<h2>Details</h2>');
    expect(withData).toContain('<li>Flavor: Assorted</li>');
    // Rendered ONCE, not once per spec — the flag is a scalar, not the array.
    expect(withData.match(/<h2>Details<\/h2>/g)).toHaveLength(1);

    expect(renderListingTemplate(template, buildListingTemplateContext({ title: 'X' }))).toBe('');
  });

  it('sets every presence flag from its own list', () => {
    const empty = buildListingTemplateContext({ title: 'X' });
    expect(renderListingTemplate('{{#has_features}}F{{/has_features}}', context)).toBe('F');
    expect(renderListingTemplate('{{#has_images}}I{{/has_images}}', context)).toBe('I');
    expect(renderListingTemplate('{{#has_features}}F{{/has_features}}', empty)).toBe('');
    expect(renderListingTemplate('{{#has_details}}D{{/has_details}}', empty)).toBe('');
    expect(renderListingTemplate('{{#has_images}}I{{/has_images}}', empty)).toBe('');
  });

  it('handles sections nested inside other sections', () => {
    const html = renderListingTemplate(
      '{{#main_image}}<div>{{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}</div>{{/main_image}}',
      context
    );
    expect(html).toContain('<li>Gluten free</li>');
    expect(html).toContain('<div>');
  });
});
