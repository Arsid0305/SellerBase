import { NextResponse } from 'next/server';
import { addCause } from '@/entities/investigations';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const investigationId =
    typeof body.investigationId === 'number' ? body.investigationId : Number(body.investigationId);
  if (!Number.isFinite(investigationId)) {
    return NextResponse.json({ error: 'investigation_id_required' }, { status: 400 });
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });
  const description =
    typeof body.description === 'string' ? body.description : body.description === null ? null : null;
  const confidence =
    typeof body.confidence === 'number' ? body.confidence : Number(body.confidence ?? 50);
  const isConfirmed = typeof body.isConfirmed === 'boolean' ? body.isConfirmed : false;

  const cause = await addCause({
    investigationId,
    title,
    description,
    confidence: Number.isFinite(confidence) ? confidence : 50,
    isConfirmed,
  });
  if (!cause) return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  return NextResponse.json({ cause });
}
