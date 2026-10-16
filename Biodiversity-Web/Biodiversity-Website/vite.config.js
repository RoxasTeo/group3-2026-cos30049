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