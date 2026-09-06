import { test, expect } from '@playwright/test';

const key = 'app.clock.settings.v1';

test('flow slot is never empty during a roll', async ({ page }) => {
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
          const rect = document
            .getElementById(id)
            .querySelector('rect');
          const top = parseFloat(rect.getAttribute('y'));
          const bottom = top + parseFloat(rect.getAttribute('height'));
          const inner = g.querySelector('g');
          const m = new DOMMatrix(getComputedStyle(inner).transform);
          // How much of the clip window each glyph's ink actually covers.
          let covered = 0;
          const parts = [];
          for (const t of inner.querySelectorAll('text')) {
            const b = t.getBBox();
            const a = Math.max(top, b.y + m.f);
            const z = Math.min(bottom, b.y + b.height + m.f);
            const v = Math.max(0, z - a);
            covered += v;
            parts.push({ ch: t.textContent, visible: +v.toFixed(1) });
          }
          out.push({
            t: Math.round(performance.now() - t0),
            dy: +m.f.toFixed(1),
            slot: +(bottom - top).toFixed(1),
            covered: +covered.toFixed(1),
            parts,
          });
        }
        if (performance.now() - t0 < 700) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
    return out;
  });

  expect(frames.length, 'never caught the roll').toBeGreaterThan(3);
  const slot = frames[0].slot;
  const worst = frames.reduce((a, f) => (f.covered < a.covered ? f : a));
  console.log('frames:', frames.length, 'slot:', slot);
  console.log('first :', JSON.stringify(frames[0]));
  console.log('worst :', JSON.stringify(worst));
  console.log('last  :', JSON.stringify(frames[frames.length - 1]));
  // Ink from the two glyphs must fill the window at every instant: the drum
  // is continuous, so the digit never vanishes mid-roll.
  expect(
    worst.covered,
    `slot only ${worst.covered}/${slot} covered at t=${worst.t}ms`
  ).toBeGreaterThan(slot * 0.9);
});
