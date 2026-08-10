import * as fs from 'fs';
import * as path from 'path';

import { buildListingTemplateContext, renderListingTemplate } from '@repo/shared';

import { sanitizeListingHtml } from '../../common/utils/sanitize';

/**
 * The listing description template catalog lives in SQL (migrations 070/071),
 * not in application code, so nothing in the TypeScript type system can keep a
 * template honest. This spec parses the catalog migration and enforces the rules
 * that each had to be learned from a broken live listing:
 *
 *  - Elite Trust shipped a Google Fonts `<link>`, which `sanitizeListingHtml`
 *    strips before publish. The template therefore never got the font it styled
 *    for, and the seed did not describe what actually reached eBay.
 *  - `{{price}}`/`{{currency}}` resolve to the AMAZON SOURCE price, because
 *    `processDescriptionTemplate` runs before `calculatePrice`. Publishing them
 *    puts the seller's cost in front of the buyer.
 *  - `{{condition}}`/`{{quantity}}` are never passed on the publish path, so
 *    they always render empty on a live listing.
 *  - A `<style>` block with a bare element selector restyles the whole app: the
 *    settings-drawer preview injects this HTML straight into the app document.
 */

const CATALOG_SQL = path.join(__dirname, '../../../migrations/071_predefined_templates_catalog.sql');
const STRUCTURE_SQL = path.join(__dirname, '../../../migrations/070_predefined_templates_slug.sql');
const SERVICE_TS = path.join(
  __dirname,
  '../listing-settings-groups/listing-settings-group.service.ts'
);

interface CatalogTemplate {
  slug: string;
  html: string;
  sampleData: Record<string, unknown>;
}

/** Body of a `$tag$…$tag$` dollar-quoted literal. */
function dollarQuoted(sql: string, tag: string): string {
  const delimiter = `$${tag}$`;
  const start = sql.indexOf(delimiter);
  if (start === -1) {
    throw new Error(`Missing dollar-quoted literal ${delimiter}`);
  }
  const bodyStart = start + delimiter.length;
  const end = sql.indexOf(delimiter, bodyStart);
  if (end === -1) {
    throw new Error(`Unterminated dollar-quoted literal ${delimiter}`);
  }
  return sql.slice(bodyStart, end);
}

function loadCatalog(): CatalogTemplate[] {
  const sql = fs.readFileSync(CATALOG_SQL, 'utf8');
  // Slugs are the first column of each VALUES row: `  'slug',`
  const slugs = [...sql.matchAll(/^\s{2}'([a-z0-9-]+)',$/gm)].map((match) => match[1]);
  expect(slugs.length).toBeGreaterThanOrEqual(8);

  return slugs.map((slug) => {
    const tag = slug.replace(/-/g, '_');
    return {
      slug,
      html: dollarQuoted(sql, `html_${tag}`),
      sampleData: JSON.parse(dollarQuoted(sql, `json_${tag}`)) as Record<string, unknown>,
    };
  });
}

const catalog = loadCatalog();

/** Full context, so a template renders everything it asks for. */
const fullContext = buildListingTemplateContext({
  title: 'Guard Spec Product',
  description: '<p>Description body</p>',
  brand: 'GuardBrand',
  manufacturer: 'GuardBrand Industries',
  category: 'Test Category',
  features: ['First feature', 'Second feature'],
  specs: { Brand: 'GuardBrand', Color: 'Black' },
  imageUrls: ['https://img.test/1.jpg', 'https://img.test/2.jpg'],
});

/** Nothing but a title — every optional block must collapse cleanly. */
const emptyContext = buildListingTemplateContext({ title: 'Guard Spec Product' });

describe('predefined template catalog', () => {
  it('ships at least the eight catalog templates, with unique slugs', () => {
    const slugs = catalog.map((template) => template.slug);
    // A repeated slug in one VALUES list raises
    // "ON CONFLICT DO UPDATE command cannot affect row a second time".
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toEqual(expect.arrayContaining(['modern-professional', 'elite-trust']));
  });

  it('never lets a template body contain its own dollar-quote tag', () => {
    for (const template of catalog) {
      const tag = `$html_${template.slug.replace(/-/g, '_')}$`;
      expect(template.html).not.toContain(tag);
    }
  });

  describe.each(catalog.map((template) => [template.slug, template] as const))('%s', (slug, template) => {
    const rendered = renderListingTemplate(template.html, fullContext);

    it('survives sanitizeListingHtml untouched', () => {
      // The single strongest assertion here: if the sanitizer removes anything,
      // the template is styled against markup that never reaches a buyer.
      expect(sanitizeListingHtml(rendered)).toBe(rendered);
    });

    it('carries no active content, off-site links or web fonts', () => {
      expect(template.html).not.toMatch(/<(link|script|iframe|form|meta|base|object|embed|applet)\b/i);
      expect(template.html).not.toMatch(/<a\b/i);
      expect(template.html).not.toMatch(/on\w+\s*=/i);
      expect(template.html).not.toMatch(/@import/i);
      expect(template.html).not.toMatch(/fonts\.googleapis|fonts\.gstatic/i);
      expect(template.html).not.toMatch(/@font-face/i);
      expect(template.html).not.toMatch(/data\s*:/i);
      expect(template.html).not.toMatch(/javascript\s*:|vbscript\s*:|expression\s*\(/i);
    });

    it('uses no placeholder that is empty, wrong or leaky on a live listing', () => {
      // condition/quantity are never passed; price/currency carry the Amazon
      // source price; asin is a source-marketplace identifier.
      expect(template.html).not.toMatch(/\{\{[#^{]?\s*(price|currency|quantity|condition|asin)\s*\}?\}\}/);
    });

    it('is source-neutral everywhere except real product-image src URLs', () => {
      // Keepa returns Amazon-hosted image URLs. Those URLs are allowed in src —
      // the user explicitly kept product images — but the source marketplace
      // name must not appear in visible text, class names, CSS, alt text or any
      // other attribute. Test with a representative production-shaped URL,
      // then remove ONLY src values before scanning the whole rendered markup.
      const withSourceHostedImage = renderListingTemplate(
        template.html,
        buildListingTemplateContext({
          title: 'Source-neutral product',
          description: '<p>Neutral description</p>',
          brand: 'Neutral Brand',
          features: ['Neutral feature'],
          specs: { Color: 'Black' },
          imageUrls: [
            'https://images-na.ssl-images-amazon.com/images/I/guard-one.jpg',
            'https://m.media-amazon.com/images/I/guard-two.jpg',
          ],
        })
      );
      const outsideImageSources = withSourceHostedImage.replace(/\s+src=(['"])[\s\S]*?\1/gi, '');
      expect(outsideImageSources).not.toMatch(/amazon/i);
    });

    it('leaves no template syntax behind, with or without data', () => {
      expect(rendered).not.toContain('{{');
      expect(renderListingTemplate(template.html, emptyContext)).not.toContain('{{');
    });

    it('balances every section it opens', () => {
      const openers = [...template.html.matchAll(/\{\{[#^]\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]);
      const closers = [...template.html.matchAll(/\{\{\/\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]);
      expect(openers.slice().sort()).toEqual(closers.slice().sort());
      // renderSections gives up after 100 iterations and the strip pass then
      // deletes the surplus sections along with their bodies.
      expect(openers.length).toBeLessThan(100);
    });

    it('scopes every CSS selector to its own class namespace', () => {
      const style = template.html.match(/<style>([\s\S]*?)<\/style>/);
      expect(style).not.toBeNull();

      const body = (style as RegExpMatchArray)[1]
        .replace(/@media[^{]*\{/g, '')   // unwrap media queries; their inner rules still get checked
        .replace(/\/\*[\s\S]*?\*\//g, '');

      const selectors = [...body.matchAll(/(^|\})\s*([^{}@]+)\{/g)]
        .flatMap((match) => match[2].split(','))
        .map((selector) => selector.trim())
        .filter((selector) => selector.length > 0);

      expect(selectors.length).toBeGreaterThan(0);
      for (const selector of selectors) {
        // A bare `h1 {}` or `img {}` would restyle the application itself, since
        // the settings-drawer preview injects this into the app document.
        expect(selector.startsWith('.')).toBe(true);
        expect(selector).not.toContain('[');
      }
    });

    it('previews every block it renders', () => {
      // A section key missing from sample_data renders an empty box in the
      // settings-drawer preview, which passes sample_data straight to the
      // renderer instead of going through buildListingTemplateContext.
      const sectionKeys = new Set(
        [...template.html.matchAll(/\{\{#\s*([\w.]+)\s*\}\}/g)].map((match) => match[1])
      );
      for (const key of sectionKeys) {
        expect(Object.keys(template.sampleData)).toContain(key);
      }
    });

    it('keeps images fluid for the eBay mobile webview', () => {
      if (!/<img\b/i.test(template.html)) {
        return; // minimal-mono deliberately renders no images at all
      }
      expect(template.html).toMatch(/max-width:\s*100%/);
      expect(template.html).toMatch(/height:\s*auto/);
    });
  });

  it('renders no images at all in minimal-mono', () => {
    // The template exists specifically so a seller can publish a description
    // with no Amazon-hosted image URL in the page source.
    const minimal = catalog.find((template) => template.slug === 'minimal-mono');
    expect(minimal).toBeDefined();
    expect((minimal as CatalogTemplate).html).not.toMatch(/<img\b/i);
  });
});

describe('predefined template ownership', () => {
  const service = fs.readFileSync(SERVICE_TS, 'utf8');

  it('has no boot-time seed left in application code', () => {
    // The boot upsert is what minted duplicate rows in the first place; the
    // unique index from migration 070 replaces its self-heal structurally.
    // Restoring it would make code the source of truth again.
    expect(service).not.toMatch(/seedPredefinedTemplates/);
    expect(service).not.toMatch(/onModuleInit/);
    expect(service).not.toMatch(/INSERT INTO predefined_templates/);
    expect(service).not.toMatch(/DELETE FROM predefined_templates/);
  });

  it('hides retired templates from the picker but still resolves them for publish', () => {
    expect(service).toMatch(/WHERE is_active = TRUE/);
    expect(service).toMatch(/SELECT html_content FROM predefined_templates WHERE id = \$1/);
  });

  it('never rewrites a template id on a catalog upsert', () => {
    const sql = fs.readFileSync(CATALOG_SQL, 'utf8');
    const updateSet = sql.slice(sql.indexOf('ON CONFLICT (slug) DO UPDATE SET'));
    // `id` is referenced from listing_settings_groups.templates JSONB with no
    // foreign key: rewriting it detaches every user's template choice.
    expect(updateSet).not.toMatch(/^\s*id\s*=/m);
    expect(updateSet).not.toMatch(/^\s*created_at\s*=/m);
  });

  it('repoints settings groups before deleting duplicate rows', () => {
    const sql = fs.readFileSync(STRUCTURE_SQL, 'utf8');
    const repoint = sql.indexOf('UPDATE listing_settings_groups');
    const remove = sql.indexOf('DELETE FROM predefined_templates');
    expect(repoint).toBeGreaterThan(-1);
    expect(remove).toBeGreaterThan(repoint);
    // jsonb_set on a non-object raises and would roll back the whole boot-time
    // migration run, so the guard is not optional.
    expect(sql).toMatch(/jsonb_typeof\(g\.templates\) = 'object'/);
    // The unique index must come after the dedup, and be built on the same key
    // the dedup partitions on.
    expect(sql.indexOf('CREATE UNIQUE INDEX')).toBeGreaterThan(remove);
  });
});
