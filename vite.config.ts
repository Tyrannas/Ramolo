import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Deployed at https://tyrannas.github.io/Ramolo/, so production assets live
// under /Ramolo/. Dev and preview stay at the root for convenience.
// Override with BASE_PATH=/ at build time for a custom domain.
const DEFAULT_PROD_BASE = '/Ramolo/';

/**
 * GitHub Pages has no SPA rewrite: requesting /Ramolo/diagnostic directly
 * returns a hard 404 instead of the app. Serving the same HTML as 404.html
 * makes deep links, refreshes and shared URLs work. `.nojekyll` stops Pages
 * from dropping files and folders that start with an underscore.
 */
function githubPagesSpaFallback(): Plugin {
  let outDir = 'dist';
  return {
    name: 'github-pages-spa-fallback',
    apply: 'build',
    configResolved(config) {
      // Resolve against the real root/outDir rather than assuming 'dist'.
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const index = resolve(outDir, 'index.html');
      if (!existsSync(index)) return;
      copyFileSync(index, resolve(outDir, '404.html'));
      writeFileSync(resolve(outDir, '.nojekyll'), '');
    },
  };
}

export default defineConfig(({ command }) => {
  const envBase = loadEnv('', '.', 'BASE_PATH').BASE_PATH;
  const base = envBase || (command === 'build' ? DEFAULT_PROD_BASE : '/');

  return {
    base,
    plugins: [
      react(),
      githubPagesSpaFallback(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        workbox: {
          // Precache the app shell + the static data JSON so the app works fully offline.
          globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,json}'],
          // Serve the app shell for client-side routes, but never shadow the
          // content JSON — those must come from the precache, not index.html.
          navigateFallback: `${base}index.html`,
          navigateFallbackDenylist: [/\/data\//],
        },
        manifest: {
          name: 'Mobilité & Souplesse',
          short_name: 'Mobilité',
          description:
            'Diagnostic et programmes de mobilité ciblés pour vrais débutants. Vos données restent sur votre appareil.',
          lang: 'fr',
          theme_color: '#3f7d63',
          background_color: '#faf9f6',
          display: 'standalone',
          orientation: 'portrait',
          start_url: base,
          scope: base,
          icons: [
            { src: 'icons/icon.svg', sizes: '192x192', type: 'image/svg+xml' },
            { src: 'icons/icon.svg', sizes: '512x512', type: 'image/svg+xml' },
            { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
            {
              src: 'icons/icon-maskable.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
  };
});
