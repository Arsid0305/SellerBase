import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { requireAuth } from '@/shared/lib/auth/require-auth';

export const dynamic = 'force-dynamic';

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
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
  const b = body as Partial<{
    week_start: string;
    localization_index: number;
    sales_distribution_index: number;
    fbo_reliability_pct: number;
    note: string;
  }>;

  const week = (b.week_start ?? '').trim();
  if (!isIsoDate(week)) return NextResponse.json({ error: 'invalid week_start' }, { status: 400 });

  const num = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('wb_personal_indices')
    .upsert(
      {
        week_start: week,
        localization_index: num(b.localization_index),
        sales_distribution_index: num(b.sales_distribution_index),
        fbo_reliability_pct: num(b.fbo_reliability_pct),
        note: typeof b.note === 'string' && b.note.trim() ? b.note.trim() : null,
      },
      { onConflict: 'week_start' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
