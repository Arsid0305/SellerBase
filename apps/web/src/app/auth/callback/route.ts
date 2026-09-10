import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Куда вернуть человека после входа. Возвращает готовый абсолютный адрес,
 * про который уже известно, что он наш.
 *
 * Параметр `next` подставлялся как есть, и это уводило с сайта:
 * `new URL(next, origin)` при абсолютном адресе игнорирует базовый origin,
 * поэтому `?next=https://чужой-сайт` открывал чужой сайт сразу после
 * успешного входа. То же самое делают `//чужой-сайт` и `/\чужой-сайт`.
 *
 * Проверки начала строки мало по двум причинам, обе проверены вживую.
 *
 * Первая: табуляцию, перевод строки и возврат каретки разборщик адресов
 * выбрасывает молча, поэтому `/%09/чужой-сайт` приходит как
 * `/\t/чужой-сайт`, проходит проверку на два слэша — и уже после разбора
 * становится `//чужой-сайт`.
 *
 * Вторая: адрес нельзя разбирать дважды. `/..//чужой-сайт` даёт путь
 * `//чужой-сайт` на нашем же origin — проверка origin довольна, но при
 * повторном разборе в вызывающем коде этот путь снова читается как внешний
 * хост. Поэтому наружу отдаётся уже абсолютный адрес, а не путь: второй
 * разбор с ним ничего сделать не может.
 */
function safeNext(raw: string | null, origin: string): string {
  const fallback = `${origin}/`;
  if (!raw) return fallback;

  const cleaned = raw.replace(/[\t\n\r]/g, '');
  if (!cleaned.startsWith('/')) return fallback;
  if (cleaned.startsWith('//') || cleaned.startsWith('/\\')) return fallback;

  try {
    const target = new URL(cleaned, origin);
    if (target.origin !== origin) return fallback;
    return target.href;
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'), url.origin);

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

  return NextResponse.redirect(next);
}
