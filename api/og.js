import { renderClockCard } from '../server/clock-card.js';

export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    response.statusCode = 405;
    response.end('Method not allowed');
    return;
  }
  const now = new Date();
  try {
    // Generate only when a crawler requests the card, never on clock ticks.
    const png = request.method === 'HEAD' ? null
      : Buffer.from(await renderClockCard(now).arrayBuffer());
    response.setHeader('Content-Type', 'image/png');
    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, must-revalidate');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Clock-Generated-At', now.toISOString());
    response.statusCode = 200;
    response.end(png);
  } catch (error) {
    console.error('Could not render clock share image', error);
    response.statusCode = 302;
    response.setHeader('Location', '/og-image.png');
    response.setHeader('Cache-Control', 'no-store');
    response.end();
  }
}
