/**
 * Captures every app screenshot the landing page uses, once per locale, from
 * the sign-up-free demo account. Follows the recipe in CLAUDE.md ("Recapture
 * recipe"): locale pinned via `localStorage.locale` (the app otherwise follows
 * the browser's language), the demo banner and scrollbars hidden, the
 * sidebar collapsed (so the content fills the frame) and every capture taken
 * at 2x device pixels — the landing scales these down into small frames, and a
 * 1x capture shown on a retina screen was visibly soft.
 *
 *   1. Run the web app:   pnpm --filter web exec vite --port 5199
 *   2. Capture:           node scripts/capture-screens.mjs
 *
 * Env:
 *   BASE_URL          dev server (default http://127.0.0.1:5199)
 *   CHROME_PATH       a Chromium/Chrome binary, when Puppeteer's own is not downloaded
 *   LOCALES           comma-separated, default "en,tr"
 *   OUT_DIR           write somewhere other than apps/web/public/landing-screens
 *
 * Template previews (`landing-screens/templates/`) are a separate script,
 * `scripts/build-template-previews.mjs`, because they are not app UI.
 */
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.OUT_DIR ?? path.resolve(__dirname, '../apps/web/public/landing-screens');
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5199';
const LOCALES = (process.env.LOCALES ?? 'en,tr').split(',');

/** Hides the fixed demo banner (real in the demo, wrong on a marketing page), scrollbars and motion. */
const HIDE_CSS = `
  [role="status"] { display: none !important; }
  ::-webkit-scrollbar { display: none; }
  * { scrollbar-width: none; }
  *, *::before, *::after { transition: none !important; animation: none !important; }
`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function open(page, locale, route) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((l) => {
    localStorage.setItem('locale', l);
    sessionStorage.setItem('sellerhill_demo', '1');
  }, locale);
  await page.goto(`${BASE_URL}/${locale}${route}`, { waitUntil: 'networkidle0' });
  await page.addStyleTag({ content: HIDE_CSS });
  await page.evaluate(() => document.fonts.ready);
  await wait(1200);
  const viewport = page.viewport();
  if (viewport && viewport.width >= 1024) await collapseSidebar(page);
}

/** The desktop sidebar can collapse to an icon rail; captured collapsed, the screen gives its width to the content. */
async function collapseSidebar(page) {
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button[aria-label]')].find((el) =>
      /Collapse sidebar|Kenar çubuğunu daralt/.test(el.getAttribute('aria-label') ?? '')
    );
    button?.click();
  });
  await wait(400);
}

/** Walks up from an element until it reaches the card that contains it. */
async function enclosingCard(handle) {
  return handle.evaluateHandle((el) => {
    let node = el;
    while (node && node.getBoundingClientRect().height < 500) {
      node = node.parentElement;
    }
    return node;
  });
}

async function captureLocale(browser, locale) {
  const dir = path.join(ROOT, locale);
  fs.mkdirSync(dir, { recursive: true });
  const shot = (name) => ({ path: path.join(dir, `${name}.webp`), type: 'webp', quality: 86 });
  const page = await browser.newPage();

  // Hero pair + element captures — 1440×900 @2x.
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await open(page, locale, '/dashboard');
  await page.screenshot(shot('hero-dashboard'));
  // The SELECTED period card; unqualified [aria-pressed] matches all four.
  await (await page.$('[role="button"][aria-pressed="true"]')).screenshot(shot('hero-kpi-card'));

  await open(page, locale, '/settings?drawer=listingGroupsAll');
  const dialogs = await page.$$('[role="dialog"]');
  await dialogs[dialogs.length - 1].screenshot(shot('setting-groups'));

  // Showcase + profit screens — a narrower 1180px window, cropped to the page
  // content (no header/sidebar/footer), so the UI stays legible scaled into
  // the landing's ~620px frames. A full 1366px window shrunk that far was the
  // "blurry screenshots" complaint: nothing was out of focus, the text was tiny.
  await page.setViewport({ width: 1180, height: 780, deviceScaleFactor: 2 });
  const HIDE_FOOTER = 'footer { display: none !important; }';
  for (const [route, name] of [
    ['/actions', 'action-center'],
    ['/dashboard?tab=chart', 'dashboard-chart'],
    ['/dashboard?tab=pnl', 'dashboard-pnl'],
    ['/orders/demo-order-1', 'order-detail'],
  ]) {
    await open(page, locale, route);
    await page.addStyleTag({ content: HIDE_FOOTER });
    const main = await page.$('main');
    const box = await main.boundingBox();
    await page.screenshot({ ...shot(name), clip: { x: box.x, y: 0, width: box.width, height: 780 } });
  }

  await open(page, locale, '/listings/demo-listing-4');
  await page.addStyleTag({ content: HIDE_FOOTER });
  const heading = await page.evaluateHandle((label) => {
    return [...document.querySelectorAll('span, h2, h3, div')].find(
      (el) => el.childElementCount === 0 && el.textContent.trim().toLowerCase() === label
    );
  }, locale === 'tr' ? 'ürün içeriği' : 'product content');
  await heading.evaluate((el) => {
    el.scrollIntoView({ block: 'start' });
    // The app header is sticky: pull the card back out from under it.
    for (let node = el.parentElement; node; node = node.parentElement) {
      if (node.scrollTop > 0) {
        node.scrollTop -= 110;
        break;
      }
    }
  });
  await wait(500);
  await (await enclosingCard(heading)).screenshot(shot('item-specifics'));

  // Listing detail with its price/stock revision history open (full window — the drawer is outside <main>).
  await open(page, locale, '/listings/demo-listing-4');
  await page.evaluate((label) => {
    const target = [...document.querySelectorAll('button, span, a')].find((el) => el.textContent.trim() === label);
    target?.click();
  }, locale === 'tr' ? 'Revizyonlar' : 'Revisions');
  await wait(1200);
  await page.screenshot(shot('listing-detail'));

  // Phone captures — 390×844 @2x, app footer hidden.
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  for (const [route, name] of [
    ['/dashboard', 'mobile-dashboard'],
    ['/actions', 'mobile-actions'],
    ['/orders', 'mobile-orders'],
  ]) {
    await open(page, locale, route);
    await page.addStyleTag({ content: 'footer { display: none !important; }' });
    if (name === 'mobile-orders') {
      // Start at the first order card rather than the filter panel.
      await page.evaluate(() => {
        const img = document.querySelector('main img');
        img?.scrollIntoView({ block: 'start' });
        // The app scrolls an inner container, not the window: nudge whichever one moved.
        for (let node = img?.parentElement; node; node = node.parentElement) {
          if (node.scrollTop > 0) {
            node.scrollTop -= 90;
            break;
          }
        }
      });
      await wait(400);
    }
    await page.screenshot(shot(name));
  }
  await page.close();
}

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox'],
});
try {
  for (const locale of LOCALES) {
    console.log(`Capturing ${locale}…`);
    await captureLocale(browser, locale);
  }
} finally {
  await browser.close();
}
console.log('Done.');
