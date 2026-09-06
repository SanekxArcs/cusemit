import { test, expect } from '@playwright/test';

async function openClock(page, settings = {}) {
  // Interaction regressions use the system fallback so they do not depend on
  // Google's availability. The font/offline tests cover real downloaded fonts.
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
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

test('pointer focus does not keep the side rail visible; keyboard focus reveals it', async ({
  page,
}) => {
  await page.clock.install();
  await openClock(page, { autoHideControls: true });
  await page
    .getByRole('button', { name: 'Clock settings', exact: true })
    .click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.clock.fastForward(12000);
  await expect(
    page.getByRole('navigation', { name: 'Clock settings' })
  ).toHaveClass(/rail-hidden/);
  await expect(
    page.getByRole('navigation', { name: 'Clock settings' })
  ).toHaveCSS('opacity', '0');
  await page.keyboard.press('Tab');
  await page.clock.runFor(1100);
  await expect(
    page.getByRole('navigation', { name: 'Clock settings' })
  ).toHaveCSS('opacity', '1');
});

test('display choices remain button grids on a narrow screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openClock(page);
  await page.getByRole('button', { name: 'Display settings' }).click();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  for (const name of ['Number flow', 'Shuffle', 'Typewriter']) {
    await page.getByRole('radio', { name, exact: true }).click();
    await expect(page.getByRole('radio', { name, exact: true })).toBeChecked();
  }
  const overflow = await page
    .locator('.ui-segments[data-columns]')
    .evaluateAll((groups) =>
      groups.some((g) => g.scrollWidth > g.clientWidth + 1)
    );
  expect(overflow).toBe(false);
  await page.getByRole('radio', { name: '90° clockwise', exact: true }).click();
  await page
    .getByRole('button', { name: 'Clock settings', exact: true })
    .click();
  await expect(
    page.getByRole('radiogroup', { name: 'Font weight' })
  ).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
});

for (const mode of ['flow', 'shuffle', 'type']) {
  test(
    mode + ' preserves label opacity and settles on the actual digits',
    async ({ page }) => {
      await openClock(page, {
        animationMode: mode,
        showTopText: true,
        topText: '1234',
        showSeconds: true,
      });
      await page.getByRole('button', { name: 'Display settings' }).click();
      await page.getByRole('textbox', { name: 'Top label text' }).fill('5678');
      const label = page.locator('[data-clock-ink] > g').nth(1);
      const opacity = await label.evaluate((g) => {
        const text = g.querySelector('text') || g.querySelector('rect');
        let value = 1;
        for (
          let e = text;
          e && e.tagName.toLowerCase() !== 'svg';
          e = e.parentElement
        )
          value *= Number(getComputedStyle(e).opacity);
        return value;
      });
      expect(opacity).toBeCloseTo(0.6, 2);
      await expect
        .poll(() => label.locator('text').allTextContents())
        .toEqual(['5', '6', '7', '8']);
    }
  );
}

test('number flow survives the 200ms updates from a running timer', async ({
  page,
}) => {
  await openClock(page, {
    animationMode: 'flow',
    showSeconds: true,
    timers: [
      {
        id: 'regression-timer',
        label: 'Tea',
        inputMode: 'datetime',
        targetDatetime: '2099-01-01T00:00',
        displayPosition: 'bottom',
        hours: 0,
        minutes: 5,
        floatX: 50,
        floatY: 80,
        floatScale: 1,
        floatRotation: 0,
        useClockFont: false,
      },
    ],
  });
  // Observe a main-clock roll across multiple timer-driven parent renders.
  const duration = await page.evaluate(async () => {
    const main = document.querySelector('[data-clock-ink] > g');
    return new Promise((resolve) => {
      let slot = null,
        start = 0;
      const deadline = performance.now() + 5000;
      const frame = () => {
        if (!slot) {
          slot = main.querySelector('[data-flow-slot]');
          if (slot) start = performance.now();
        } else if (!slot.isConnected) {
          resolve(performance.now() - start);
          return;
        }
        if (performance.now() > deadline) {
          resolve(0);
          return;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  });
  expect(duration).toBeGreaterThan(250);
});

test('reduced motion bypasses shuffle, caret, and rolling animations', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openClock(page, {
    animationMode: 'shuffle',
    showTopText: true,
    topText: '1234',
  });
  const label = page.locator('[data-clock-ink] > g').nth(1);
  await expect(label.locator('text')).toHaveText(['1', '2', '3', '4']);
  await expect(page.locator('[data-flow-slot]')).toHaveCount(0);
});
