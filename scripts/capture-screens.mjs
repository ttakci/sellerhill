import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EN_DIR = path.resolve(__dirname, '../apps/web/public/landing-screens/en');
const TR_DIR = path.resolve(__dirname, '../apps/web/public/landing-screens/tr');
if (!fs.existsSync(EN_DIR)) fs.mkdirSync(EN_DIR, { recursive: true });
if (!fs.existsSync(TR_DIR)) fs.mkdirSync(TR_DIR, { recursive: true });

const BASE_URL = 'http://localhost:5173';

const SCREENS = [
  { name: 'hero-dashboard', path: (locale) => `/${locale}/dashboard` },
  { name: 'dashboard-pnl', path: (locale) => `/${locale}/dashboard?tab=pnl` },
  { name: 'orders', path: (locale) => `/${locale}/orders` },
  { name: 'order-detail', path: (locale) => `/${locale}/orders/demo-order-1` },
  { name: 'listings', path: (locale) => `/${locale}/listings/all` },
  { name: 'listing-detail', path: (locale) => `/${locale}/listings/demo-listing-1` },
  { name: 'stores', path: (locale) => `/${locale}/stores` },
  { name: 'buyer-messages', path: (locale) => `/${locale}/settings?drawer=buyerMessageTemplates` },
];

async function capture() {
  console.log('🚀 Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1.5 }
  });

  const page = await browser.newPage();

  // Initialize demo mode on base domain
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    sessionStorage.setItem('sellerhill_demo', '1');
  });

  for (const locale of ['en', 'tr']) {
    console.log(`\n📸 Capturing ${locale.toUpperCase()} screens...`);
    const outDir = locale === 'en' ? EN_DIR : TR_DIR;

    // Set language preference in localStorage
    await page.evaluate((loc) => {
      localStorage.setItem('i18nextLng', loc);
      sessionStorage.setItem('sellerhill_demo', '1');
    }, locale);

    for (const screen of SCREENS) {
      const url = `${BASE_URL}${screen.path(locale)}`;
      console.log(` -> ${screen.name} (${url})`);
      await page.goto(url, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 2000));

      await page.screenshot({
        path: path.join(outDir, `${screen.name}.jpg`),
        type: 'jpeg',
        quality: 90,
        fullPage: false
      });
    }

    // Capture hero-kpi-card
    console.log(` -> hero-kpi-card (${locale})`);
    await page.goto(`${BASE_URL}/${locale}/dashboard`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));

    const cardEl = await page.$('[role="button"][aria-pressed="true"]');
    if (cardEl) {
      await cardEl.screenshot({
        path: path.join(outDir, 'hero-kpi-card.jpg'),
        type: 'jpeg',
        quality: 90
      });
    } else {
      console.warn('⚠️ Could not find aria-pressed period card, clipping fallback');
      const kpiRect = await page.evaluate(() => {
        const cards = document.querySelectorAll('div[class*="Card"], div[class*="Paper"]');
        for (const card of cards) {
          if (card.innerText.includes('$') || card.innerText.includes('₺')) {
            const rect = card.getBoundingClientRect();
            if (rect.width > 100 && rect.height > 50) {
              return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            }
          }
        }
        return { x: 300, y: 150, width: 280, height: 120 };
      });
      await page.screenshot({
        path: path.join(outDir, 'hero-kpi-card.jpg'),
        type: 'jpeg',
        quality: 90,
        clip: kpiRect
      });
    }
  }

  await browser.close();
  console.log('\n✅ All screens captured successfully!');
}

capture().catch((err) => {
  console.error('Failed to capture:', err);
  process.exit(1);
});
