import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  root: resolve(__dirname, 'pages/audience'),
  base: '/audience/',
  build: {
    outDir: resolve(__dirname, 'dist/audience'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname),
    },
  },
})
