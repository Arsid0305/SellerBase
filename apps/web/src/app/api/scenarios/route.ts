import { NextResponse } from 'next/server';
import {
  createScenario,
  updateScenario,
  deleteScenario,
  LEVELS_3,
  type Level3,
} from '@/entities/customer';

export const dynamic = 'force-dynamic';

function asLevel(v: unknown): Level3 | undefined {
  return typeof v === 'string' && (LEVELS_3 as string[]).includes(v) ? (v as Level3) : undefined;
}
function asStringOrNull(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v === 'string') return v;
  return undefined;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });

  const scenario = await createScenario({
    title,
    description: asStringOrNull(body.description) ?? null,
    trigger: asStringOrNull(body.trigger) ?? null,
    urgency: asLevel(body.urgency),
    priceSensitivity: asLevel(body.priceSensitivity),
  });
  if (!scenario) return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  return NextResponse.json({ scenario });
}

export async function PATCH(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const id = typeof body.id === 'number' ? body.id : Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  const patch: Parameters<typeof updateScenario>[1] = {};
  if (typeof body.title === 'string') patch.title = body.title.trim();
  const desc = asStringOrNull(body.description);
  if (desc !== undefined) patch.description = desc;
  const trigger = asStringOrNull(body.trigger);
  if (trigger !== undefined) patch.trigger = trigger;
  const urgency = asLevel(body.urgency);
  if (urgency) patch.urgency = urgency;
  const ps = asLevel(body.priceSensitivity);
  if (ps) patch.priceSensitivity = ps;

  const scenario = await updateScenario(id, patch);
  if (!scenario) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ scenario });
}

export async function DELETE(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const id = typeof body.id === 'number' ? body.id : Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  const ok = await deleteScenario(id);
  if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
