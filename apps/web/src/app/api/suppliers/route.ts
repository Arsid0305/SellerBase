import { NextResponse } from 'next/server';
import { createSupplier, updateSupplier, deleteSupplier } from '@/entities/suppliers';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const skuId = Number(body.skuId);
  const supplierName = typeof body.supplierName === 'string' ? body.supplierName.trim() : '';
  const link1688 = typeof body.link1688 === 'string' ? body.link1688.trim() : '';
  if (!Number.isFinite(skuId) || !supplierName || !link1688) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }
  const priceCny = body.priceCny == null ? null : Number(body.priceCny);
  const supplier = await createSupplier({
    skuId,
    supplierName,
    link1688,
    priceCny: Number.isFinite(priceCny as number) ? (priceCny as number) : null,
    isDefault: !!body.isDefault,
    notes: typeof body.notes === 'string' ? body.notes : null,
  });
  if (!supplier) return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  return NextResponse.json({ supplier });
}

export async function PATCH(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  const patch: Parameters<typeof updateSupplier>[1] = {};
  if (typeof body.supplierName === 'string') patch.supplierName = body.supplierName.trim();
  if (typeof body.link1688 === 'string') patch.link1688 = body.link1688.trim();
  if (body.priceCny === null) patch.priceCny = null;
  else if (typeof body.priceCny === 'number' || typeof body.priceCny === 'string') {
    const n = Number(body.priceCny);
    if (Number.isFinite(n)) patch.priceCny = n;
  }
  if (typeof body.isDefault === 'boolean') patch.isDefault = body.isDefault;
  if (body.notes === null || typeof body.notes === 'string') patch.notes = body.notes as string | null;

  const supplier = await updateSupplier(id, patch);
  if (!supplier) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ supplier });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get('id'));
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id_required' }, { status: 400 });
  const ok = await deleteSupplier(id);
  if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
