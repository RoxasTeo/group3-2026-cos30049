import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({ 
  plugins: [vue()], 
  server: {
    host: 'localhost', 
    port: 5173, 
    strictPort: true,
    proxy: {
      '/auth': { 
        // 🟩 Swapped 127.0.0.1 for localhost to fix the ECONNREFUSED mismatch
        target: process.env.PHP_API_TARGET || 'http://localhost:8080',
        changeOrigin: true
      },
      '/api': { 
        target: process.env.PHP_API_TARGET || 'http://localhost:8080',
        changeOrigin: true
      },
    },
  } 
})