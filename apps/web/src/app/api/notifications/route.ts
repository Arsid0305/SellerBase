import { NextResponse } from 'next/server';
import { fetchAll, markAllRead, markRead } from '@/entities/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') ?? '15');
    const items = await fetchAll(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 15);
    return NextResponse.json({ items });
  } catch (err) {
    return bad(err instanceof Error ? err.message : 'unknown error', 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { id?: unknown; all?: unknown };
    if (body.all === true) {
      await markAllRead();
      return NextResponse.json({ ok: true });
    }
    const id = typeof body.id === 'number' ? body.id : Number(body.id);
    if (!Number.isFinite(id)) return bad('id or all required');
    await markRead(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return bad(err instanceof Error ? err.message : 'unknown error', 500);
  }
}
