import { test, expect } from '@playwright/test';

const storageKey = 'app.clock.voice.key.v1';
const modelEndpoint =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite';

function mockSync() {
  let remote = null;
  return async (route) => {
    const body = route.request().postDataJSON();
    const args = Array.isArray(body.args) ? body.args[0] : body.args;
    let value;
    if (body.path === 'settings:create') {
      remote = { payload: args.payload, revision: 1, updatedAt: Date.now() };
      value = { code: 'ABCD2345', ...remote };
    } else if (body.path === 'settings:push') {
      remote = {
        payload: args.payload,
        revision: remote.revision + 1,
        updatedAt: Date.now(),
      };
      value = { status: 'updated', ...remote };
    } else value = remote;
    await route.fulfill({ json: { status: 'success', value } });
  };
}

async function setup(page, handler, apiKey = '') {
  await page.route('**/api/query', handler);
  await page.route('**/api/mutation', handler);
  await page.route(modelEndpoint, (route) =>
    route.fulfill({ json: { supportedGenerationMethods: ['generateContent'] } })
  );
  await page.addInitScript(
    ({ storageKey, apiKey }) => {
      if (!sessionStorage.getItem('voice-key-test')) {
        sessionStorage.setItem('voice-key-test', 'true');
        localStorage.setItem(
          'app.clock.settings.v1',
          JSON.stringify({ animationMode: 'none', autoHideControls: false })
        );
        if (apiKey) localStorage.setItem(storageKey, apiKey);
      }
    },
    { storageKey, apiKey }
  );
  await page.goto('/');
}

async function syncPanel(page) {
  await page.getByRole('button', { name: 'About Cusemit' }).click();
  await expect(page.getByText('Sync across devices')).toBeVisible();
}

async function voicePanel(page) {
  await page
    .getByRole('button', { name: 'Voice settings', exact: true })
    .click();
}

async function storedKey(page) {
  return page.evaluate((key) => localStorage.getItem(key), storageKey);
}

test('manual sync transfers a key, restores it after reload and propagates forgetting', async ({
  browser,
}) => {
  const handler = mockSync();
  const source = await browser.newContext();
  const target = await browser.newContext();
  try {
    const first = await source.newPage();
    const second = await target.newPage();
    await setup(first, handler, 'fake-key-source');
    await syncPanel(first);
    await expect(
      first.getByText('Anyone with this code can retrieve', { exact: false })
    ).toBeVisible();
    await first.getByRole('button', { name: 'Create a sync code' }).click();
    await expect(first.locator('.sync-code strong')).toHaveText('ABCD-2345');
    await setup(second, handler);
    await syncPanel(second);
    await second.getByLabel('Sync code').fill('ABCD-2345');
    await second.getByRole('button', { name: 'Use code' }).click();
    await expect.poll(() => storedKey(second)).toBe('fake-key-source');
    await second.reload();
    await expect(second.locator('.voice-dock')).toBeVisible();
    await voicePanel(second);
    await expect(
      second.getByLabel('Gemini API key', { exact: true })
    ).toHaveValue('fake-key-source');
    await expect(
      second.getByRole('button', { name: 'Key verified' })
    ).toBeVisible();
    await second.getByRole('button', { name: 'Forget key' }).click();
    await syncPanel(second);
    await second.getByRole('button', { name: 'Upload changes' }).click();
    await expect(
      second.getByRole('button', { name: 'Nothing to upload' })
    ).toBeVisible();
    await first.getByRole('button', { name: 'Download settings' }).click();
    await expect.poll(() => storedKey(first)).toBeNull();
    await first.reload();
    await expect(first.locator('.voice-dock')).toHaveCount(0);
    await voicePanel(first);
    await expect(
      first.getByLabel('Gemini API key', { exact: true })
    ).toBeEmpty();
  } finally {
    await source.close();
    await target.close();
  }
});

for (const extra of [{}, { geminiApiKey: 42 }]) {
  test(
    'legacy or invalid key preserves local key: ' + JSON.stringify(extra),
    async ({ page }) => {
      const remote = {
        payload: JSON.stringify({ clockColor: '#ff2200', ...extra }),
        revision: 1,
        updatedAt: Date.now(),
      };
      await setup(
        page,
        (route) =>
          route.fulfill({ json: { status: 'success', value: remote } }),
        'fake-local-key'
      );
      await syncPanel(page);
      await page.getByLabel('Sync code').fill('ABCD-2345');
      await page.getByRole('button', { name: 'Use code' }).click();
      await expect(page.locator('.sync-code strong')).toHaveText('ABCD-2345');
      expect(await storedKey(page)).toBe('fake-local-key');
      await expect(
        page.getByRole('button', { name: 'Upload changes' })
      ).toBeEnabled();
    }
  );
}

test('saved key verifies again after reload and reconnect', async ({
  page,
  context,
}) => {
  await setup(page, mockSync(), 'fake-local-key');
  await expect(page.locator('.voice-dock')).toBeVisible();
  await page.reload();
  await expect(page.locator('.voice-dock')).toBeVisible();
  await context.setOffline(true);
  await expect(page.locator('.voice-dock')).toHaveCount(0);
  expect(await storedKey(page)).toBe('fake-local-key');
  await context.setOffline(false);
  await expect(page.locator('.voice-dock')).toBeVisible();
});

test('forgetting during validation cannot restore an old key', async ({
  page,
}) => {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await setup(page, mockSync());
  await page.route(modelEndpoint, async (route) => {
    await held;
    await route
      .fulfill({ json: { supportedGenerationMethods: ['generateContent'] } })
      .catch(() => {});
  });
  await voicePanel(page);
  await page
    .getByLabel('Gemini API key', { exact: true })
    .fill('fake-pending-key');
  const sent = page.waitForRequest(modelEndpoint);
  await page.getByRole('button', { name: 'Check key', exact: true }).click();
  await sent;
  await page.getByRole('button', { name: 'Forget key' }).click();
  release();
  await expect(page.getByLabel('Gemini API key', { exact: true })).toBeEmpty();
  expect(await storedKey(page)).toBeNull();
  await page
    .getByRole('button', { name: 'Close settings', exact: true })
    .click();
  await expect(page.locator('.voice-dock')).toHaveCount(0);
});

test('offline startup preserves key and checks only after online event', async ({
  page,
}) => {
  let checks = 0;
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'onLine', {
      get: () => window.testOnline === true,
    })
  );
  await setup(page, mockSync(), 'fake-offline-key');
  await page.route(modelEndpoint, (route) => {
    checks++;
    return route.fulfill({
      json: { supportedGenerationMethods: ['generateContent'] },
    });
  });
  await voicePanel(page);
  await expect(page.getByLabel('Gemini API key', { exact: true })).toHaveValue(
    'fake-offline-key'
  );
  expect(checks).toBe(0);
  await page.evaluate(() => {
    window.testOnline = true;
    window.dispatchEvent(new Event('online'));
  });
  await expect(
    page.getByRole('button', { name: 'Key verified' })
  ).toBeVisible();
  expect(checks).toBe(1);
});

test('persisted key is not trusted when automatic validation rejects it', async ({
  page,
}) => {
  await setup(page, mockSync());
  await page.evaluate(
    (key) => localStorage.setItem(key, 'fake-rejected-key'),
    storageKey
  );
  await page.route(modelEndpoint, (route) =>
    route.fulfill({ status: 403, json: {} })
  );
  await page.reload();
  await voicePanel(page);
  await expect(page.getByRole('alert')).toContainText('Key check failed');
  await expect(
    page.getByRole('button', { name: 'Check key', exact: true })
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Close settings', exact: true })
    .click();
  await expect(page.locator('.voice-dock')).toHaveCount(0);
  expect(await storedKey(page)).toBe('fake-rejected-key');
});
