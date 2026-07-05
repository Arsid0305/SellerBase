import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { requireAuth } from '@/shared/lib/auth/require-auth';

export const dynamic = 'force-dynamic';

type Update = { nmID: number; price: number; discount: number };

function isValidUpdate(u: unknown): u is Update {
  if (!u || typeof u !== 'object') return false;
  const o = u as Record<string, unknown>;
  return (
    typeof o.nmID === 'number' && o.nmID > 0 &&
    typeof o.price === 'number' && o.price > 0 &&
    typeof o.discount === 'number' && o.discount >= 0 && o.discount <= 90
  );
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
  const raw = body as { data?: unknown[] };
  if (!Array.isArray(raw?.data) || raw.data.length === 0) {
    return NextResponse.json({ error: 'data must be non-empty array' }, { status: 400 });
  }
  const updates = raw.data.filter(isValidUpdate);
  if (updates.length !== raw.data.length) {
    return NextResponse.json({ error: 'invalid item (nmID>0, price>0, discount 0..90)' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.functions.invoke('set-wb-price', {
    body: { data: updates },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  return NextResponse.json(data);
}
