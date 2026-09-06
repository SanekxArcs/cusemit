import { test, expect } from '@playwright/test';
import colors from 'tailwindcss/colors';

async function openBackground(page) {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.addInitScript(() => {
    if (!localStorage.getItem('app.clock.settings.v1')) {
      localStorage.setItem('app.clock.settings.v1', JSON.stringify({
        autoHideControls: false, animationMode: 'none',
      }));
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Background settings', exact: true }).click();
}

test('all Tailwind shades are selectable in a mobile accordion', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openBackground(page);
  const trigger = page.getByRole('button', { name: 'Background color', exact: true });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('radio', { name: 'Red 500', exact: true })).toHaveCount(0);
  await trigger.click();
  const palette = page.getByRole('radiogroup', { name: 'Background color swatches' });
  const families = Object.entries(colors).filter(([, shades]) => typeof shades === 'object');
  await expect(palette.getByRole('radio')).toHaveCount(families.length * 11 + 2);
  for (const [family, shades] of families) {
    const name = family[0].toUpperCase() + family.slice(1);
    for (const shade of Object.keys(shades)) {
      await expect(palette.getByRole('radio', { name: `${name} ${shade}`, exact: true })).toHaveCount(1);
    }
  }
  await page.getByRole('radio', { name: 'Red 500', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Red 500', exact: true })).toBeChecked();
  // Computed CSS normalizes the percentage lightness to a decimal.
  await expect(page.locator('.app-viewport')).toHaveCSS('background-color', 'oklch(0.637 0.237 25.331)');
  await page.getByRole('radio', { name: 'Red 500', exact: true }).press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Red 600', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('radio', { name: 'Red 600', exact: true })).toBeChecked();
  expect(await page.locator('.settings-panel').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  expect(await page.locator('.palette-grid').evaluateAll((rows) => rows.every((e) => e.scrollWidth <= e.clientWidth))).toBe(true);
  await page.screenshot({ path: 'artifacts/color-palette-mobile.png' });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('radio', { name: 'Red 600', exact: true })).toHaveCount(0);
});

test('custom colors validate, save once, persist and are shared with clock colors', async ({ page }) => {
  await openBackground(page);
  await page.getByRole('button', { name: 'Background color', exact: true }).click();
  await page.getByRole('button', { name: 'Add custom color', exact: true }).click();
  await page.getByLabel('Background color custom hex', { exact: true }).fill('#bad');
  await expect(page.getByRole('button', { name: 'Save & apply' })).toBeDisabled();
  await page.getByLabel('Background color custom hex', { exact: true }).fill('#ABC123');
  await page.getByRole('button', { name: 'Save & apply' }).click();
  await expect(page.getByRole('radio', { name: 'Custom #abc123', exact: true })).toBeChecked();
  await expect(page.locator('.app-viewport')).toHaveCSS('background-color', 'rgb(171, 193, 35)');
  await page.getByRole('button', { name: 'Add custom color', exact: true }).click();
  await page.getByRole('button', { name: 'Save & apply' }).click();
  await expect(page.getByRole('radio', { name: 'Custom #abc123', exact: true })).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: 'Clock settings', exact: true }).click();
  await page.getByRole('button', { name: 'Digits color', exact: true }).click();
  await page.getByRole('radio', { name: 'Custom #abc123', exact: true }).click();
  await expect(page.locator('.clock-svg text').first()).toHaveAttribute('fill', '#abc123');
  await page.getByRole('button', { name: 'Remove saved color', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Custom #abc123', exact: true })).toHaveCount(0);
  await expect(page.locator('.clock-svg text').first()).toHaveAttribute('fill', '#abc123');
});

test('gradient endpoints have independent palettes and AMOLED hides base color controls', async ({ page }) => {
  await openBackground(page);
  await page.getByRole('radio', { name: 'Gradient', exact: true }).click();
  await page.getByRole('button', { name: 'Start color', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'Start color swatches' }).getByRole('radio', { name: 'Blue 500', exact: true }).click();
  await page.getByRole('button', { name: 'End color', exact: true }).click();
  await page.getByRole('radiogroup', { name: 'End color swatches' }).getByRole('radio', { name: 'Rose 500', exact: true }).click();
  await expect(page.locator('.app-viewport')).toHaveCSS('background-image', new RegExp('oklch'));
  await expect(page.getByRole('button', { name: 'Start color', exact: true })).toContainText('Blue 500');
  await expect(page.getByRole('button', { name: 'End color', exact: true })).toContainText('Rose 500');
  await page.getByRole('button', { name: 'AMOLED settings', exact: true }).click();
  await page.getByRole('switch', { name: /^AMOLED mode/ }).click();
  await page.getByRole('button', { name: 'Background settings', exact: true }).click();
  await expect(page.locator('.color-accordion')).toHaveCount(0);
});
