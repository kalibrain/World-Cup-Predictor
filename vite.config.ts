import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Copies dist/index.html to dist/404.html so GitHub Pages serves the SPA
// for any unknown path (deep links, refresh on a sub-route).
const spaFallback = {
  name: 'spa-404-fallback',
  closeBundle() {
    const dist = resolve(__dirname, 'dist')
    copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))
  },
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/World-Cup-Predictor/' : '/',
  plugins: [react(), spaFallback],
  server: {
    host: true,
  },
})
