import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: { '@': resolve(root, 'src') }
  },
  plugins: [vue(), tailwindcss()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5200,
    strictPort: false
  }
})
