import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // We register the SW ourselves via shell/pwa/register.ts so we can
      // surface lifecycle state (registered / checking / needs-refresh)
      // in the Settings UI. Without 'false' here, the plugin would also
      // auto-inject registerSW.js into index.html and we'd double-register.
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Bean Counter',
        short_name: 'Bean Counter',
        description: 'Local-first kitten weight logger for foster caregivers',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        // Chrome requires both 192 and 512 sizes to qualify as an
        // installable PWA. Without these, mobile Chrome falls back to
        // "Create shortcut" (a plain bookmark) instead of "Install app"
        // (the real standalone PWA experience).
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            // Maskable variant: artwork inset to fit within the W3C
            // safe-zone circle (80% of canvas) so Android's icon-shape
            // mask doesn't crop into the paw/scale composition. Same
            // logo, just shrunk with a blue-border padding.
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    // Allow `<lan-ip>.nip.io` hostnames so Google OAuth can use a
    // public-TLD origin while still routing to our LAN dev server.
    // (Google rejects raw IP origins; nip.io DNS-resolves any
    // <ip>.nip.io hostname to that exact IP.)
    allowedHosts: ['.nip.io'],
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
