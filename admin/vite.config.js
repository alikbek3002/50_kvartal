import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: {
    // Railway routes traffic with Host header set to your service domain.
    // Allow it so `vite preview` can serve in production.
    allowedHosts: 'all',
  },
})
