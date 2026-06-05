import { NextResponse } from 'next/server';
import {
  createPersona,
  updatePersona,
  deletePersona,
  GENDERS,
  INCOME_LEVELS,
  type Gender,
  type IncomeLevel,
} from '@/entities/customer';

export const dynamic = 'force-dynamic';

function asGender(v: unknown): Gender | null | undefined {
  if (v === null) return null;
  return typeof v === 'string' && (GENDERS as string[]).includes(v) ? (v as Gender) : undefined;
}
function asIncome(v: unknown): IncomeLevel | null | undefined {
  if (v === null) return null;
  return typeof v === 'string' && (INCOME_LEVELS as string[]).includes(v)
    ? (v as IncomeLevel)
    : undefined;
}
function asStringOrNull(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v === 'string') return v;
  return undefined;
}
function asIntOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && v !== '' && Number.isFinite(Number(v))) return Math.trunc(Number(v));
  return undefined;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });

  const persona = await createPersona({
    name,
    description: asStringOrNull(body.description) ?? null,
    ageMin: asIntOrNull(body.ageMin) ?? null,
    ageMax: asIntOrNull(body.ageMax) ?? null,
    gender: asGender(body.gender) ?? null,
    incomeLevel: asIncome(body.incomeLevel) ?? null,
  });
  if (!persona) return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  return NextResponse.json({ persona });
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

  const patch: Parameters<typeof updatePersona>[1] = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  const desc = asStringOrNull(body.description);
  if (desc !== undefined) patch.description = desc;
  const ageMin = asIntOrNull(body.ageMin);
  if (ageMin !== undefined) patch.ageMin = ageMin;
  const ageMax = asIntOrNull(body.ageMax);
  if (ageMax !== undefined) patch.ageMax = ageMax;
  const gender = asGender(body.gender);
  if (gender !== undefined) patch.gender = gender;
  const income = asIncome(body.incomeLevel);
  if (income !== undefined) patch.incomeLevel = income;

  const persona = await updatePersona(id, patch);
  if (!persona) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ persona });
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

  const ok = await deletePersona(id);
  if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
