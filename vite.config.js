import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Importamos o motor do tailwind

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Ativamos o motor
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'vendor-react'
          }
          if (id.includes('framer-motion') || id.includes('recharts') || id.includes('lucide-react')) {
            return 'vendor-ui'
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
