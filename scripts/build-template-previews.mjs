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
 * Product photos are the public-domain, unbranded images under
 * `apps/web/public/demo-products/` (see its CREDITS.md). Brand is `Generic`, and
 * no product, model or identifier here may belong to a real brand.
 *
 *   1. pnpm --filter @repo/shared build
 *   2. node scripts/build-template-previews.mjs
 *
 * Env: OUT_DIR. If the catalog moves to a newer migration, point
 * CATALOG_MIGRATION at it.
 */
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { renderListingTemplate, buildListingTemplateContext } = require(
  '../packages/shared/dist/cjs/utils/listing-template.cjs'
);

const CATALOG_MIGRATION = path.resolve(__dirname, '../apps/api/migrations/073_dropshipping_templates_catalog.sql');
const OUT_DIR = process.env.OUT_DIR ?? path.resolve(__dirname, '../apps/web/public/landing-screens/templates');
/** Same-origin path, so the preview makes no external request. */
const IMG = '/demo-products/';

const sql = fs.readFileSync(CATALOG_MIGRATION, 'utf8');
/** Pulls one template's HTML out of its `$html_<slug>$ … $html_<slug>$` dollar-quoted literal. */
function templateHtml(slug) {
  const tag = `$html_${slug.replace(/-/g, '_')}$`;
  const start = sql.indexOf(tag);
  const end = sql.indexOf(tag, start + tag.length);
  if (start < 0 || end < 0) throw new Error(`Template ${slug} not found in ${CATALOG_MIGRATION}`);
  return sql.slice(start + tag.length, end);
}

/** One believable, unbranded product per template (photos repeat — only public-domain ones are used, see CREDITS.md). Output file = slug without the `ds-` prefix. */
const products = {
  'ds-general-store': {
    img: 'bluetooth-speaker',
    title: 'Portable Shower Speaker, Waterproof, Suction Cup Mount, Built-In Mic',
    desc: 'Take your music into the shower. A strong suction cup, a splash-proof shell and simple button controls make this compact speaker easy to use in the bathroom, the kitchen or the garden.',
    features: [
      'Waterproof shell, safe in the shower',
      'Strong suction cup sticks to tile and glass',
      'Built-in microphone for hands-free calls',
      'Up to 6 hours of playtime per charge',
    ],
    specs: {
      Connectivity: 'Bluetooth 5.0',
      'Battery Life': '6 Hours',
      'Water Resistance': 'Splash-Proof',
      Mounting: 'Suction Cup',
      Color: 'Pink',
      'Item Weight': '5.3 oz',
    },
  },
  'ds-outdoor-survival': {
    img: 'lunch-bag',
    title: 'Insulated Lunch Bag, Leakproof Cooler Tote for Work, Picnic & Travel',
    desc: 'Keeps food cold for hours with thick foam insulation and a leakproof, wipe-clean liner, sized for a full day out.',
    features: [
      'Thermal foam insulation keeps food cold',
      'Leakproof, wipe-clean liner',
      'Wide zip opening for easy packing',
      'Sturdy padded carry handles',
    ],
    specs: {
      Material: 'Canvas, PEVA Liner',
      Capacity: '8 L',
      Insulation: 'Thermal Foam',
      Closure: 'Zipper',
      Pattern: 'Striped',
      'Care Instructions': 'Wipe Clean',
    },
  },
  'ds-tech-gadgets': {
    img: 'wireless-earbuds',
    title: 'Wireless Earbuds, Active Noise Cancelling, 40H Battery, Bluetooth 5.3',
    desc: 'Hybrid active noise cancelling, a 40-hour charging case and a low-latency game mode, in earbuds that weigh under 5 grams each.',
    features: [
      'Active noise cancelling for travel and focus',
      '40 hours total with the charging case',
      'Low-latency mode for gaming',
      'IPX5 sweat and water resistant',
    ],
    specs: {
      Connectivity: 'Bluetooth 5.3',
      'Noise Control': 'Active Noise Cancellation',
      'Battery Life': '40 Hours',
      'Water Resistance': 'IPX5',
      Charging: 'USB-C',
      Color: 'Black',
    },
  },
  'ds-home-decor': {
    img: 'memory-foam-pillow',
    title: 'Memory Foam Pillow, Cooling Gel, Ergonomic Contour for Neck Support',
    desc: 'Contoured memory foam cradles your head and neck, while a cooling gel layer keeps the surface fresh through the night.',
    features: [
      'Ergonomic contour for side and back sleepers',
      'Cooling gel-infused memory foam',
      'Removable, machine-washable cover',
      'Hypoallergenic materials',
    ],
    specs: {
      'Fill Material': 'Memory Foam',
      Size: 'Standard',
      Firmness: 'Medium Firm',
      'Cover Material': 'Polyester Blend',
      Color: 'White',
      'Care Instructions': 'Machine Washable Cover',
    },
  },
  'ds-kitchen-dining': {
    img: 'kitchen-scale',
    title: 'Digital Kitchen Scale, 0.1 oz Precision, Tare Function, Stainless Steel',
    desc: 'Weigh ingredients to the gram for baking, meal prep and coffee. A bright backlit display and one-touch tare keep measuring fast.',
    features: [
      'Accurate to 0.1 oz / 1 g, up to 11 lb',
      'One-touch tare and unit conversion',
      'Backlit LCD display',
      'Easy-to-clean stainless steel platform',
    ],
    specs: {
      'Maximum Weight': '11 lb',
      Display: 'Backlit LCD',
      Material: 'Stainless Steel',
      'Power Source': 'Battery',
      Color: 'Silver',
      Units: 'g, oz, lb, ml',
    },
  },
  'ds-fitness-sports': {
    img: 'yoga-mat',
    title: 'Non-Slip Yoga Mat, 6mm Thick, Lightweight Exercise Mat with Carry Strap',
    desc: 'A cushioned 6mm mat with a textured, non-slip surface for yoga, pilates and floor workouts, light enough to carry to class.',
    features: [
      '6mm cushioning protects knees and wrists',
      'Textured non-slip surface on both sides',
      'Lightweight and easy to roll up',
      'Carry strap included',
    ],
    specs: {
      Material: 'TPE',
      Thickness: '6 mm',
      Dimensions: '72 x 24 in',
      Features: 'Non-Slip, Lightweight',
      Color: 'Teal',
      Activity: 'Yoga, Pilates',
    },
  },
  'ds-minimalist': {
    img: 'milk-frother',
    title: 'Handheld Milk Frother, Battery Powered Whisk for Coffee, Latte & Matcha',
    desc: 'Froth milk in seconds for lattes, cappuccinos and matcha. A stainless steel whisk and a single button make it simple to use and easy to rinse clean.',
    features: [
      'Creamy froth in 15 to 20 seconds',
      'Stainless steel whisk head',
      'One-button operation',
      'Runs on two AA batteries',
    ],
    specs: {
      Material: 'Stainless Steel, ABS',
      'Power Source': 'Battery (2 x AA)',
      Speed: '19,000 RPM',
      Length: '9 in',
      Color: 'Black',
      'Care Instructions': 'Rinse Under Water',
    },
  },
  'ds-auto-parts': {
    img: 'usb-c-charger',
    title: '30W USB-C Fast Charger with 6 ft Cable and USB-A Adapter, Foldable Plug',
    desc: 'A compact 30W USB-C power delivery charger for phones, tablets and small laptops, with a 6 ft cable and a USB-A adapter for older accessories.',
    features: [
      '30W USB-C Power Delivery',
      'Foldable prongs for travel',
      '6 ft USB-C to USB-C cable included',
      'Over-current and over-heat protection',
    ],
    specs: {
      'Output Power': '30 W',
      'Connector Type': 'USB-C',
      'Cable Length': '6 ft',
      'Input Voltage': '100-240 V',
      Color: 'White',
      'Included Components': 'Charger, Cable, Adapter',
    },
  },
  'ds-apparel-fashion': {
    img: 'lunch-bag',
    title: 'Striped Canvas Tote Bag with Insulated Lining and Leather-Look Tag',
    desc: 'A classic striped canvas tote with sturdy handles and an insulated, wipe-clean lining, easy to carry from the office to the market.',
    features: [
      'Durable striped canvas exterior',
      'Insulated, wipe-clean lining',
      'Full-length zip closure',
      'Padded carry handles',
    ],
    specs: {
      Material: 'Canvas',
      Style: 'Tote',
      Pattern: 'Striped',
      Closure: 'Zipper',
      Color: 'Navy, White',
      Department: 'Unisex Adult',
    },
  },
  'ds-beauty-health': {
    img: 'desk-lamp',
    title: 'Clip-On LED Ring Light, Flexible Gooseneck, 3 Color Modes for Makeup',
    desc: 'An even, shadow-free ring of light for makeup, skincare and video calls. Clip it to a mirror or desk and bend the gooseneck to any angle.',
    features: [
      'Soft, even ring of light with no harsh shadows',
      '3 color temperatures, dimmable',
      'Strong clamp fits mirrors and desks',
      'USB powered',
    ],
    specs: {
      'Light Source': 'LED',
      'Color Modes': 'Warm, Neutral, Cool',
      'Power Source': 'USB',
      Mounting: 'Clamp',
      Color: 'White',
      Brightness: 'Dimmable',
    },
  },
  'ds-pet-supplies': {
    img: 'kitchen-scale',
    title: 'Digital Pet Food Scale, Portion Control for Dog & Cat Meals, 1 g Accuracy',
    desc: 'Measure every meal to the gram and keep your pet at a healthy weight. One-touch tare lets you weigh straight into the food bowl.',
    features: [
      'Accurate portions to 1 g / 0.1 oz',
      'Tare function weighs directly in the bowl',
      'Backlit display, easy to read',
      'Stainless steel platform wipes clean',
    ],
    specs: {
      'Pet Type': 'Dog, Cat',
      'Maximum Weight': '11 lb',
      Display: 'Backlit LCD',
      Material: 'Stainless Steel',
      'Power Source': 'Battery',
      Color: 'Silver',
    },
  },
  'ds-toys-kids': {
    img: 'webcam',
    title: 'Kids Webcam for Online Classes, 720p with Built-In Microphone, Plug & Play',
    desc: 'A simple plug-and-play webcam for online lessons and video calls with family. Clips onto any monitor or laptop, no software to install.',
    features: [
      '720p video for clear online classes',
      'Built-in microphone',
      'Universal clip fits laptops and monitors',
      'Plug and play over USB',
    ],
    specs: {
      Resolution: '720p',
      Connectivity: 'USB',
      Microphone: 'Built-In',
      Mounting: 'Clip',
      'Age Range': '6 Years and Up',
      Color: 'Black',
    },
  },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
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
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${p.title}</title>
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
