import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'
import process from 'process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
        // ✅ Use environment variable with localhost fallback
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path,
        configure: (proxy, options) => {
          proxy.on('error', (err,) => {
            console.log('❌ Proxy error:', err.message);
            // Fallback to localhost if primary fails
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
