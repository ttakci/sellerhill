/**
 * Renders the listing-template previews shown in the landing page's template
 * gallery (`apps/web/public/landing-screens/templates/`).
 *
 * These are not app screenshots: they are what a BUYER sees on eBay.com. Each
 * template's HTML is read from the catalog migration and rendered with the
 * same `renderListingTemplate` / `buildListingTemplateContext` the publish path
 * uses, so a preview can never show markup the product would not produce.
 * Product photos are the CC0 / public-domain images under
 * `apps/web/public/demo-products/` (see its CREDITS.md) — never the CC BY ones,
 * which would need an attribution on the landing page.
 *
 *   1. pnpm --filter @repo/shared build
 *   2. Run the web app (serves the product photos): pnpm --filter web exec vite --port 5199
 *   3. node scripts/capture-template-previews.mjs
 *
 * Env: BASE_URL (default http://127.0.0.1:5199), CHROME_PATH, OUT_DIR.
 * If the catalog moves to a newer migration, point CATALOG_MIGRATION at it.
 */
import fs from 'fs';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { renderListingTemplate, buildListingTemplateContext } = require(
  '../packages/shared/dist/cjs/utils/listing-template.cjs'
);

const CATALOG_MIGRATION = path.resolve(__dirname, '../apps/api/migrations/073_dropshipping_templates_catalog.sql');
const OUT_DIR = process.env.OUT_DIR ?? path.resolve(__dirname, '../apps/web/public/landing-screens/templates');
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5199';
const IMG = `${BASE_URL}/demo-products/`;

const sql = fs.readFileSync(CATALOG_MIGRATION, 'utf8');
/** Pulls one template's HTML out of its `$html_<slug>$ … $html_<slug>$` dollar-quoted literal. */
function templateHtml(slug) {
  const tag = `$html_${slug.replace(/-/g, '_')}$`;
  const start = sql.indexOf(tag);
  const end = sql.indexOf(tag, start + tag.length);
  if (start < 0 || end < 0) throw new Error(`Template ${slug} not found in ${CATALOG_MIGRATION}`);
  return sql.slice(start + tag.length, end);
}

/** One believable product per template. Output file = slug without the `ds-` prefix. */
const products = {
  'ds-general-store': { img: 'bluetooth-speaker', title: 'Portable Bluetooth Speaker, 24H Playtime, IPX7 Waterproof, Deep Bass', desc: 'Take room-filling sound anywhere. A 24-hour battery, IPX7 waterproofing and a rugged fabric shell make this speaker ready for the beach, the trail or the backyard.', features: ['24 hours of playtime on a single charge', 'IPX7 waterproof — rinse it, drop it in the pool', 'Stereo pairing with a second speaker', 'Built-in microphone for hands-free calls'], specs: { 'Connectivity': 'Bluetooth 5.3', 'Battery Life': '24 Hours', 'Water Resistance': 'IPX7', 'Output Power': '20 W', 'Color': 'Black', 'Item Weight': '1.2 lb' } },
  'ds-outdoor-survival': { img: 'lunch-bag', title: 'Insulated Lunch Bag, Leakproof Cooler Tote for Work, Picnic & Travel', desc: 'Keeps food cold for up to 8 hours with thick foam insulation and a leakproof, wipe-clean liner — sized for a full day out.', features: ['Keeps food cold up to 8 hours', 'Leakproof, wipe-clean PEVA liner', 'Front pocket for utensils and napkins', 'Adjustable, padded shoulder strap'], specs: { 'Material': 'Oxford Fabric, PEVA', 'Capacity': '12 L', 'Insulation': 'Thermal Foam', 'Closure': 'Zipper', 'Color': 'Gray', 'Care Instructions': 'Wipe Clean' } },
  'ds-tech-gadgets': { img: 'wireless-earbuds', title: 'Wireless Earbuds, Active Noise Cancelling, 40H Battery, Bluetooth 5.3', desc: 'Hybrid active noise cancelling, a 40-hour charging case and a low-latency game mode — in earbuds that weigh under 5 grams each.', features: ['Hybrid active noise cancelling up to 42 dB', '40 hours total with the charging case', 'Low-latency mode for gaming', 'IPX5 sweat and water resistant'], specs: { 'Connectivity': 'Bluetooth 5.3', 'Noise Control': 'Active Noise Cancellation', 'Battery Life': '40 Hours', 'Water Resistance': 'IPX5', 'Charging': 'USB-C, Wireless', 'Color': 'Black' } },
  'ds-home-decor': { img: 'memory-foam-pillow', title: 'Memory Foam Pillow, Cooling Gel, Ergonomic Contour for Neck Support', desc: 'Contoured memory foam cradles your head and neck, while a cooling gel layer keeps the surface fresh through the night.', features: ['Ergonomic contour for side and back sleepers', 'Cooling gel-infused memory foam', 'Removable, machine-washable cover', 'CertiPUR-US certified foam'], specs: { 'Fill Material': 'Memory Foam', 'Size': 'Standard', 'Firmness': 'Medium Firm', 'Cover Material': 'Bamboo Rayon', 'Color': 'White', 'Care Instructions': 'Machine Washable Cover' } },
  'ds-kitchen-dining': { img: 'kitchen-scale', title: 'Digital Kitchen Scale, 0.1 oz Precision, Tare Function, Stainless Steel', desc: 'Weigh ingredients to the gram for baking, meal prep and coffee. A bright backlit display and one-touch tare keep measuring fast.', features: ['Accurate to 0.1 oz / 1 g, up to 11 lb', 'One-touch tare and unit conversion', 'Backlit LCD display', 'Easy-to-clean stainless steel platform'], specs: { 'Maximum Weight': '11 lb', 'Display': 'Backlit LCD', 'Material': 'Stainless Steel', 'Power Source': 'Battery', 'Color': 'Silver', 'Units': 'g, oz, lb, ml' } },
  'ds-fitness-sports': { img: 'resistance-bands', title: 'Resistance Bands Set, 5 Levels, Exercise Bands for Home Workout', desc: 'Five color-coded resistance levels for strength, mobility and physical-therapy work — at home, at the gym or on the road.', features: ['5 resistance levels from extra light to extra heavy', 'Natural latex, snap-resistant', 'Carry bag and exercise guide included', 'Suitable for all fitness levels'], specs: { 'Material': 'Natural Latex', 'Resistance Level': 'Extra Light to Extra Heavy', 'Number of Pieces': '5', 'Band Length': '12 in', 'Color': 'Multicolor', 'Activity': 'Strength Training' } },
};

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-templates-'));
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 1200 });
  for (const [slug, p] of Object.entries(products)) {
    const context = buildListingTemplateContext({
      title: p.title,
      description: p.desc,
      features: p.features,
      specs: p.specs,
      mainImageUrl: `${IMG}${p.img}.jpg`,
      brand: 'Generic',
    });
    const body = renderListingTemplate(templateHtml(slug), context);
    const file = path.join(workDir, `${slug}.html`);
    fs.writeFileSync(
      file,
      `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#fff;padding:24px 0">${body}</body></html>`
    );
    await page.goto(`file://${file}`, { waitUntil: 'networkidle0' });
    await page.screenshot({
      path: path.join(OUT_DIR, `${slug.replace(/^ds-/, '')}.jpg`),
      type: 'jpeg',
      quality: 82,
    });
    console.log(`Rendered ${slug}`);
  }
} finally {
  await browser.close();
  fs.rmSync(workDir, { recursive: true, force: true });
}
