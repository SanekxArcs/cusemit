import { test, expect } from '@playwright/test';

const initial = new Date('2026-11-01T12:00:00');

async function openClock(page, settings = {}, denyWakeLock = false) {
  await page.clock.install({ time: initial });
  await page.clock.pauseAt(initial);
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.addInitScript(
    ({ settings, denyWakeLock }) => {
      localStorage.setItem(
        'app.clock.settings.v1',
        JSON.stringify({
          autoHideControls: false,
          animationMode: 'none',
          showSeconds: true,
          pulseColon: false,
          ...settings,
        })
      );
      const ticks = new Set();
      const setIntervalOriginal = window.setInterval.bind(window);
      const clearIntervalOriginal = window.clearInterval.bind(window);
      window.setInterval = (handler, delay, ...args) => {
        const id = setIntervalOriginal(handler, delay, ...args);
        if (delay === 500) ticks.add(id);
        return id;
      };
      window.clearInterval = (id) => {
        ticks.delete(id);
        clearIntervalOriginal(id);
      };
      const state = {
        hidden: false,
        requests: 0,
        activeLocks: 0,
        locks: [],
        ticks,
        marker: Math.random(),
        denyWakeLock,
      };
      state.killTicks = () => {
        for (const id of ticks) clearIntervalOriginal(id);
        ticks.clear();
      };
      state.setHidden = (hidden) => {
        state.hidden = hidden;
        document.dispatchEvent(new Event('visibilitychange'));
      };
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => state.hidden,
      });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => (state.hidden ? 'hidden' : 'visible'),
      });
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: {
          request: async () => {
            state.requests++;
            if (state.denyWakeLock)
              throw new DOMException('Battery saver', 'NotAllowedError');
            const lock = new EventTarget();
            lock.released = false;
            state.activeLocks++;
            lock.release = async () => {
              if (lock.released) return;
              lock.released = true;
              state.activeLocks--;
              lock.dispatchEvent(new Event('release'));
            };
            state.locks.push(lock);
            return lock;
          },
        },
      });
      window.clockRecovery = state;
    },
    { settings, denyWakeLock }
  );
  await page.goto('/');
  await expect(page.locator('.clock-svg')).toHaveAttribute(
    'aria-label',
    '12:00:00'
  );
}

test('normal ticks advance without remounting the clock or duplicating its interval', async ({
  page,
}) => {
  await openClock(page);
  await page.evaluate(() => {
    window.previousInk = document.querySelector('[data-clock-ink]');
  });
  await page.clock.runFor(2500);
  await expect(page.locator('.clock-svg')).toHaveAttribute(
    'aria-label',
    '12:00:02'
  );
  expect(await page.evaluate(() => window.previousInk.isConnected)).toBe(true);
  expect(await page.evaluate(() => window.clockRecovery.ticks.size)).toBe(1);
});

test('watchdog restarts a lost ticker without a visibility event or page reload', async ({
  page,
}) => {
  await openClock(page);
  const marker = await page.evaluate(() => {
    window.previousInk = document.querySelector('[data-clock-ink]');
    window.clockRecovery.killTicks();
    return window.clockRecovery.marker;
  });
  await page.clock.runFor(6000);
  await expect(page.locator('.clock-svg')).toHaveAttribute(
    'aria-label',
    '12:00:06'
  );
  expect(await page.evaluate(() => window.clockRecovery.marker)).toBe(marker);
  expect(await page.evaluate(() => window.previousInk.isConnected)).toBe(false);
  expect(await page.evaluate(() => window.clockRecovery.ticks.size)).toBe(1);
});

for (const event of ['visibilitychange', 'resume', 'pageshow', 'focus']) {
  test(`${event} catches up immediately and keeps ticking after a long pause`, async ({
    page,
  }) => {
    await openClock(page);
    const marker = await page.evaluate(() => {
      window.clockRecovery.killTicks();
      return window.clockRecovery.marker;
    });
    await page.clock.setSystemTime(new Date('2026-11-01T20:15:00'));
    await page.evaluate((name) => {
      if (name === 'visibilitychange' || name === 'resume')
        document.dispatchEvent(new Event(name));
      else window.dispatchEvent(new Event(name));
    }, event);
    await expect(page.locator('.clock-svg')).toHaveAttribute(
      'aria-label',
      '20:15:00'
    );
    await page.clock.runFor(1000);
    await expect(page.locator('.clock-svg')).toHaveAttribute(
      'aria-label',
      '20:15:01'
    );
    expect(await page.evaluate(() => window.clockRecovery.marker)).toBe(marker);
    expect(await page.evaluate(() => window.clockRecovery.ticks.size)).toBe(1);
  });
}

test('hidden and frozen pages restart only when visible again', async ({
  page,
}) => {
  await openClock(page);
  await page.evaluate(() => {
    window.clockRecovery.setHidden(true);
    document.dispatchEvent(new Event('freeze'));
  });
  await page.clock.runFor(6000);
  expect(await page.evaluate(() => window.clockRecovery.ticks.size)).toBe(0);
  await expect(page.locator('.clock-svg')).toHaveAttribute(
    'aria-label',
    '12:00:00'
  );
  await page.evaluate(() => document.dispatchEvent(new Event('resume')));
  expect(await page.evaluate(() => window.clockRecovery.ticks.size)).toBe(0);
  await page.evaluate(() => window.clockRecovery.setHidden(false));
  await expect(page.locator('.clock-svg')).toHaveAttribute(
    'aria-label',
    '12:00:06'
  );
  await page.clock.runFor(1000);
  await expect(page.locator('.clock-svg')).toHaveAttribute(
    'aria-label',
    '12:00:07'
  );
});

test('system clock corrections in either direction use the actual device time', async ({
  page,
}) => {
  await openClock(page);
  await page.clock.setSystemTime(new Date('2026-11-01T20:00:00'));
  await page.clock.runFor(500);
  await expect(page.locator('.clock-svg')).toHaveAttribute(
    'aria-label',
    '20:00:00'
  );
  await page.clock.setSystemTime(new Date('2026-11-01T10:00:00'));
  await page.clock.runFor(500);
  await expect(page.locator('.clock-svg')).toHaveAttribute(
    'aria-label',
    '10:00:00'
  );
});

test('format changes and repeated lifecycle events leave exactly one interval', async ({
  page,
}) => {
  await openClock(page);
  await page
    .getByRole('button', { name: 'Display settings', exact: true })
    .click();
  await page.getByRole('radio', { name: '12 hour', exact: true }).click();
  await page.getByRole('switch', { name: 'Show seconds', exact: true }).click();
  await page.evaluate(() => {
    for (let index = 0; index < 10; index++) {
      document.dispatchEvent(new Event('resume'));
      window.dispatchEvent(new Event('pageshow'));
      window.dispatchEvent(new Event('focus'));
    }
  });
  await expect(page.locator('.clock-svg')).toHaveAttribute(
    'aria-label',
    '12:00 PM'
  );
  expect(await page.evaluate(() => window.clockRecovery.ticks.size)).toBe(1);
  await page.clock.setSystemTime(new Date('2026-11-01T13:01:00'));
  await page.clock.runFor(500);
  await expect(page.locator('.clock-svg')).toHaveAttribute(
    'aria-label',
    '01:01 PM'
  );
});

test('recovery preserves a running countdown instead of reloading the app', async ({
  page,
}) => {
  await openClock(page);
  const marker = await page.evaluate(() => window.clockRecovery.marker);
  await page.getByRole('button', { name: 'Timers', exact: true }).click();
  await page.getByRole('button', { name: 'Add timer', exact: true }).click();
  await page.getByLabel('Minutes', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.evaluate(() => window.clockRecovery.setHidden(true));
  await page.clock.setSystemTime(new Date('2026-11-01T12:05:00'));
  await page.evaluate(() => window.clockRecovery.setHidden(false));
  await page.clock.runFor(1000);
  await expect(page.locator('.timer-readout')).toContainText('00:04:59Running');
  expect(await page.evaluate(() => window.clockRecovery.marker)).toBe(marker);
});

test('resuming rebuilds animated digits at the current time, including a floating clock', async ({
  page,
}) => {
  await openClock(page, { animationMode: 'shuffle', clockFloating: true });
  await page.clock.runFor(500);
  await page.evaluate(() => {
    window.previousInk = document.querySelector('[data-clock-ink]');
    document.dispatchEvent(new Event('freeze'));
  });
  await page.clock.setSystemTime(new Date('2026-11-01T18:23:40'));
  await page.evaluate(() => document.dispatchEvent(new Event('resume')));
  await page.clock.runFor(400);
  await expect(page.locator('.clock-svg')).toHaveAttribute(
    'aria-label',
    '18:23:40'
  );
  expect(
    await page
      .locator('[data-clock-ink] > g')
      .first()
      .locator('text')
      .allTextContents()
  ).toEqual(['1', '8', ':', '2', '3', ':', '4', '0']);
  expect(await page.evaluate(() => window.previousInk.isConnected)).toBe(false);
});

test('a system-released wake lock is reacquired while the page stays visible', async ({
  page,
}) => {
  await openClock(page);
  await expect
    .poll(() => page.evaluate(() => window.clockRecovery.activeLocks))
    .toBe(1);
  const requests = await page.evaluate(async () => {
    const state = window.clockRecovery;
    await state.locks.find((lock) => !lock.released).release();
    return state.requests;
  });
  await page.clock.runFor(1100);
  await expect
    .poll(() => page.evaluate(() => window.clockRecovery.activeLocks))
    .toBe(1);
  expect(await page.evaluate(() => window.clockRecovery.requests)).toBe(
    requests + 1
  );
});

test('wake lock is not retried while hidden and lifecycle events do not create duplicates', async ({
  page,
}) => {
  await openClock(page);
  await expect
    .poll(() => page.evaluate(() => window.clockRecovery.activeLocks))
    .toBe(1);
  const requests = await page.evaluate(() => {
    window.clockRecovery.setHidden(true);
    return window.clockRecovery.requests;
  });
  await page.clock.runFor(31000);
  expect(await page.evaluate(() => window.clockRecovery.requests)).toBe(
    requests
  );
  expect(await page.evaluate(() => window.clockRecovery.activeLocks)).toBe(0);
  await page.evaluate(() => {
    window.clockRecovery.setHidden(false);
    document.dispatchEvent(new Event('resume'));
    window.dispatchEvent(new Event('pageshow'));
    window.dispatchEvent(new Event('focus'));
  });
  await expect
    .poll(() => page.evaluate(() => window.clockRecovery.activeLocks))
    .toBe(1);
  expect(await page.evaluate(() => window.clockRecovery.requests)).toBe(
    requests + 1
  );
});

test('denied wake locks use a bounded retry rather than a tight request loop', async ({
  page,
}) => {
  await openClock(page, {}, true);
  const requests = await page.evaluate(() => window.clockRecovery.requests);
  await page.clock.runFor(29000);
  expect(await page.evaluate(() => window.clockRecovery.requests)).toBe(
    requests
  );
  await page.evaluate(() => {
    window.clockRecovery.denyWakeLock = false;
  });
  await page.clock.runFor(1100);
  expect(await page.evaluate(() => window.clockRecovery.requests)).toBe(
    requests + 1
  );
  await expect
    .poll(() => page.evaluate(() => window.clockRecovery.activeLocks))
    .toBe(1);
});
