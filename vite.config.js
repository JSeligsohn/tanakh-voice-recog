import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind explicitly to IPv4 — Vite 8 has been defaulting to IPv6-only on macOS,
    // which causes browsers to hang since they try 127.0.0.1 first.
    host: '127.0.0.1',
    watch: {
      // macOS FSEvents fires phantom change events when other processes (like
      // VS Code's tsserver) just *read* project files, causing endless HMR loops.
      // Polling ignores fsevent noise — slightly more CPU, but actually stable.
      usePolling: true,
      interval: 500,
      ignored: ['**/.env', '**/.env.local', '**/node_modules/**', '**/.git/**'],
    },
  },
  define: {
    // Azure Speech SDK references `global` which doesn't exist in browsers
    global: 'globalThis',
  },
})
