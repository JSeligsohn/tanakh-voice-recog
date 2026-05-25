import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Azure Speech SDK references `global` which doesn't exist in browsers
    global: 'globalThis',
  },
})
