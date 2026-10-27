import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  plugins: [react()],
  // Редактор кода (monaco) грузится на страницу только со своей lazy-страницей:
  // заранее прогреваем, чтобы dev-открытие /editor и /code не ждало первые transform'ы.
  optimizeDeps: {
    include: [
      'monaco-editor/editor/editor.api',
      'monaco-editor/basic-languages/monaco.contribution',
      'sql.js',
    ],
  },
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8001',
      '/media': 'http://localhost:8001',
    }
  },
  preview: { port: 4173 },
  define: {
    'process.env': {}
  },
  build: {
    rollupOptions: {
      output: {
        // Хэш в имени файла: браузер не может склеить старый кеш с новым билдом.
        // index.html отдаётся без кеша, ассеты — с вечным кешом (имена меняются).
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // vendor едет сразу (react-экосистема целиком в нём — делить её
        // нельзя, между router/zustand циклические импорты: Circular chunk).
        // monaco и tldraw живут В ОТДЕЛЬНЫХ чанках: в одном файле они тянули
        // бы друг друга (доска грузила бы monaco, редактор — tldraw).
        // vendor-docs (mammoth/jszip) подгружается только со своими lazy-страницами.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('monaco')) return 'vendor-monaco'
          if (id.includes('tldraw')) return 'vendor-tldraw'
          if (id.includes('mammoth') || id.includes('jszip') || id.includes('/pako/') || id.includes('pptx') || id.includes('/xlsx/') || id.includes('file-saver')) return 'vendor-docs'
          // SQLite WASM — лениво, только страница /sql (практика баз данных)
          if (id.includes('sql.js') || id.includes('sql-wasm')) return 'vendor-sql'
          return 'vendor'
        },
      },
    },
  },
})
