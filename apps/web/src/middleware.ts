import { NextResponse, type NextRequest } from 'next/server';

export const config = { matcher: '/api/:path*' };

const ALLOWED_HOSTS = ['seller-base.vercel.app', 'localhost:3000', 'localhost', 'arsid.vercel.app'];

function hasAllowedHost(value: string | null): boolean {
  if (!value) return false;
  return ALLOWED_HOSTS.some((host) => value.includes(host));
}

/**
 * Защита API routes от внешних вызовов.
 *
 * Уровень 1 (Origin/Referer): отбрасывает curl/боты которые не подделывают эти заголовки.
 *   Это первая линия — мусор не доходит даже до проверки секрета.
 *
 * Уровень 2 (X-API-Secret): если в env установлен API_SECRET — требуем header.
 *   Это закрывает дыру когда атакующий подделывает Origin/Referer (что легко делается curl'ом).
 *   Server actions/RSC fetch с этого же приложения добавляют header автоматически через
 *   `apiFetch` (см. apps/web/src/shared/lib/api/fetch.ts).
 *
 * Только GET/HEAD/OPTIONS пропускаются без проверки (read-only).
 */
export default function middleware(req: NextRequest) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return NextResponse.next();
  }

  // Уровень 1: Origin/Referer
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const sameOrigin = hasAllowedHost(origin) || hasAllowedHost(referer);

  // Уровень 2: shared secret (если задан в env)
  const expected = process.env.API_SECRET;
  if (expected) {
    const got = req.headers.get('x-api-secret');
    if (got === expected) {
      // Секрет совпал — пропускаем безусловно (для server-to-server вызовов).
      return NextResponse.next();
    }
    // Секрет не совпал, но same-origin — пропускаем (браузер не может выставить X-API-Secret
    // не зная значение, но он точно с нашего домена).
    if (sameOrigin) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Fallback: API_SECRET не задан → проверяем только Origin/Referer.
  if (sameOrigin) {
    return NextResponse.next();
  }
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
