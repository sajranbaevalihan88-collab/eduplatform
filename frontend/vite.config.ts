import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  plugins: [react()],
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
        // vendor-heavy (monaco/tldraw) и vendor-docs (mammoth/jszip)
        // подгружаются только со своими lazy-страницами.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('monaco') || id.includes('tldraw')) return 'vendor-heavy'
          if (id.includes('mammoth') || id.includes('jszip') || id.includes('/pako/') || id.includes('pptx') || id.includes('/xlsx/') || id.includes('file-saver')) return 'vendor-docs'
          return 'vendor'
        },
      },
    },
  },
})
