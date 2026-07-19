import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Base path: set to the repo name when deploying to GitHub Pages (e.g. '/mobilite/').
// Overridable via the BASE_PATH env var at build time.
const base = loadEnv('', '.', 'BASE_PATH').BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // Precache the app shell + the static data JSON so the app works fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,json}'],
        navigateFallbackDenylist: [/^\/data\//],
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
});
