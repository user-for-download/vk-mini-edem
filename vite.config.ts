import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    root: './mini-app',
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
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
        },
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
