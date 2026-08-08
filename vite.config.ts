import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    root: './mini-app',
    // Относительные пути ассетов: мини-апп может быть развёрнут под любым
    // путём/доменом (VK hosting, свой сервер) — абсолютный base: '/' сломал бы
    // загрузку статики при размещении не в корне домена.
    base: './',
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, './mini-app/src'),
        '@edem/contracts': path.resolve(__dirname, './packages/contracts/src/index.ts'),
        'react': path.resolve(__dirname, './node_modules/react'),
        'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      },
    },
    server: {
      // allowedHosts: ['<your-tunnel-domain>'], // для dev-туннеля (не коммитить реальный домен)
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          ws: true,
        },
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
