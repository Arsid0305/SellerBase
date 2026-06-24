import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * Server-side гвард для API routes / server actions.
 *
 * Возвращает `{ userId }` если пользователь авторизован,
 * иначе — готовый `NextResponse` с 401 (просто отдать из route handler).
 *
 * Использование:
 * ```
 * const auth = await requireAuth();
 * if (auth instanceof NextResponse) return auth;
 * // используем auth.userId
 * ```
 *
 * Middleware уже отдаёт 401 для незалогиненных запросов на `/api/*`,
 * но `requireAuth()` — defense in depth: если route напрямую дёрнут
 * минуя middleware (edge case), 401 всё равно вернётся.
 */
export async function requireAuth(): Promise<{ userId: string } | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return { userId: user.id };
}
