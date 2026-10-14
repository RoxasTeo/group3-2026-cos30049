import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({ plugins: [vue()], server: {
  host: 'localhost', port: 5173, strictPort: true,
  proxy: {
    '/auth/': { target: process.env.PHP_API_TARGET || 'http://127.0.0.1:8080' },
  },
} })
