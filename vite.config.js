import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Importamos o motor do tailwind

const apiProxy = {
  target: 'http://127.0.0.1:4000',
  changeOrigin: true,
  ws: true,
  rewrite: (path) => path.replace(/^\/api/, ''),
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Ativamos o motor
  ],
  server: {
    proxy: {
      '/api': apiProxy,
    },
  },
  preview: {
    proxy: {
      '/api': apiProxy,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          const normalizedId = id.replace(/\\/g, '/')
          if (
            normalizedId.includes('/node_modules/react/')
            || normalizedId.includes('/node_modules/react-dom/')
            || normalizedId.includes('/node_modules/react-router/')
            || normalizedId.includes('/node_modules/react-router-dom/')
            || normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'vendor-react'
          }
          if (id.includes('framer-motion')) {
            return 'vendor-framer'
          }
          if (id.includes('recharts')) {
            return 'vendor-charts'
          }
          if (id.includes('lucide-react')) {
            return 'vendor-icons'
          }
          if (id.includes('@fortawesome')) {
            return 'vendor-icons'
          }
          return 'vendor'
        },
      },
    },
  },
})
