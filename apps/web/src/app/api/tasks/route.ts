import { NextResponse } from 'next/server';
import { createTask, updateTask, deleteTask, type TaskStatus, type TaskPriority } from '@/entities/tasks';
import { TASK_STATUSES, TASK_PRIORITIES } from '@/entities/tasks';

export const dynamic = 'force-dynamic';

function asStatus(v: unknown): TaskStatus | undefined {
  return typeof v === 'string' && (TASK_STATUSES as string[]).includes(v) ? (v as TaskStatus) : undefined;
}
function asPriority(v: unknown): TaskPriority | undefined {
  return typeof v === 'string' && (TASK_PRIORITIES as string[]).includes(v) ? (v as TaskPriority) : undefined;
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

  const task = await createTask({
    title,
    description: asStringOrNull(body.description) ?? null,
    goalId: asNumberOrNull(body.goalId) ?? null,
    skuId: asNumberOrNull(body.skuId) ?? null,
    status: asStatus(body.status),
    priority: asPriority(body.priority),
    dueDate: asStringOrNull(body.dueDate) ?? null,
  });
  if (!task) return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  return NextResponse.json({ task });
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

  const patch: Parameters<typeof updateTask>[1] = {};
  if (typeof body.title === 'string') patch.title = body.title.trim();
  const desc = asStringOrNull(body.description);
  if (desc !== undefined) patch.description = desc;
  const goalId = asNumberOrNull(body.goalId);
  if (goalId !== undefined) patch.goalId = goalId;
  const skuId = asNumberOrNull(body.skuId);
  if (skuId !== undefined) patch.skuId = skuId;
  const status = asStatus(body.status);
  if (status) patch.status = status;
  const priority = asPriority(body.priority);
  if (priority) patch.priority = priority;
  const dueDate = asStringOrNull(body.dueDate);
  if (dueDate !== undefined) patch.dueDate = dueDate;

  const task = await updateTask(id, patch);
  if (!task) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ task });
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

  const ok = await deleteTask(id);
  if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
