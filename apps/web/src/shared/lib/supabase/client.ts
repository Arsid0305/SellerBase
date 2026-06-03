'use client';

import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/shared/lib/env';

export function createClient() {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
