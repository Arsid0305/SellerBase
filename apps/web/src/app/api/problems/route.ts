import { NextResponse } from 'next/server';
import {
  createProblem,
  updateProblem,
  deleteProblem,
  PROBLEM_SEVERITIES,
  PROBLEM_STATUSES,
  PROBLEM_SOURCES,
  type ProblemSeverity,
  type ProblemStatus,
  type ProblemSource,
} from '@/entities/investigations';

export const dynamic = 'force-dynamic';

function asSeverity(v: unknown): ProblemSeverity | undefined {
  return typeof v === 'string' && (PROBLEM_SEVERITIES as string[]).includes(v)
    ? (v as ProblemSeverity)
    : undefined;
}
function asStatus(v: unknown): ProblemStatus | undefined {
  return typeof v === 'string' && (PROBLEM_STATUSES as string[]).includes(v)
    ? (v as ProblemStatus)
    : undefined;
}
function asSource(v: unknown): ProblemSource | undefined {
  return typeof v === 'string' && (PROBLEM_SOURCES as string[]).includes(v)
    ? (v as ProblemSource)
    : undefined;
}
function asStringOrNull(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v === 'string') return v;
  return undefined;
}
function asNumberOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === 'number') return v;
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

  const problem = await createProblem({
    title,
    description: asStringOrNull(body.description) ?? null,
    severity: asSeverity(body.severity),
    scopeSkuId: asNumberOrNull(body.scopeSkuId) ?? null,
    scopeCategory: asStringOrNull(body.scopeCategory) ?? null,
    status: asStatus(body.status),
    source: asSource(body.source),
  });
  if (!problem) return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  return NextResponse.json({ problem });
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

  const patch: Parameters<typeof updateProblem>[1] = {};
  if (typeof body.title === 'string') patch.title = body.title.trim();
  const desc = asStringOrNull(body.description);
  if (desc !== undefined) patch.description = desc;
  const severity = asSeverity(body.severity);
  if (severity) patch.severity = severity;
  const scopeSkuId = asNumberOrNull(body.scopeSkuId);
  if (scopeSkuId !== undefined) patch.scopeSkuId = scopeSkuId;
  const scopeCategory = asStringOrNull(body.scopeCategory);
  if (scopeCategory !== undefined) patch.scopeCategory = scopeCategory;
  const status = asStatus(body.status);
  if (status) patch.status = status;
  const source = asSource(body.source);
  if (source) patch.source = source;

  const problem = await updateProblem(id, patch);
  if (!problem) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ problem });
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

  const ok = await deleteProblem(id);
  if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
