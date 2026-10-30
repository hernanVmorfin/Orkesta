import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable, and works offline once opened: the app and every lazy chunk are cached by a service worker.
    // Satellite tiles and place search still need a connection.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['brand/*', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Orkesta by iNBest',
        short_name: 'Orkesta',
        description: 'To-scale floor plans, seating and event operations.',
        theme_color: '#0a1729',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,png,svg,ttf,woff2}'],
        // The PDF reader's worker is about 1.3 MB
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
