import { NextResponse } from 'next/server';
import {
  createInvestigation,
  INVESTIGATION_STATUSES,
  type InvestigationStatus,
} from '@/entities/investigations';

export const dynamic = 'force-dynamic';

function asStatus(v: unknown): InvestigationStatus | undefined {
  return typeof v === 'string' && (INVESTIGATION_STATUSES as string[]).includes(v)
    ? (v as InvestigationStatus)
    : undefined;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const problemId = typeof body.problemId === 'number' ? body.problemId : Number(body.problemId);
  if (!Number.isFinite(problemId)) {
    return NextResponse.json({ error: 'problem_id_required' }, { status: 400 });
  }
  const notes = typeof body.notes === 'string' ? body.notes : body.notes === null ? null : null;

  const investigation = await createInvestigation({
    problemId,
    notes,
    status: asStatus(body.status),
  });
  if (!investigation) return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  return NextResponse.json({ investigation });
}
