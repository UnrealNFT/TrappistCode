import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/wavespeed': {
        target: 'https://llm.wavespeed.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wavespeed/, ''),
        headers: {
          'Origin': 'https://llm.wavespeed.ai'
        }
      }
    }
  }
})