import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      // Covers older Android WebView, older iOS Safari, Samsung Internet, etc.
      // Keeps the app working without manual Railway config changes.
      targets: ['defaults', 'not IE 11'],
    }),
  ],
  server: {
    proxy: {
      // Local DX: when VITE_API_URL is not set, the app uses relative /api/*.
      // Proxy it to the backend dev server.
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
})
