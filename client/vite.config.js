import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['konsta/react'],
          animation: ['gsap', 'motion', 'motion/react'],
          firebase: ['firebase/app', 'firebase/analytics'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})
