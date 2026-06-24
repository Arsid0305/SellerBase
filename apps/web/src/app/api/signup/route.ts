import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { email: string; password: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'password must be at least 8 characters' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { count, error: countErr } = await supabase
    .schema('auth')
    .from('users')
    .select('id', { count: 'exact', head: true });
  if (countErr) {
    return NextResponse.json({ error: `count failed: ${countErr.message}` }, { status: 500 });
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'signup closed: user already exists' }, { status: 410 });
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, user_id: data.user?.id });
}
