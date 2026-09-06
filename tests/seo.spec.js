import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { clockCardText, renderClockCard } from '../server/clock-card.js';

const origin = 'https://cusemit.o-d.dev';

test('crawlers receive canonical metadata and structured data without JavaScript', async ({ browser, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await expect(page).toHaveTitle('Cusemit — Free Fullscreen Clock & Countdown Timers');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', origin + '/');
  for (const name of ['og:image', 'og:image:secure_url']) {
    await expect(page.locator(`meta[property="${name}"]`)).toHaveAttribute('content', origin + '/api/og');
  }
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', origin + '/api/og');
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(schema['@type']).toBe('WebApplication');
  expect(schema.url).toBe(origin + '/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Cusemit');
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Sitemap: ' + origin + '/sitemap.xml');
  expect(await robots.text()).toContain('Allow: /api/og');
  const sitemap = await request.get('/sitemap.xml');
  expect(await sitemap.text()).toContain('<loc>' + origin + '/</loc>');
  await context.close();
});

test('share endpoint serves a current-time PNG with short cache lifetime and a static fallback', async ({ request }) => {
  const before = Date.now();
  const response = await request.get('/api/og');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/png');
  expect(response.headers()['cache-control']).toBe('public, max-age=0, s-maxage=60, must-revalidate');
  const generated = Date.parse(response.headers()['x-clock-generated-at']);
  expect(generated).toBeGreaterThanOrEqual(before);
  expect(generated).toBeLessThanOrEqual(Date.now());
  const png = PNG.sync.read(await response.body());
  expect([png.width, png.height]).toEqual([1200, 630]);
  const fallback = PNG.sync.read(await (await request.get('/og-image.png')).body());
  expect([fallback.width, fallback.height]).toEqual([1200, 630]);
  const head = await request.head('/api/og');
  expect(head.status()).toBe(200);
  expect((await head.body()).length).toBe(0);
  expect((await request.post('/api/og')).status()).toBe(405);
});

test('rendered time rolls over at UTC midnight and changes image pixels', async () => {
  const before = new Date('2026-09-06T23:59:59Z');
  const after = new Date('2026-09-07T00:00:00Z');
  expect(clockCardText(before)).toEqual({ time: '23:59', date: '6 September 2026' });
  expect(clockCardText(after)).toEqual({ time: '00:00', date: '7 September 2026' });
  const a = Buffer.from(await renderClockCard(before).arrayBuffer());
  const b = Buffer.from(await renderClockCard(after).arrayBuffer());
  expect(a.equals(b)).toBe(false);
});

test('installed service worker does not replace OG image navigation with clock HTML', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const response = await page.goto('/api/og');
  expect(response.headers()['content-type']).toBe('image/png');
  await expect(page.locator('img')).toBeVisible();
  await page.screenshot({ path: 'artifacts/og-browser.png' });
});
