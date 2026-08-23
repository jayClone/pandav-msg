import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'
import process from 'process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // ffmpeg.wasm spawns a Worker via `new Worker(new URL("./worker.js", import.meta.url))`
  // inside its own package code. Vite's esbuild-based dependency pre-bundling
  // doesn't preserve that pattern correctly (it rewrites the module into a
  // single pre-bundled file, breaking the relative worker URL) — the worker
  // then either fails to start or never posts back, so every ffmpeg call
  // hangs indefinitely instead of erroring. Excluding it from optimizeDeps
  // makes Vite serve the package's own files as-is, where the pattern works.
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@api': path.resolve(__dirname, './src/api'),
      '@services': path.resolve(__dirname, './src/services'),
      '@socket': path.resolve(__dirname, './src/socket'),
      '@constants': path.resolve(__dirname, './src/constants'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@routes': path.resolve(__dirname, './src/routes'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@context': path.resolve(__dirname, './src/context'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path,
        configure: (proxy, options) => {
          proxy.on('error', (err) => {
            console.log('❌ Proxy error:', err.message);
            if (process.env.VITE_API_URL && process.env.VITE_API_URL !== 'http://localhost:5000') {
              console.log('🔄 Attempting fallback to localhost:5000');
              options.target = 'http://localhost:5000';
            }
          });
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './test/setup.js',
  },
})
