import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { env } from '@/shared/lib/env';

export const config = {
  // Применяем ко всем путям кроме статики/служебных.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|branding/|manifest.webmanifest|sw.js|workbox-).*)'],
};

const ALLOWED_HOSTS = ['seller-base.vercel.app', 'localhost:3000', 'localhost', 'arsid.vercel.app'];

// Публичные пути — доступны без сессии.
const PUBLIC_PATHS = ['/login', '/auth/callback', '/api/health'];

function hasAllowedHost(value: string | null): boolean {
  if (!value) return false;
  return ALLOWED_HOSTS.some((host) => value.includes(host));
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
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    const sameOrigin = hasAllowedHost(origin) || hasAllowedHost(referer);

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
