import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PORTABILITY rule #6: standalone output → Docker → YC Serverless Containers
  output: 'standalone',
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
