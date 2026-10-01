import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Europe/London' });

async function openClock(page, settings = {}, time = '2026-06-21T03:00:00+01:00') {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.clock.install({ time: new Date(time) });
  await page.addInitScript((settings) => {
    localStorage.setItem(
      'app.clock.settings.v1',
      JSON.stringify({
        autoHideControls: false,
        animationMode: 'none',
        pulseColon: false,
        ...settings,
      })
    );
  }, settings);
  await page.goto('/');
  await expect(page.locator('.clock-svg')).toBeVisible();
}

const dimmerOpacity = (page) =>
  page
    .locator('.brightness-dimmer')
    .evaluate((el) => Number(el.style.opacity));

test('dimming is off by default', async ({ page }) => {
  await openClock(page);
  expect(await dimmerOpacity(page)).toBe(0);
});

test('custom curve holds the night level and eases into the next point', async ({
  page,
}) => {
  // Default points: 07:00 → 100 %, 22:00 → 20 %, with a 60-minute transition.
  // 05:00 avoids crossing the app's 04:00 daily reload when time jumps.
  await openClock(page, { brightnessMode: 'custom' }, '2026-06-21T05:00:00+01:00');
  expect(await dimmerOpacity(page)).toBeCloseTo(0.8, 2);

  // Halfway through the 06:00–07:00 ease the level sits at the midpoint.
  await page.clock.setSystemTime(new Date('2026-06-21T06:30:00+01:00'));
  await page.clock.runFor(16_000);
  expect(await dimmerOpacity(page)).toBeCloseTo(0.4, 1);
});

test('sun mode uses the saved location for sunrise and sunset', async ({
  page,
}) => {
  await openClock(
    page,
    {
      brightnessMode: 'sun',
      brightnessLatitude: 51.51,
      brightnessLongitude: -0.13,
    },
    '2026-06-21T12:00:00+01:00'
  );
  await page.getByRole('button', { name: 'Brightness settings' }).click();
  // London midsummer: sunrise about 04:43, sunset about 21:21 BST.
  await expect(page.getByText(/Sunrise 04:4\d · Sunset 21:2\d/)).toBeVisible();
  expect(await dimmerOpacity(page)).toBe(0);
});

test('tapping the graph adds a point that can be removed', async ({ page }) => {
  await openClock(page, { brightnessMode: 'custom' }, '2026-06-21T12:00:00+01:00');
  await page.getByRole('button', { name: 'Brightness settings' }).click();
  const curve = page.locator('svg.brightness-curve');
  await expect(curve.locator('.curve-point')).toHaveCount(2);

  const box = await curve.boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(curve.locator('.curve-point')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Remove point' })).toBeVisible();

  await page.getByRole('button', { name: 'Remove point' }).click();
  await expect(curve.locator('.curve-point')).toHaveCount(2);
});
