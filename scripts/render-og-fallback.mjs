import { writeFile } from 'node:fs/promises';
import { renderClockCard } from '../server/clock-card.js';

await writeFile(new URL('../public/og-image.png', import.meta.url),
  Buffer.from(await renderClockCard(null).arrayBuffer()));
