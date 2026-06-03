import type { ImageLoaderProps } from 'next/image';

/**
 * PORTABILITY rule #5 — see docs/architecture/PORTABILITY.md
 * Today: Supabase Storage render endpoint (or any S3-like with on-the-fly transforms).
 * Tomorrow on Yandex Cloud: swap to YC CDN with image processing or Cloudflare Images.
 * The rest of the app does not know which backend serves images.
 */
export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  const cdn = process.env.NEXT_PUBLIC_IMAGE_CDN;
  if (!cdn) return src;
  const normalized = src.startsWith('http') ? src : `${cdn}/${src.replace(/^\//, '')}`;
  const url = new URL(normalized);
  url.searchParams.set('width', String(width));
  url.searchParams.set('quality', String(quality ?? 75));
  return url.toString();
}
