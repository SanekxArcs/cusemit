import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ogHandler from './api/og.js';
// The same handler runs on Vercel and in local dev/production previews.
const ogMiddleware = (request, response, next) => {
    if (new URL(request.url || '/', 'http://localhost').pathname !== '/api/og')
        return next();
    void ogHandler(request, response).catch(next);
};
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export default defineConfig({
    plugins: [
        react(),
        {
            name: 'clock-share-image',
            configureServer(server) { server.middlewares.use(ogMiddleware); },
            configurePreviewServer(server) { server.middlewares.use(ogMiddleware); },
        },
        {
            name: 'offline-app-shell',
            apply: 'build',
            generateBundle(_, bundle) {
                const files = Object.keys(bundle);
                const revision = createHash('sha256')
                    .update(files
                    .map((name) => {
                    const file = bundle[name];
                    return (name +
                        (file.type === 'chunk' ? file.code : String(file.source)));
                })
                    .join(''))
                    .digest('hex')
                    .slice(0, 12);
                const assets = [
                    '/',
                    '/index.html',
                    '/manifest.json',
                    '/clock-96.png',
                    '/clock-192.png',
                    '/clock-512.png',
                    ...files
                        .filter((name) => name !== 'index.html')
                        .map((name) => '/' + name),
                ];
                const source = readFileSync(resolve(__dirname, 'public/sw.js'), 'utf8')
                    .replace('__BUILD_REVISION__', revision)
                    .replace(/\/\* __PRECACHE__ \*\/ \[[^\]]*\]/, JSON.stringify(assets));
                this.emitFile({ type: 'asset', fileName: 'sw.js', source });
            },
        },
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
    },
});
