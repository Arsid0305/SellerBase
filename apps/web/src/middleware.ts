import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { env } from '@/shared/lib/env';

export const config = {
  // Применяем ко всем путям кроме статики/служебных.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|branding/|manifest.webmanifest|sw.js|workbox-).*)'],
};

// Адрес, с которого разрешено слать изменения, берётся из самого запроса:
// раньше он был вписан руками и разошёлся с настоящим адресом сайта -
// сохранение настроек молча получало отказ. Список ниже нужен только для
// работы на своей машине.
const DEV_HOSTS = ['localhost:3000', 'localhost', '127.0.0.1:3000', '127.0.0.1'];

// Публичные пути — доступны без сессии.
const PUBLIC_PATHS = ['/login', '/auth/callback', '/api/health'];

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Запрос пришёл со своей же страницы?
 *
 * Сравниваем адрес источника с адресом, на который пришёл запрос, целиком -
 * не кусками. Проверка по куску строки пропускала бы чужой домен вида
 * `seller-base.vercel.app.example.com`.
 */
function isSameOrigin(req: NextRequest): boolean {
  const self = (req.headers.get('host') ?? '').toLowerCase();
  const source = hostOf(req.headers.get('origin')) ?? hostOf(req.headers.get('referer'));
  if (!source) return false;
  return source === self || DEV_HOSTS.includes(source);
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Тройная защита:
 *
 * Слой A (Auth, всё приложение): Supabase session. Если её нет — редирект на /login
 *   для страниц, 401 JSON для /api/*.
 *
 * Слой B (Origin/Referer, только /api/*): отбрасывает curl/боты с чужого домена
 *   даже если они каким-то образом получили cookie.
 *
 * Слой C (X-API-Secret, только /api/*): если задан API_SECRET — позволяет
 *   server-to-server вызовам пройти без cookie.
 */
export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');

  // === Слой A: Supabase session ===
  const response = NextResponse.next();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set({ name, value, ...options });
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = isPublicPath(pathname);

  if (!user && !isPublic) {
    if (isApi) {
      // Перед 401-м всё равно дадим server-to-server (X-API-Secret) шанс ниже.
      const expected = process.env.API_SECRET;
      if (expected && req.headers.get('x-api-secret') === expected) {
        return response;
      }
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Если уже залогинен и идёт на /login — кидаем на главную.
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // === Слои B/C только для /api/* мутирующих ===
  if (isApi && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    const sameOrigin = isSameOrigin(req);

    const expected = process.env.API_SECRET;
    if (expected) {
      const got = req.headers.get('x-api-secret');
      if (got === expected) return response;
      if (sameOrigin) return response;
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    if (!sameOrigin) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  return response;
}
