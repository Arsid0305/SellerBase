import { NextResponse, type NextRequest } from 'next/server';

export const config = { matcher: '/api/:path*' };

const ALLOWED_HOSTS = ['seller-base.vercel.app', 'localhost:3000', 'localhost', 'arsid.vercel.app'];

function hasAllowedHost(value: string | null): boolean {
  if (!value) return false;
  return ALLOWED_HOSTS.some((host) => value.includes(host));
}

export default function middleware(req: NextRequest) {
  // Read-only запросы не модифицируют данные — пропускаем без проверки.
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return NextResponse.next();
  }

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  if (hasAllowedHost(origin) || hasAllowedHost(referer)) {
    return NextResponse.next();
  }

  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
