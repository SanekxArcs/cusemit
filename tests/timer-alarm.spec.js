import { test, expect } from '@playwright/test';

async function openTimer(page) {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('app.clock.settings.v1', JSON.stringify({
      autoHideControls: false,
      animationMode: 'none',
    }));
  });
  await page.clock.setFixedTime(new Date('2026-09-06T12:00:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Timers', exact: true }).click();
  await page.getByRole('button', { name: 'Add timer', exact: true }).click();
  await page.getByLabel('Minutes', { exact: true }).fill('1');
}

test('a finished timer keeps alerting until the screen is tapped', async ({ page }) => {
  await openTimer(page);
  await page.getByRole('radio', { name: 'None', exact: true }).click();
  await page.getByRole('switch', { name: /Flash the screen/ }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.setFixedTime(new Date('2026-09-06T12:01:01'));

  const alarm = page.getByRole('alertdialog');
  await expect(alarm).toBeVisible();
  await expect(alarm).toHaveClass(/timer-alarm-flash/);
  await page.clock.setFixedTime(new Date('2026-09-06T12:01:30'));
  await expect(alarm).toBeVisible();

  await page.mouse.click(40, 40);
  await expect(alarm).toBeHidden();
  // The tap only stops the alarm; the timer and its panel stay put.
  await expect(page.locator('.timer-readout')).toContainText('Time is up');
});

test('an auto-deleted timer still alerts after it is gone', async ({ page }) => {
  await openTimer(page);
  await page.getByRole('switch', { name: 'Auto-delete when done' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.setFixedTime(new Date('2026-09-06T12:01:01'));

  const alarm = page.getByRole('alertdialog');
  await expect(alarm).toBeVisible();
  await expect(page.locator('.timer-readout')).toHaveCount(0);
  await expect(alarm).toBeVisible();

  await page.keyboard.press('Space');
  await expect(alarm).toBeHidden();
});

test('no sound and no flash means no alarm', async ({ page }) => {
  await openTimer(page);
  await page.getByRole('radio', { name: 'None', exact: true }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.setFixedTime(new Date('2026-09-06T12:01:01'));
  await expect(page.locator('.timer-readout')).toContainText('Time is up');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});
