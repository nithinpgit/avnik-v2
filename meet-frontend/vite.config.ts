import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const devProxyTarget =
  process.env.VITE_DEV_PROXY_TARGET?.trim() ||
  process.env.DOCKER_API_PROXY?.trim() ||
  'http://127.0.0.1:3000'

const usePolling =
  process.env.CHOKIDAR_USEPOLLING === '1' || process.env.CHOKIDAR_USEPOLLING === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.VITE_BIND_ALL === '1' ? '0.0.0.0' : true,
    port: 5173,
    strictPort: true,
    watch: usePolling ? { usePolling: true, interval: 800 } : undefined,
    proxy: {
      '/socket.io': {
        target: devProxyTarget,
        changeOrigin: true,
        ws: true,
      },
      '/api': {
        target: devProxyTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: devProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
