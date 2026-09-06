import { createElement as h } from 'react';
import { ImageResponse } from '@vercel/og';

export function clockCardText(now) {
  return {
    time: now ? new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC',
    }).format(now) : '12:48',
    date: now ? new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(now) : 'Your time. Your way.',
  };
}

export function renderClockCard(now = new Date()) {
  const { time, date } = clockCardText(now);
  const row = (style, ...children) => h('div', { style: { display: 'flex', ...style } }, ...children);
  return new ImageResponse(
    row({ width: '100%', height: '100%', background: '#080a0b', color: '#f5f6f2',
      flexDirection: 'column', padding: '42px 60px', fontFamily: 'sans-serif' },
      row({ alignItems: 'center', justifyContent: 'space-between' },
        row({ fontSize: 30, letterSpacing: -1 }, 'cusemit'),
        row({ color: '#b7cba4', fontSize: 16, letterSpacing: 3 }, 'MAKE TIME YOURS')
      ),
      row({ flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
        row({ fontSize: 242, lineHeight: 1.05, letterSpacing: -12, fontWeight: 700 }, time),
        row({ alignItems: 'center', gap: 16, marginTop: 12, color: '#a1a7a6', fontSize: 23 },
          date,
          now ? row({ fontSize: 15, color: '#c1d8ad', border: '1px solid #394137',
            borderRadius: 8, padding: '5px 12px' }, 'UTC') : null
        )
      ),
      row({ borderTop: '1px solid #292d2c', paddingTop: 24, alignItems: 'center', justifyContent: 'space-between' },
        row({ flexDirection: 'column', gap: 7 },
          row({ fontSize: 25 }, 'A fullscreen clock, made yours.'),
          row({ fontSize: 17, color: '#8f9791' }, 'Custom fonts & colors  /  Timers  /  Offline PWA')
        ),
        row({ color: '#c1d8ad', fontSize: 17 }, 'Free. Open. Yours.')
      )
    ),
    { width: 1200, height: 630 }
  );
}
