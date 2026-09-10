import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Куда вернуть человека после входа.
 *
 * Раньше параметр `next` подставлялся как есть, и это уводило с сайта:
 * `new URL(next, origin)` при абсолютном адресе игнорирует базовый origin,
 * поэтому `?next=https://чужой-сайт` открывал чужой сайт сразу после
 * успешного входа. То же самое делают `//чужой-сайт` и `/\чужой-сайт` —
 * браузер читает их как внешний адрес, а не как путь.
 *
 * Пропускаем только внутренний путь: один ведущий слэш и ничего похожего
 * на хост следом. Всё остальное — на главную.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/')) return '/';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Текст ошибки от Supabase в адресной строке не показываем: это
    // подробности авторизации, и они попадают в историю браузера и в логи
    // прокси. Тот же случай, что разбирали в WB-Bot 23.08.2026 —
    // `str(e)` в ответе клиенту. Человеку хватает признака, разбор — в логе.
    console.error('[auth/callback] обмен кода на сессию не удался', error);
    return NextResponse.redirect(new URL('/login?error=auth_failed', url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
