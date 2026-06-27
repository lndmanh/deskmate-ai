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
  plugins: [
    vue(),
    tailwindcss(),
    {
      // Preview-only: Electron's preload injects window.api / window.electron.
      // Stub them so the renderer boots in a plain browser like it does in Electron.
      name: 'preview-electron-api-stub',
      transformIndexHtml() {
        return [
          {
            tag: 'script',
            injectTo: 'head-prepend',
            children: `
              (function () {
                var status = { running: false, date: '2026-06-27' };
                var noop = function () { return function () {}; };
                window.electron = window.electron || { ipcRenderer: { on: function(){}, send: function(){}, invoke: function(){ return Promise.resolve(); }, removeAllListeners: function(){} }, process: { platform: 'linux' } };
                window.api = window.api || {
                  activity: {
                    onUpdate: noop, onEvent: noop,
                    status: function () { return Promise.resolve(status); },
                    getToday: function () { return Promise.resolve(null); },
                    getDay: function () { return Promise.resolve(null); },
                    listDays: function () { return Promise.resolve([]); },
                    start: function () { return Promise.resolve({ running: true, date: status.date }); },
                    stop: function () { return Promise.resolve(status); },
                    backfill: function () { return Promise.resolve({}); },
                    backfillSupport: function () { return Promise.resolve({ supported: false }); },
                    openHistoryPermission: function () { return Promise.resolve({}); }
                  },
                  mascotChat: { sendMessage: function () { return Promise.resolve({ text: 'ok' }); } },
                  onboarding: { load: function () { return Promise.resolve(null); }, save: function () { return Promise.resolve({}); }, get: function () { return Promise.resolve(null); }, set: function () { return Promise.resolve({}); } }
                };
              })();
            `
          }
        ]
      }
    }
  ],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5199,
    strictPort: false
  }
})
