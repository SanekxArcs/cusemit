import { test, expect } from '@playwright/test';

test('collection names load and display their own fonts before selection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Clock settings', exact: true }).click();
  for (const name of ['Poppins', 'Bebas Neue']) {
    const preview = page.locator('.font-name-preview').filter({ hasText: new RegExp(`^${name}$`) });
    await preview.scrollIntoViewIfNeeded();
    await expect(preview).toHaveAttribute('data-font-ready', 'true', { timeout: 45000 });
    await expect(preview).toHaveCSS('font-family', new RegExp(name));
    expect(await page.evaluate((name) => Array.from(document.fonts).some(
      (font) => font.family.replace(/"/g, '') === name && font.status === 'loaded'
    ), name)).toBe(true);
  }
  await expect(page.locator('.font-carousel')).toContainText('Inter');
  await page.screenshot({ path: 'artifacts/font-collection.png' });
});

test('label sizes and colors are independent, fit the screen and persist in floating mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.addInitScript(() => {
    if (!localStorage.getItem('app.clock.settings.v1')) {
      localStorage.setItem('app.clock.settings.v1', JSON.stringify({
        animationMode: 'none', autoHideControls: false, clockMode: 'gradient',
        showTopText: true, showBottomText: true, topText: 'FOCUS', bottomText: 'Stay curious',
        customColors: ['#ff0000', '#00ff00'],
      }));
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Display settings', exact: true }).click();
  await page.getByRole('slider', { name: 'Top label size', exact: true }).press('End');
  await page.getByRole('slider', { name: 'Bottom label size', exact: true }).press('Home');
  await page.getByRole('switch', { name: 'Use clock color for top label', exact: true }).click();
  await page.getByRole('button', { name: 'Top label color', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'Top label color swatches' }).getByRole('radio', { name: 'Custom #ff0000' }).click();
  await page.getByRole('button', { name: 'Top label color', exact: true }).click();
  await page.getByRole('switch', { name: 'Use clock color for bottom label', exact: true }).click();
  await page.getByRole('button', { name: 'Bottom label color', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'Bottom label color swatches' }).getByRole('radio', { name: 'Custom #00ff00' }).click();
  const rows = page.locator('[data-clock-ink] > g');
  const top = rows.nth(1).locator('text').first();
  const bottom = rows.nth(2).locator('text').first();
  await expect(top).toHaveAttribute('font-size', '80');
  await expect(top).toHaveAttribute('fill', '#ff0000');
  await expect(bottom).toHaveAttribute('font-size', '8');
  await expect(bottom).toHaveAttribute('fill', '#00ff00');
  await expect(rows.nth(1)).toHaveAttribute('opacity', '1');
  await expect(rows.first().locator('text').first()).toHaveAttribute('font-size', '100');
  const margins = await page.locator('[data-clock-ink]').evaluate((g) => {
    const b = JSON.parse(g.getAttribute('data-clock-ink'));
    const a = new DOMPoint(b.x, b.y).matrixTransform(g.getScreenCTM());
    const z = new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(g.getScreenCTM());
    return [a.x, a.y, innerWidth - z.x, innerHeight - z.y];
  });
  expect(Math.min(...margins)).toBeCloseTo(16, 1);
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.screenshot({ path: 'artifacts/independent-labels.png' });
  await page.getByRole('button', { name: 'Positioning settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Floating', exact: true }).click();
  await page.reload();
  await expect(top).toHaveAttribute('font-size', '80');
  await expect(top).toHaveAttribute('fill', '#ff0000');
  await expect(bottom).toHaveAttribute('font-size', '8');
  await expect(bottom).toHaveAttribute('fill', '#00ff00');
  await page.getByRole('button', { name: 'Display settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Use clock color for top label', exact: true }).click();
  await expect(top).toHaveAttribute('fill', /url\(#/);
  await expect(rows.nth(1)).toHaveAttribute('opacity', '0.6');
  await expect(bottom).toHaveAttribute('fill', '#00ff00');
});
