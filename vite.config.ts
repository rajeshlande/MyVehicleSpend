/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

export default defineConfig({
  // Version shown in the app (Settings → About). Comes from package.json; see CHANGELOG.md.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    VitePWA({
      // FR-PWA-06: the user chooses when to refresh (see UpdateBanner).
      registerType: 'prompt',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'My Vehicle Spend',
        short_name: 'Vehicle Spend',
        description: 'Track car and bike expenses and loans in India',
        theme_color: '#0B6E4F',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        lang: 'en-IN',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell only (FR-PWA-02). API responses are NOT cached here: the offline read cache
        // (T29a) will clear user data on sign-out, which a generic runtime cache would not.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  // allowedHosts: the sandbox live-preview domain (.e2b.app). Local dev is unaffected.
  server: { host: '0.0.0.0', port: 5173, allowedHosts: ['.e2b.app', 'localhost'] },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: ['.e2b.app', 'localhost'] },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
  },
});
