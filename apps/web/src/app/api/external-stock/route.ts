import { NextResponse } from 'next/server';
import { upsertExternalStock } from '@/entities/external-stock';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const skuId = Number(body.skuId);
  const location = body.location;
  const quantity = Number(body.quantity);
  if (!Number.isFinite(skuId) || (location !== 'home' && location !== 'ff') || !Number.isFinite(quantity)) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }
  const row = await upsertExternalStock(skuId, location, quantity);
  if (!row) return NextResponse.json({ error: 'upsert_failed' }, { status: 500 });
  return NextResponse.json({ stock: row });
}
