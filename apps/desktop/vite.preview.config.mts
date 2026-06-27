import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Standalone Vite dev server for previewing the renderer (Vue SPA) in a plain
// browser, without launching Electron. Mirrors the `renderer` block of
// electron.vite.config.ts. Used only for local preview / screenshots.
const root = dirname(fileURLToPath(import.meta.url))
const r = (p: string): string => resolve(root, p)

export default defineConfig({
  root: r('src/renderer'),
  resolve: {
    alias: {
      '@renderer': r('src/renderer/src'),
      '@': r('src/renderer/src')
    }
  },
  plugins: [vue(), tailwindcss()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5199,
    strictPort: false
  }
})
