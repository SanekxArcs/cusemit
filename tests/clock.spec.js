import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

const key = 'app.clock.settings.v1';
async function setup(page, settings = {}) {
  await page.addInitScript(
    ({ key, settings }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(
          key,
          JSON.stringify({
            animationMode: 'none',
            autoHideControls: false,
            solidColor: '#000000',
            pulseColon: false,
            ...settings,
          })
        );
    },
    { key, settings }
  );
  await page.clock.setFixedTime(new Date('2026-09-06T18:48:28'));
  await page.goto('/');
  await expect(page.locator('.clock-svg')).toBeVisible();
}
async function checkInk(page, padding = 16) {
  await page.evaluate(() => document.fonts.ready);
  const buffer = await page.screenshot({
    style:
      '.settings-rail, .settings-panel, [data-sonner-toaster] { visibility: hidden !important; }',
  });
  const png = PNG.sync.read(buffer);
  let left = png.width,
    right = 0,
    top = png.height,
    bottom = 0;
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      if (png.data[i] > 100 || png.data[i + 1] > 100 || png.data[i + 2] > 100) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  const edges = [left, png.width - 1 - right, top, png.height - 1 - bottom];
  expect(Math.min(...edges), JSON.stringify(edges)).toBeGreaterThanOrEqual(
    padding - 5
  );
  expect(Math.min(...edges), JSON.stringify(edges)).toBeLessThanOrEqual(
    padding + 5
  );
  expect(Math.abs(edges[0] - edges[1]), JSON.stringify(edges)).toBeLessThan(8);
  expect(Math.abs(edges[2] - edges[3]), JSON.stringify(edges)).toBeLessThan(8);
}

for (const [font, size, extra] of [
  ['Inter', [360, 800], {}],
  ['Bebas Neue', [844, 390], {}],
  ['Orbitron', [1280, 720], { showSeconds: true }],
  [
    'Playfair Display',
    [390, 844],
    { clockFormat: '12h', ampmPosition: 'after' },
  ],
  [
    'JetBrains Mono',
    [844, 390],
    {
      showTopText: true,
      topText: 'FOCUS',
      showBottomText: true,
      bottomText: 'One thing at a time',
    },
  ],
  ['Modak', [360, 800], { orientation: 'rotate90' }],
  [
    'Inter',
    [844, 390],
    {
      orientation: 'rotate270',
      clockFormat: '12h',
      ampmPosition: 'top',
      showSeconds: true,
    },
  ],
  [
    'Inter',
    [320, 568],
    {
      orientation: 'rotate180',
      clockFormat: '12h',
      ampmPosition: 'bottom',
      edgePadding: 0,
    },
  ],
]) {
  test(
    'visible ink fits ' + font + ' ' + size + ' ' + JSON.stringify(extra),
    async ({ page }) => {
      await page.setViewportSize({ width: size[0], height: size[1] });
      await setup(page, { fontFamily: font, ...extra });
      // Use the public selector so the check includes font loading and the live renderer.
      await page
        .getByRole('button', { name: 'Clock settings', exact: true })
        .click();
      await page.getByRole('button', { name: font, exact: true }).click();
      await expect(page.locator('.font-status')).not.toContainText('Loading', {
        timeout: 30000,
      });
      await expect(page.locator('.font-status')).toContainText(
        'Available offline',
        { timeout: 30000 }
      );
      await page.getByRole('button', { name: 'Close settings' }).click();
      await checkInk(page, extra.edgePadding ?? 16);
    }
  );
}

// A ticking glyph must animate in place. Framer's `x`/`y` are transform keys,
// so animating them on an element that also carries `x`/`y` SVG attributes
// seeds the transform from those attributes -- the seconds used to fly in from
// most of a screen away, worst on the rightmost digits.
for (const mode of ['fade', 'slide-v', 'zoom', 'none']) {
  test('ticking digit animates in place - ' + mode, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    // Deliberately not setup(): it pins the clock, and this needs a real tick.
    await page.addInitScript(
      ({ key, mode }) => {
        if (!localStorage.getItem(key))
          localStorage.setItem(
            key,
            JSON.stringify({
              autoHideControls: false,
              solidColor: '#000000',
              showSeconds: true,
              animationMode: mode,
            })
          );
      },
      { key, mode }
    );
    await page.goto('/');
    await expect(page.locator('.clock-svg')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const { maxStray, glyphWidth } = await page.evaluate(async () => {
      const last = () => {
        const t = document.querySelectorAll('.clock-svg text');
        return t[t.length - 1];
      };
      const startChar = last().textContent;
      await new Promise((done) => {
        const iv = setInterval(() => {
          if (last().textContent !== startChar) {
            clearInterval(iv);
            done();
          }
        }, 16);
      });
      const lefts = [];
      const t0 = performance.now();
      await new Promise((done) => {
        const step = () => {
          lefts.push(last().getBoundingClientRect().left);
          if (performance.now() - t0 < 600) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      });
      const rest = last().getBoundingClientRect();
      return {
        glyphWidth: rest.width,
        maxStray: Math.max(...lefts.map((l) => Math.abs(l - rest.left))),
      };
    });
    // Scaling about a centre may shift the box by up to half a glyph; flying in
    // from a user-space offset put it whole screen-widths out.
    expect(
      maxStray,
      mode + ' strayed ' + Math.round(maxStray) + 'px from rest'
    ).toBeLessThan(glyphWidth);
  });
}

// 'flow' rolls the outgoing and incoming digits together through a clip slot,
// odometer style. The slot must stay filled the whole way, or the digit blinks.
test('flow keeps the digit slot filled while rolling', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(
    ({ key }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(
          key,
          JSON.stringify({
            autoHideControls: false,
            solidColor: '#000000',
            showSeconds: true,
            animationMode: 'flow',
          })
        );
    },
    { key }
  );
  await page.goto('/');
  await expect(page.locator('.clock-svg')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const frames = await page.evaluate(async () => {
    const chars = () =>
      [...document.querySelectorAll('.clock-svg text')]
        .map((t) => t.textContent)
        .join('');
    const start = chars();
    await new Promise((done) => {
      const iv = setInterval(() => {
        if (chars() !== start) {
          clearInterval(iv);
          done();
        }
      }, 4);
    });
    const out = [];
    const t0 = performance.now();
    await new Promise((done) => {
      const step = () => {
        const g = document.querySelector('.clock-svg g[clip-path]');
        if (g) {
          const id = g.getAttribute('clip-path').slice(5, -1);
          const rect = document.getElementById(id).querySelector('rect');
          const top = parseFloat(rect.getAttribute('y'));
          const bottom = top + parseFloat(rect.getAttribute('height'));
          const inner = g.querySelector('g');
          const m = new DOMMatrix(getComputedStyle(inner).transform);
          let covered = 0;
          for (const t of inner.querySelectorAll('text')) {
            const b = t.getBBox();
            covered += Math.max(
              0,
              Math.min(bottom, b.y + b.height + m.f) - Math.max(top, b.y + m.f)
            );
          }
          out.push({ slot: bottom - top, covered });
        }
        if (performance.now() - t0 < 700) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
    return out;
  });
  expect(frames.length, 'never caught a roll').toBeGreaterThan(3);
  const worst = frames.reduce((a, f) => (f.covered < a.covered ? f : a));
  expect(
    worst.covered,
    'slot only ' + Math.round(worst.covered) + '/' + worst.slot + ' filled'
  ).toBeGreaterThan(worst.slot * 0.9);
});

test('section controls, manual values, floating reset and mobile reload persist', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setup(page);
  await page.getByRole('button', { name: 'AMOLED settings' }).click();
  await page.getByRole('switch', { name: /^AMOLED mode/ }).click();
  await page.getByRole('button', { name: 'Background settings' }).click();
  await expect(
    page.getByText('Your base stays pure black.', { exact: false })
  ).toBeVisible();
  await expect(
    page.getByLabel('Background color', { exact: true })
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Dots', exact: true }).click();
  await expect(page.locator('.background-texture')).toHaveCSS(
    'background-image',
    /radial-gradient/
  );
  await page.getByRole('button', { name: 'Positioning settings' }).click();
  await page.getByRole('radio', { name: 'Manual', exact: true }).click();
  await page
    .getByRole('slider', { name: 'Horizontal position', exact: true })
    .press('ArrowRight');
  await page.getByRole('radio', { name: 'Automatic', exact: true }).click();
  await expect(
    page.getByRole('slider', { name: 'Horizontal position', exact: true })
  ).toHaveCount(0);
  await page.getByRole('radio', { name: 'Manual', exact: true }).click();
  await expect(
    page.getByRole('slider', { name: 'Horizontal position', exact: true })
  ).toHaveAttribute('aria-valuenow', '1');
  await page.getByRole('radio', { name: 'Floating', exact: true }).click();
  await page
    .getByRole('slider', { name: 'Horizontal position', exact: true })
    .press('End');
  await page
    .getByRole('button', { name: 'Center & reset', exact: true })
    .click();
  await expect(
    page.getByRole('slider', { name: 'Horizontal position', exact: true })
  ).toHaveAttribute('aria-valuenow', '50');
  await page.getByRole('button', { name: 'Display settings' }).click();
  await page.getByRole('switch', { name: 'Top label', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Top label text' })
    .fill('Stay curious');
  await page.reload();
  await page.getByRole('button', { name: 'Display settings' }).click();
  await expect(
    page.getByRole('textbox', { name: 'Top label text' })
  ).toHaveValue('Stay curious');
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/mobile-display.png' });
});

test('saved Google font and full app survive offline reload', async ({
  page,
  context,
}) => {
  await setup(page);
  await page
    .getByRole('button', { name: 'Clock settings', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add font', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Google Fonts family name' })
    .fill('Doto');
  await page.getByRole('button', { name: 'Add & save font' }).click();
  await expect(
    page.getByRole('button', { name: 'Saved', exact: true }).first()
  ).toBeDisabled({ timeout: 45000 });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.clock-svg')).toBeVisible();
  await page
    .getByRole('button', { name: 'Clock settings', exact: true })
    .click();
  await expect(page.locator('.font-status')).toContainText(
    'Available offline',
    { timeout: 15000 }
  );
  await expect(page.locator('.font-carousel')).toContainText('Doto');
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.fonts).some(
          (f) => f.family.replace(/"/g, '') === 'Doto' && f.status === 'loaded'
        )
      )
    )
    .toBe(true);
  await page.screenshot({ path: 'artifacts/offline-font.png' });
});

test('timers start, pause, reset and switch to a target date', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'Timers', exact: true }).click();
  await page.getByRole('button', { name: 'Add timer', exact: true }).click();
  await page.getByLabel('Timer 1 name').fill('Tea');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText('Running', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(
    page.getByText('Ready when you are', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('radio', { name: 'Date & time', exact: true }).click();
  await page.getByLabel('Target date and time').fill('2026-09-07T18:48');
  await expect(page.getByText('Running', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Floating', exact: true }).click();
  await expect(
    page.getByRole('switch', { name: 'Use clock font' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Display settings' }).click();
  await expect(
    page.getByRole('heading', { name: 'Display', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Timers', exact: true })
  ).toHaveCount(0);
});

test('uploaded background persists offline in AMOLED; invalid fonts are not saved', async ({
  page,
  context,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'AMOLED settings' }).click();
  await page.getByRole('switch', { name: /^AMOLED mode/ }).click();
  await page.getByRole('button', { name: 'Background settings' }).click();
  await page.getByRole('button', { name: 'Your image', exact: true }).click();
  const fixture = new PNG({ width: 32, height: 32 });
  fixture.data.fill(220);
  await page
    .getByLabel('Upload background image')
    .setInputFiles({
      name: 'texture.png',
      mimeType: 'image/png',
      buffer: PNG.sync.write(fixture),
    });
  await expect(
    page.getByRole('img', { name: 'Your background' })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Clock settings', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add font', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Google Fonts family name' })
    .fill('No Such Font Cusemit 99999');
  await page.getByRole('button', { name: 'Add & save font' }).click();
  await expect(page.getByText('Font not found.', { exact: false })).toBeVisible(
    { timeout: 30000 }
  );
  await expect(
    page.getByRole('button', {
      name: 'No Such Font Cusemit 99999',
      exact: true,
    })
  ).toHaveCount(0);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Background settings' }).click();
  await expect(
    page.getByRole('img', { name: 'Your background' })
  ).toBeVisible();
  await expect(page.locator('.app-viewport')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 0)'
  );
});
