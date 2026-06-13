import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 8080,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // 对于 SSE 流式响应，使用 configure 来禁用代理缓冲
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // 确保 SSE 响应不经过代理缓冲，直接透传给客户端
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              // 移除 content-length，避免代理等待完整响应
              delete proxyRes.headers['content-length'];
            }
          });
        },
      },
    },
  },
});
