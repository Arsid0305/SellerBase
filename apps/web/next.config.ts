import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PORTABILITY rule #6: standalone output → Docker → YC Serverless Containers.
  //
  // Включается только когда сборка идёт для контейнера (BUILD_STANDALONE=1,
  // выставляется в Dockerfile). Причина: standalone раскладывает зависимости
  // символическими ссылками, а Windows их создавать не даёт без прав
  // администратора или режима разработчика — локальная сборка падала с
  // «EPERM: operation not permitted, symlink».
  //
  // Vercel собирает и без standalone: он раскладывает вывод сам.
  // Портируемость не страдает — Docker-сборка флаг выставляет.
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  // standalone не копирует templates/*.xlsx, читаемые через fs.readFile —
  // явно включаем их в трассировку API routes
  outputFileTracingIncludes: {
    '/api/finance/xlsx': ['./templates/**/*'],
    '/api/promo/*/export-xlsx': ['./templates/**/*'],
    '/api/costs/template-xlsx': ['./templates/**/*'],
  },
  // PORTABILITY rule #5: custom image loader so we can swap Vercel ↔ Cloudflare ↔ YC CDN
  images: {
    loader: 'custom',
    loaderFile: './src/shared/lib/image-loader.ts',
  },
  reactStrictMode: true,
};

export default nextConfig;
