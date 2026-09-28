/**
 * Builds the listing-template previews embedded on the landing page's template
 * gallery (`apps/web/public/landing-screens/templates/*.html`).
 *
 * These are the REAL templates, not pictures of them: each file is a template's
 * HTML from the catalog migration, rendered with the same
 * `renderListingTemplate` / `buildListingTemplateContext` the publish path
 * uses — exactly what a buyer's browser receives on eBay.com. The landing page
 * shows each one in an iframe (so the template's own responsive CSS runs at the
 * visitor's width) and links to the same file for a full-page view in a new tab.
 *
 * Each template's sample product comes from migration 122, the same
 * `predefined_templates.sample_data` the in-app picker previews. Photos are the
 * CC0 / public-domain, unbranded images under `apps/web/public/template-samples/`
 * (see its CREDITS.md), served same-origin. Brand is `Unbranded`, and no
 * product, model or identifier may belong to a real brand.
 *
 * Also writes `apps/web/public/template-samples/catalog.json` (every template's
 * HTML + sample data), which the sign-up-free demo's template picker reads.
 *
 *   1. pnpm --filter @repo/shared build
 *   2. node scripts/build-template-previews.mjs
 *
 * Env: OUT_DIR. If the catalog or the samples move to a newer migration, point
 * CATALOG_MIGRATION / SAMPLES_MIGRATION at it.
 */
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { renderListingTemplate } = require(
  '../packages/shared/dist/cjs/utils/listing-template.cjs'
);

const CATALOG_MIGRATION = path.resolve(__dirname, '../apps/api/migrations/073_dropshipping_templates_catalog.sql');
const OUT_DIR = process.env.OUT_DIR ?? path.resolve(__dirname, '../apps/web/public/landing-screens/templates');
const SAMPLES_MIGRATION = path.resolve(__dirname, '../apps/api/migrations/122_template_sample_products.sql');
const DEMO_CATALOG = path.resolve(__dirname, '../apps/web/public/template-samples/catalog.json');

const sql = fs.readFileSync(CATALOG_MIGRATION, 'utf8');
/** `replace(html_content, 'from', 'to') … WHERE slug = 'x'` patches from later migrations. */
const HTML_FIX_MIGRATIONS = ['123_tech_gadgets_image_fit.sql'];
const HTML_FIXES = HTML_FIX_MIGRATIONS.flatMap((file) => {
  const src = fs.readFileSync(path.resolve(__dirname, '../apps/api/migrations', file), 'utf8');
  return [...src.matchAll(/replace\(html_content,\s*'([^']*)',\s*'([^']*)'\)[\s\S]*?WHERE slug = '([^']+)'/g)].map(
    ([, from, to, slug]) => ({ from, to, slug })
  );
});
/** Pulls one template's HTML out of its `$html_<slug>$ … $html_<slug>$` dollar-quoted literal. */
function templateHtml(slug) {
  const tag = `$html_${slug.replace(/-/g, '_')}$`;
  const start = sql.indexOf(tag);
  const end = sql.indexOf(tag, start + tag.length);
  if (start < 0 || end < 0) throw new Error(`Template ${slug} not found in ${CATALOG_MIGRATION}`);
  let html = sql.slice(start + tag.length, end);
  // Later migrations patch a template's HTML with replace(); apply the same
  // patches here so the previews match what the database serves.
  for (const fix of HTML_FIXES.filter((f) => f.slug === slug)) html = html.split(fix.from).join(fix.to);
  return html;
}

/**
 * The sample product each template previews with. Read from migration 122 —
 * the same `predefined_templates.sample_data` the in-app template picker
 * previews — so the landing gallery and the settings drawer always show the
 * same product. Output file = slug without the `ds-` prefix.
 */
function templateSamples() {
  const src = fs.readFileSync(SAMPLES_MIGRATION, 'utf8');
  const tag = '$template_samples$';
  const start = src.indexOf(tag);
  const end = src.indexOf(tag, start + tag.length);
  if (start < 0 || end < 0) throw new Error(`Sample data not found in ${SAMPLES_MIGRATION}`);
  return JSON.parse(src.slice(start + tag.length, end));
}
const samples = templateSamples();

/** Every template with its real HTML + sample data, for the sign-up-free demo's template picker. */
const catalog = [];

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [slug, sampleData] of Object.entries(samples)) {
  const htmlContent = templateHtml(slug);
  // Rendered exactly the way the settings drawer renders its preview:
  // sample_data straight into the production renderer.
  const body = renderListingTemplate(htmlContent, sampleData);
  catalog.push({ slug, htmlContent, sampleData });
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${sampleData.title}</title>
<style>html,body{margin:0;background:#fff}body{padding:24px 0;overflow-x:hidden}@media (max-width:640px){body{padding:12px 0}}</style>
</head>
<body>
${body}
</body>
</html>
`;
  const file = path.join(OUT_DIR, `${slug.replace(/^ds-/, '')}.html`);
  fs.writeFileSync(file, html);
  console.log(`Rendered ${slug} -> ${path.relative(process.cwd(), file)}`);
}

// The demo has no API, so its template picker reads this file instead.
fs.mkdirSync(path.dirname(DEMO_CATALOG), { recursive: true });
fs.writeFileSync(DEMO_CATALOG, `${JSON.stringify(catalog)}\n`);
console.log(`Wrote ${catalog.length} templates -> ${path.relative(process.cwd(), DEMO_CATALOG)}`);
