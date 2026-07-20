import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        // Cookies (including httpOnly) are forwarded by http-proxy automatically.
        // credentials: 'include' in frontend fetch calls ensures cookies round-trip.
      },
    },
  },
  build: {
    sourcemap: false,
  },
})
