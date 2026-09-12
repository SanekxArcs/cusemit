import { test, expect } from '@playwright/test';

const key = 'app.clock.settings.v1';
const syncKey = 'app.clock.sync.v1';

/** Loads the app with a known local state and no leftover sync link. */
async function setup(page, settings = {}) {
  await page.addInitScript(
    ({ key, syncKey, settings }) => {
      localStorage.removeItem(syncKey);
      localStorage.setItem(
        key,
        JSON.stringify({
          animationMode: 'none',
          autoHideControls: false,
          pulseColon: false,
          ...settings,
        })
      );
    },
    { key, syncKey, settings }
  );
  await page.goto('/');
  await expect(page.locator('.clock-svg')).toBeVisible();
}

async function openSync(page) {
  await page.getByRole('button', { name: 'About Cusemit' }).click();
  await expect(page.getByText('Sync across devices')).toBeVisible();
}

test('a code carries appearance settings to another device, but not position', async ({
  browser,
}) => {
  const source = await browser.newContext();
  const sourcePage = await source.newPage();
  // Device A: a red clock in 12-hour format, positioned manually.
  await setup(sourcePage, {
    clockColor: '#ff2200',
    clockFormat: '12h',
    showSeconds: true,
    autoFit: false,
    offsetX: 30,
  });
  await openSync(sourcePage);
  await sourcePage.getByRole('button', { name: 'Create a sync code' }).click();

  const codeText = sourcePage.locator('.sync-code strong');
  await expect(codeText).toBeVisible({ timeout: 20000 });
  const code = (await codeText.textContent()).trim();
  expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  await expect(sourcePage.getByText('Nothing to upload')).toBeVisible();

  // Device B: a default-looking clock with its own manual position.
  const target = await browser.newContext();
  const targetPage = await target.newPage();
  await setup(targetPage, { autoFit: false, offsetX: -45 });
  await openSync(targetPage);
  await targetPage.getByLabel('Sync code').fill(code);
  await targetPage.getByRole('button', { name: 'Use code' }).click();
  await expect(targetPage.locator('.sync-code strong')).toHaveText(code, {
    timeout: 20000,
  });

  const applied = await targetPage.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    key
  );
  expect(applied.clockColor).toBe('#ff2200');
  expect(applied.clockFormat).toBe('12h');
  expect(applied.showSeconds).toBe(true);
  // Positioning is this device's own business.
  expect(applied.offsetX).toBe(-45);

  // Device B changes something and uploads it back.
  await targetPage.getByRole('button', { name: 'Clock settings' }).click();
  await targetPage.getByRole('switch', { name: 'Outline' }).click();
  await openSync(targetPage);
  const upload = targetPage.getByRole('button', { name: 'Upload changes' });
  await expect(upload).toBeEnabled();
  await upload.click();
  await expect(targetPage.getByText('Nothing to upload')).toBeVisible({
    timeout: 20000,
  });

  // Device A pulls the change back down.
  await sourcePage.getByRole('button', { name: 'Download settings' }).click();
  await expect
    .poll(
      async () =>
        (await sourcePage.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)).showStroke,
          key
        )) === true,
      { timeout: 20000 }
    )
    .toBe(true);

  await source.close();
  await target.close();
});

test('an unknown code is reported rather than silently connecting', async ({
  page,
}) => {
  await setup(page);
  await openSync(page);
  await page.getByLabel('Sync code').fill('ZZZZ-ZZZZ');
  await page.getByRole('button', { name: 'Use code' }).click();
  await expect(page.getByText('No settings found for that code.')).toBeVisible({
    timeout: 20000,
  });
});
