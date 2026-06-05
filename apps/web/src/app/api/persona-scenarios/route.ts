import { NextResponse } from 'next/server';
import { linkPersonaScenario, unlinkPersonaScenario } from '@/entities/customer';

export const dynamic = 'force-dynamic';

function asId(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const personaId = asId(body.personaId);
  const scenarioId = asId(body.scenarioId);
  if (personaId == null || scenarioId == null) {
    return NextResponse.json({ error: 'ids_required' }, { status: 400 });
  }
  const weightRaw = body.weight;
  const weight =
    typeof weightRaw === 'number'
      ? weightRaw
      : typeof weightRaw === 'string' && weightRaw !== ''
        ? Number(weightRaw)
        : 1;
  const ok = await linkPersonaScenario(personaId, scenarioId, Number.isFinite(weight) ? weight : 1);
  if (!ok) return NextResponse.json({ error: 'link_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const personaId = asId(body.personaId);
  const scenarioId = asId(body.scenarioId);
  if (personaId == null || scenarioId == null) {
    return NextResponse.json({ error: 'ids_required' }, { status: 400 });
  }
  const ok = await unlinkPersonaScenario(personaId, scenarioId);
  if (!ok) return NextResponse.json({ error: 'unlink_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
