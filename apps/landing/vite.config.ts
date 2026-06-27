import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig, type Plugin, type Rollup } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const root = dirname(fileURLToPath(import.meta.url))

function singleHtmlFile(): Plugin {
  return {
    name: 'deskmate-single-html-file',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const htmlEntry = Object.entries(bundle).find(
        ([fileName, output]) => fileName.endsWith('.html') && output.type === 'asset'
      ) as [string, Rollup.OutputAsset] | undefined

      if (!htmlEntry) return

      const [htmlFileName, htmlAsset] = htmlEntry
      let html = String(htmlAsset.source)

      html = html.replace(
        /<link\s+([^>]*?)rel=(['"])stylesheet\2([^>]*?)href=(['"])([^'"]+)\4([^>]*)>/g,
        (tag, beforeRel, relQuote, afterRel, hrefQuote, href) => {
          const fileName = href.replace(/^\//, '')
          const cssAsset = bundle[fileName]

          if (cssAsset?.type !== 'asset') return tag

          delete bundle[fileName]
          return `<style>${String(cssAsset.source)}</style>`
        }
      )

      html = html.replace(
        /<script\s+([^>]*?)src=(['"])([^'"]+)\2([^>]*)><\/script>/g,
        (tag, beforeSrc, srcQuote, src) => {
          const fileName = src.replace(/^\//, '')
          const chunk = bundle[fileName]

          if (chunk?.type !== 'chunk') return tag

          delete bundle[fileName]
          return `<script type="module">${chunk.code}</script>`
        }
      )

      htmlAsset.source = html

      for (const fileName of Object.keys(bundle)) {
        if (fileName !== htmlFileName) delete bundle[fileName]
      }
    }
  }
}

export default defineConfig({
  resolve: {
    alias: { '@': resolve(root, 'src') }
  },
  plugins: [vue(), tailwindcss(), singleHtmlFile()],
  build: {
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5200,
    strictPort: false
  }
})
