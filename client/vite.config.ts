import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@mui') || id.includes('node_modules/@emotion')) return 'vendor-mui'
          if (id.includes('node_modules/react-router') || id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/socket.io-client') || id.includes('node_modules/engine.io-client')) {
            return 'vendor-socket'
          }
        },
      },
    },
  },
})
