import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const headers = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg'] },
  server: { headers },
  preview: { headers },
})
