import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages ではリポジトリ名のサブパスで配信される
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '未来の予約帳',
        short_name: '予約帳',
        description: '先取りの残りで、ほしいものを予約する資産形成ノート',
        lang: 'ja',
        theme_color: '#0E1320',
        background_color: '#F6F7FA',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        // 和文フォントは数百の分割ファイルがあるため事前には入れず、使った分だけ保存する
        globPatterns: ['**/*.{js,css,html,svg}'],
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.endsWith('.woff2'),
          handler: 'CacheFirst',
          options: { cacheName: 'fonts', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 } },
        }],
      },
    }),
  ],
  test: { environment: 'node' },
})
