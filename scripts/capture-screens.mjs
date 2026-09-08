import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure directories exist
const EN_DIR = path.resolve(__dirname, '../apps/web/public/landing-screens/en');
const TR_DIR = path.resolve(__dirname, '../apps/web/public/landing-screens/tr');
if (!fs.existsSync(EN_DIR)) fs.mkdirSync(EN_DIR, { recursive: true });
if (!fs.existsSync(TR_DIR)) fs.mkdirSync(TR_DIR, { recursive: true });

// Port might vary, default is usually 5173 for Vite
const BASE_URL = 'http://localhost:5173';

const SCREENS = [
  { name: 'hero-dashboard', path: '/dashboard' },
  { name: 'order-detail', path: '/orders/demo-order-1' },
  { name: 'orders', path: '/orders' },
  { name: 'listings', path: '/listings/all' },
  { name: 'listing-detail', path: '/listings/demo-listing-1' },
  { name: 'stores', path: '/stores' },
];

async function capture() {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 } 
  });

  const page = await browser.newPage();
  
  // Set demo mode by visiting the site and setting sessionStorage
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    sessionStorage.setItem('sellerhill_demo', '1');
  });

  for (const locale of ['en', 'tr']) {
    console.log(`\n📸 Capturing ${locale.toUpperCase()} screens...`);
    const outDir = locale === 'en' ? EN_DIR : TR_DIR;

    for (const screen of SCREENS) {
      console.log(` -> ${screen.name}`);
      // Appending ?lng=locale to force the app language (or setting localStorage)
      await page.goto(`${BASE_URL}${screen.path}?lng=${locale}`, { waitUntil: 'networkidle2' });
      
      // We might need to hide some elements or wait for animations, but a short wait usually works
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      await page.screenshot({
        path: path.join(outDir, `${screen.name}.jpg`),
        type: 'jpeg',
        quality: 90,
        fullPage: false // just viewport
      });
    }

    // Capture specific hero-kpi-card
    console.log(` -> hero-kpi-card`);
    await page.goto(`${BASE_URL}/dashboard?lng=${locale}`, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // We try to find the KPI card to clip it, if not possible we just capture a small fixed region
    const kpiRect = await page.evaluate(() => {
      // Find the "Confirmed" or "Today" KPI card, let's just grab the first metric card
      const cards = document.querySelectorAll('div[class*="Card"], div[class*="Paper"], div[class*="MuiPaper"]');
      for (const card of cards) {
        if (card.innerText.includes('$') || card.innerText.includes('₺')) {
          const rect = card.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 50) {
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }
        }
      }
      // fallback
      return { x: 300, y: 150, width: 280, height: 120 };
    });

    await page.screenshot({
      path: path.join(outDir, `hero-kpi-card.jpg`),
      type: 'jpeg',
      quality: 90,
      clip: kpiRect
    });

    // Capture dashboard-pnl
    console.log(` -> dashboard-pnl`);
    await page.screenshot({
      path: path.join(outDir, `dashboard-pnl.jpg`),
      type: 'jpeg',
      quality: 90
    });
    
    // Capture buyer-messages
    console.log(` -> buyer-messages`);
    await page.goto(`${BASE_URL}/actions?lng=${locale}`, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 1500));
    await page.screenshot({
      path: path.join(outDir, `buyer-messages.jpg`),
      type: 'jpeg',
      quality: 90
    });
  }

  await browser.close();
  console.log('✅ Done!');
}

capture().catch(err => {
  console.error('Failed to capture:', err);
  process.exit(1);
});
