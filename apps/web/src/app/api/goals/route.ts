import { NextResponse } from 'next/server';
import { createGoal, deleteGoal, updateGoal } from '@/entities/goals';
import type { GoalInput, GoalMetric, GoalPatch, GoalScope, GoalStatus } from '@/entities/goals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const METRICS: GoalMetric[] = ['revenue', 'margin', 'units', 'custom'];
const STATUSES: GoalStatus[] = ['active', 'achieved', 'paused', 'cancelled'];
const SCOPES: GoalScope[] = ['all', 'sku', 'category'];

function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

function asNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function validateInput(body: Record<string, unknown>, partial = false): GoalInput | GoalPatch | string {
  const out: GoalPatch = {};
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim() === '') return 'title must be non-empty string';
    out.title = body.title.trim();
  } else if (!partial) {
    return 'title is required';
  }
  if (body.metric !== undefined) {
    if (!METRICS.includes(body.metric as GoalMetric)) return 'metric invalid';
    out.metric = body.metric as GoalMetric;
  } else if (!partial) {
    return 'metric is required';
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as GoalStatus)) return 'status invalid';
    out.status = body.status as GoalStatus;
  }
  if (body.scope !== undefined) {
    if (!SCOPES.includes(body.scope as GoalScope)) return 'scope invalid';
    out.scope = body.scope as GoalScope;
  }
  if (body.targetValue !== undefined) out.targetValue = asNumber(body.targetValue);
  if (body.currentValue !== undefined) out.currentValue = asNumber(body.currentValue);
  if (body.deadline !== undefined) {
    out.deadline = body.deadline === null || body.deadline === '' ? null : String(body.deadline);
  }
  if (body.scopeValue !== undefined) {
    out.scopeValue =
      body.scopeValue === null || body.scopeValue === '' ? null : String(body.scopeValue);
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const v = validateInput(body, false);
    if (typeof v === 'string') return bad(v);
    const input = v as GoalInput;
    const goal = await createGoal({
      title: input.title,
      metric: input.metric,
      targetValue: input.targetValue ?? null,
      currentValue: input.currentValue ?? null,
      deadline: input.deadline ?? null,
      status: input.status ?? 'active',
      scope: input.scope ?? 'all',
      scopeValue: input.scopeValue ?? null,
    });
    return NextResponse.json({ goal });
  } catch (err) {
    return bad(err instanceof Error ? err.message : 'unknown error', 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { id?: unknown; patch?: Record<string, unknown> };
    const id = asNumber(body.id);
    if (id == null) return bad('id required');
    const patchBody = body.patch ?? {};
    const v = validateInput(patchBody, true);
    if (typeof v === 'string') return bad(v);
    const goal = await updateGoal(id, v as GoalPatch);
    return NextResponse.json({ goal });
  } catch (err) {
    return bad(err instanceof Error ? err.message : 'unknown error', 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as { id?: unknown };
    const id = asNumber(body.id);
    if (id == null) return bad('id required');
    await deleteGoal(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return bad(err instanceof Error ? err.message : 'unknown error', 500);
  }
}
