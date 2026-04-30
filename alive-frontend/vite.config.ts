import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/worker': {
        target: 'https://alive-worker.alive-sana.workers.dev',
        changeOrigin: true,
        rewrite: () => '/',
      },
    },
  },
})
