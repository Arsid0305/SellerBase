import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import {
  fetchSupplyPlan,
  fetchSupplyStats,
  fetchPlanItems,
  fetchPlanChinaItems,
} from '@/entities/supplies';
import { fetchSuppliers } from '@/entities/suppliers';
import { SupplyPlanEditor, SupplyPlanActions, type SupplyEditorRow } from '@/features/supplies';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  if (id === 'new') return { title: 'Новая поставка' };
  const planId = Number(id);
  if (!Number.isFinite(planId)) return { title: 'Поставка' };
  const plan = await fetchSupplyPlan(planId);
  return { title: plan?.name ?? 'Поставка' };
}

export default async function SupplyDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const isNew = id === 'new';
  const planId = isNew ? null : Number(id);
  if (!isNew && (!Number.isFinite(planId) || planId == null)) notFound();

  const [plan, { rows: statsRows, warehouses }, allSuppliers, items, chinaItems] = await Promise.all([
    !isNew && planId != null ? fetchSupplyPlan(planId) : Promise.resolve(null),
    fetchSupplyStats(),
    fetchSuppliers(),
    !isNew && planId != null ? fetchPlanItems(planId) : Promise.resolve([]),
    !isNew && planId != null ? fetchPlanChinaItems(planId) : Promise.resolve([]),
  ]);

  if (!isNew && !plan) notFound();

  // index existing items by sku+warehouse
  const itemsBySku = new Map<number, Map<string, number>>();
  for (const it of items) {
    let m = itemsBySku.get(it.skuId);
    if (!m) {
      m = new Map();
      itemsBySku.set(it.skuId, m);
    }
    m.set(it.warehouseName, it.qty);
  }
  const chinaBySku = new Map<number, { qty: number; supplierId: number | null }>();
  for (const it of chinaItems) {
    chinaBySku.set(it.skuId, { qty: it.qty, supplierId: it.supplierId });
  }

  const suppliersBySku = new Map<number, typeof allSuppliers>();
  for (const s of allSuppliers) {
    const arr = suppliersBySku.get(s.skuId) ?? [];
    arr.push(s);
    suppliersBySku.set(s.skuId, arr);
  }

  const rows: SupplyEditorRow[] = statsRows.map((r) => {
    const suppliers = (suppliersBySku.get(r.skuId) ?? []).map((s) => ({
      id: s.id,
      name: s.supplierName,
      link: s.link1688,
      priceCny: s.priceCny,
      isDefault: s.isDefault,
    }));
    const existingQty = itemsBySku.get(r.skuId);
    const qtyByWarehouse: Record<string, number> = {};
    for (const w of warehouses) {
      if (existingQty?.has(w)) qtyByWarehouse[w] = existingQty.get(w) ?? 0;
      else if (isNew) qtyByWarehouse[w] = r.recommendByWarehouse[w] ?? 0;
      else qtyByWarehouse[w] = 0;
    }
    const china = chinaBySku.get(r.skuId);
    const defaultSup = suppliers.find((s) => s.isDefault) ?? suppliers[0];
    return {
      skuId: r.skuId,
      myArticle: r.myArticle,
      wbArticle: r.wbArticle,
      barcode: r.barcode,
      title: r.title,
      salesByWarehouse: r.salesByWarehouse,
      stocksByWarehouse: r.stocksByWarehouse,
      homeStock: r.homeStock,
      ffStock: r.ffStock,
      recommendByWarehouse: r.recommendByWarehouse,
      suppliers,
      qtyByWarehouse,
      selectedSupplierId: china?.supplierId ?? defaultSup?.id ?? null,
      chinaQty: china?.qty ?? 0,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/supplies" className="inline-flex items-center gap-1 hover:text-foreground">
          <ChevronLeft className="size-4" />
          Поставки
        </Link>
        <span>·</span>
        <span className="truncate font-medium text-foreground">
          {isNew ? 'Новая поставка' : plan?.name}
        </span>
      </div>

      <SupplyPlanEditor
        planId={planId}
        initialName={plan?.name ?? ''}
        initialStatus={plan?.status ?? 'draft'}
        initialNotes={plan?.notes ?? ''}
        warehouses={warehouses}
        rows={rows}
      />

      {!isNew && planId != null && (
        <SupplyPlanActions planId={planId} />
      )}
    </div>
  );
}
