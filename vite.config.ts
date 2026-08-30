import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5175
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('primevue') || id.includes('@primevue') || id.includes('@primeuix') || id.includes('primeicons')) {
            return 'vendor-primevue'
          }
          if (id.includes('vue') || id.includes('pinia')) return 'vendor-vue'
          return 'vendor'
        }
      }
    }
  }
})
