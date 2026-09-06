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
}

test('editing a duration updates the countdown and starts without Reset', async ({ page }) => {
  await openTimer(page);
  const readout = page.locator('.timer-readout');
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await page.getByLabel('Minutes', { exact: true }).fill('0');
  await expect(start).toBeDisabled();
  await page.getByLabel('Minutes', { exact: true }).fill('5');
  await expect(readout).toContainText('00:05:00');
  await start.click();
  await expect(readout).toContainText('Running');
  await page.clock.setFixedTime(new Date('2026-09-06T12:00:10'));
  await expect(readout).toContainText('00:04:50');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await start.click();
  await expect(readout).toContainText('00:04:50');
  await page.clock.setFixedTime(new Date('2026-09-06T12:00:20'));
  await expect(readout).toContainText('00:04:40');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByLabel('Hours', { exact: true }).fill('1');
  await expect(readout).toContainText('01:05:00');
  await start.click();
  await expect(readout).toContainText('Running');
});

test('editing a running or expired timer prepares the new duration; Start can restart it', async ({ page }) => {
  await openTimer(page);
  const readout = page.locator('.timer-readout');
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await start.click();
  await page.getByLabel('Minutes', { exact: true }).fill('1');
  await expect(readout).toContainText('00:01:00Ready when you are');
  await start.click();
  await page.clock.setFixedTime(new Date('2026-09-06T12:01:01'));
  await expect(readout).toContainText('Time is up');
  await start.click();
  await expect(readout).toContainText('00:01:00Running');
  await page.clock.setFixedTime(new Date('2026-09-06T12:02:02'));
  await expect(readout).toContainText('Time is up');
  await page.getByLabel('Minutes', { exact: true }).fill('2');
  await expect(readout).toContainText('00:02:00Ready when you are');
  await start.click();
  await expect(readout).toContainText('Running');
});

test('switching from a target date restores duration and editing another timer preserves progress', async ({ page }) => {
  await openTimer(page);
  await page.getByRole('radio', { name: 'Date & time', exact: true }).click();
  await page.getByLabel('Target date and time').fill('2026-09-06T13:00');
  await expect(page.locator('.timer-readout')).toContainText('01:00:00Running');
  await page.getByRole('radio', { name: 'Duration', exact: true }).click();
  await expect(page.locator('.timer-readout')).toContainText('00:05:00Ready when you are');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.setFixedTime(new Date('2026-09-06T12:00:10'));
  await expect(page.locator('.timer-readout')).toContainText('00:04:50');
  await page.getByRole('button', { name: 'Add timer', exact: true }).click();
  await page.getByLabel('Minutes', { exact: true }).nth(1).fill('15');
  await page.getByLabel('Timer 1 name').fill('Tea');
  await expect(page.locator('.timer-readout').first()).toContainText('00:04:50Running');
});
