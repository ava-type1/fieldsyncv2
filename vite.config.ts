import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // base defaults to '/' for Netlify (root domain)
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // Changed to prompt for manual update control
      includeAssets: ['favicon.svg', 'robots.txt', 'icons/*.svg'],
      manifest: false, // Use external manifest.json for more control
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff,ttf}'],
        // Precache the offline page
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/portal\//,
          /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
        ],
        runtimeCaching: [
          // API responses - Network First with offline fallback
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 10,
            },
          },
          // Auth endpoints - Network only (no caching for security)
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: 'NetworkOnly',
          },
          // Static images - Cache First
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          // Supabase storage (photos, documents) - Stale While Revalidate
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'photo-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Google Fonts stylesheets
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          // Google Fonts webfonts
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
        // Skip waiting and claim clients immediately when update is accepted
        skipWaiting: false,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false, // Disable in dev to avoid confusion
      },
    }),
  ],
  build: {
    // Generate source maps for debugging
    sourcemap: true,
    // Rollup options for better chunking
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          utils: ['zustand', 'dexie'],
        },
      },
    },
  },
});
