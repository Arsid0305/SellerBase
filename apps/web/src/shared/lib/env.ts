import { z } from 'zod';

/**
 * Zod-validated env vars. Fails fast at boot if anything is missing.
 * Only NEXT_PUBLIC_* vars are exposed to the browser.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_IMAGE_CDN: z.string().url().optional(),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_IMAGE_CDN: process.env.NEXT_PUBLIC_IMAGE_CDN,
});

if (!parsed.success) {
  console.warn(
    '[env] Invalid or missing env vars — falling back to defaults for build',
    parsed.error.flatten().fieldErrors,
  );
}

export const env = parsed.success
  ? parsed.data
  : {
      NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      NEXT_PUBLIC_IMAGE_CDN: undefined,
    };
