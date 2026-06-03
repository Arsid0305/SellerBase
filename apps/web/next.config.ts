import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PORTABILITY rule #6: standalone output → Docker → YC Serverless Containers
  output: 'standalone',
  // PORTABILITY rule #5: custom image loader so we can swap Vercel ↔ Cloudflare ↔ YC CDN
  images: {
    loader: 'custom',
    loaderFile: './src/shared/lib/image-loader.ts',
  },
  reactStrictMode: true,
};

export default nextConfig;
