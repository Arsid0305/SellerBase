import { NextResponse } from 'next/server';
import { fetchCostHistory } from '@/entities/costs';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const skuId = Number(url.searchParams.get('sku_id'));
  if (!Number.isInteger(skuId) || skuId <= 0) {
    return NextResponse.json({ error: 'invalid sku_id' }, { status: 400 });
  }
  const entries = await fetchCostHistory(skuId);
  return NextResponse.json({ entries });
}
