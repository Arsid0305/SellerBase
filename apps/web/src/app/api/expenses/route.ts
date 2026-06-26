import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { requireAuth } from '@/shared/lib/auth/require-auth';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['Реклама вне WB', 'Упаковка', 'Зарплата', 'Прочее'] as const;

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('manual_expenses')
    .select('id, dt, category, amount_rub, note, created_at')
    .order('dt', { ascending: false })
    .order('id', { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const b = body as Partial<{ dt: string; category: string; amount_rub: number; note: string }>;

  const dt = (b.dt ?? '').trim();
  if (!isIsoDate(dt)) return NextResponse.json({ error: 'invalid dt' }, { status: 400 });

  const category = (b.category ?? '').trim();
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return NextResponse.json({ error: 'invalid category' }, { status: 400 });
  }

  const amount = Number(b.amount_rub);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: 'invalid amount_rub' }, { status: 400 });
  }

  const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim() : null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('manual_expenses')
    .insert({ dt, category, amount_rub: amount, note })
    .select('id, dt, category, amount_rub, note, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const id = Number(url.searchParams.get('id'));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('manual_expenses').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
