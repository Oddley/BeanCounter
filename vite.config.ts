import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Bean Counter',
        short_name: 'Beans',
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
            src: 'icon-512.png',
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
