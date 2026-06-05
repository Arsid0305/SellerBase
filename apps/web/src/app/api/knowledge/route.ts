import { NextResponse } from 'next/server';
import {
  addKnowledge,
  fetchKnowledge,
  KNOWLEDGE_CATEGORIES,
  type KnowledgeCategory,
} from '@/entities/investigations';

export const dynamic = 'force-dynamic';

function asCategory(v: unknown): KnowledgeCategory | undefined {
  return typeof v === 'string' && (KNOWLEDGE_CATEGORIES as string[]).includes(v)
    ? (v as KnowledgeCategory)
    : undefined;
}

export async function GET() {
  const items = await fetchKnowledge();
  return NextResponse.json({ items });
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
  const insight = typeof body.insight === 'string' ? body.insight.trim() : '';
  if (!insight) return NextResponse.json({ error: 'insight_required' }, { status: 400 });
  const hypothesisId =
    typeof body.hypothesisId === 'number'
      ? body.hypothesisId
      : body.hypothesisId === null
        ? null
        : Number.isFinite(Number(body.hypothesisId))
          ? Number(body.hypothesisId)
          : null;

  const item = await addKnowledge({
    hypothesisId,
    title,
    insight,
    category: asCategory(body.category) ?? null,
  });
  if (!item) return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  return NextResponse.json({ item });
}
