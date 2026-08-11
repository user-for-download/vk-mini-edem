import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Env из .env-файлов mini-app (mini-app/.env и т.п.) + реальные переменные
  // окружения (последние имеют приоритет). process.env напрямую env-файлы НЕ содержит.
  const env = loadEnv(mode, path.resolve(__dirname, './mini-app'), '');

  // Хосты (через запятую) сверх дефолтных (localhost/127.0.0.1), которым
  // разрешён доступ к dev-серверу — например, домен туннеля:
  // VITE_ALLOWED_HOSTS="my-tunnel.example.com" (см. .env.example).
  const extraAllowedHosts = env.VITE_ALLOWED_HOSTS
    ? env.VITE_ALLOWED_HOSTS.split(',').map((host) => host.trim()).filter(Boolean)
    : [];

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
      // allowedHosts заменяет дефолтный список Vite, поэтому при задании
      // туннельных доменов локальные хосты добавляем явно.
      allowedHosts:
        extraAllowedHosts.length > 0
          ? ['localhost', '.localhost', '127.0.0.1', '::1', ...extraAllowedHosts]
          : undefined,
      proxy: {
        '/api': {
          // Адрес dev-бэкенда: VITE_API_TARGET (env или .env) или дефолт 3011.
          target: env.VITE_API_TARGET || 'http://127.0.0.1:3011',
          changeOrigin: true,
          ws: true,
        },
      },
      hmr: env.DISABLE_HMR !== 'true',
      watch: env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
