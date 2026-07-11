import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { requireAuth } from '@/shared/lib/auth/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const planId = Number(id);
  if (!Number.isFinite(planId) || planId <= 0) {
    return NextResponse.json({ error: 'invalid plan id' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.functions.invoke('create-wb-supply', {
    body: { plan_id: planId },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  return NextResponse.json(data);
}
