import { NextResponse } from 'next/server';
import {
  addHypothesis,
  confirmHypothesis,
  HYPOTHESIS_STATUSES,
  type HypothesisStatus,
} from '@/entities/investigations';

export const dynamic = 'force-dynamic';

function asStatus(v: unknown): HypothesisStatus | undefined {
  return typeof v === 'string' && (HYPOTHESIS_STATUSES as string[]).includes(v)
    ? (v as HypothesisStatus)
    : undefined;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const causeId = typeof body.causeId === 'number' ? body.causeId : Number(body.causeId);
  if (!Number.isFinite(causeId)) {
    return NextResponse.json({ error: 'cause_id_required' }, { status: 400 });
  }
  const statement = typeof body.statement === 'string' ? body.statement.trim() : '';
  if (!statement) return NextResponse.json({ error: 'statement_required' }, { status: 400 });
  const testPlan =
    typeof body.testPlan === 'string' ? body.testPlan : body.testPlan === null ? null : null;

  const hypothesis = await addHypothesis({
    causeId,
    statement,
    testPlan,
    status: asStatus(body.status),
  });
  if (!hypothesis) return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  return NextResponse.json({ hypothesis });
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
  const status = asStatus(body.status) ?? 'confirmed';
  if (status !== 'confirmed' && status !== 'rejected') {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }
  const result = typeof body.result === 'string' ? body.result : '';

  const hypothesis = await confirmHypothesis(id, result, status);
  if (!hypothesis) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ hypothesis });
}
