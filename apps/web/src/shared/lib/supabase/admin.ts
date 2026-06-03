import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client с service-role ключом.
 * Обходит RLS — использовать ТОЛЬКО в Server Components, Server Actions, Route Handlers.
 * НИКОГДА не импортировать в client component — ключ утечёт в браузер.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      '[supabase/admin] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars',
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
