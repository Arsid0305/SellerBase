import { NextResponse } from 'next/server';
import { requireAuth } from '@/shared/lib/auth/require-auth';
import { parseEntries, saveMenuLayout } from '@/entities/menu-layout';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const entries = parseEntries((body as { entries?: unknown })?.entries);
  if (entries.length > 200) {
    return NextResponse.json({ error: 'too_many_entries' }, { status: 400 });
  }
  const ok = await saveMenuLayout(entries);
  if (!ok) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
