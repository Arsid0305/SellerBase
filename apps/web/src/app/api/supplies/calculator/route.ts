import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { requireAuth } from '@/shared/lib/auth/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const lead = Number(url.searchParams.get('lead') ?? 60);
  const safety = Number(url.searchParams.get('safety') ?? 14);
  if (!Number.isFinite(lead) || !Number.isFinite(safety) || lead < 0 || safety < 0) {
    return NextResponse.json({ error: 'invalid lead/safety' }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('get_supply_recommendation', {
    p_lead_days: Math.round(lead),
    p_safety_days: Math.round(safety),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
