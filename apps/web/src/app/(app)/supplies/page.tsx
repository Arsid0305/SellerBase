import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/widgets/app-shell/page-header';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { fetchSupplyPlans, SUPPLY_PLAN_STATUS_LABEL, type SupplyPlanStatus } from '@/entities/supplies';
import { fetchFbwSupplies } from '@/entities/wb-supplies';
import { FbwSuppliesTable, SuppliesTabs } from '@/features/wb-supplies';
import { formatInt } from '@/shared/lib/format';

export const metadata = { title: 'Поставки' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function statusClass(s: SupplyPlanStatus): string {
  switch (s) {
    case 'draft':
      return 'border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300';
    case 'sent_to_ff':
      return 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400';
    case 'sent_to_china':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400';
    case 'received':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    case 'cancelled':
      return 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400';
  }
}

export default async function SuppliesPage() {
  const [plans, fbwSupplies] = await Promise.all([fetchSupplyPlans(), fetchFbwSupplies()]);

  const plansSlot = plans.length === 0 ? (
    <div className="rounded-xl border border-dashed bg-card/40 px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground">Планов поставок ещё нет.</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Создайте первый — система предложит рекомендации по каждому складу WB.
      </p>
    </div>
  ) : (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {plans.map((p) => (
        <Link
          key={p.id}
          href={`/supplies/${p.id}`}
          className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/30 hover:bg-accent/40"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-medium leading-snug group-hover:underline">{p.name}</h3>
            <Badge variant="outline" className={statusClass(p.status)}>
              {SUPPLY_PLAN_STATUS_LABEL[p.status]}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{new Date(p.createdAt).toLocaleDateString('ru-RU')}</span>
            <span className="tabular-nums">{formatInt(p.itemsCount ?? 0)} позиций</span>
          </div>
        </Link>
      ))}
    </div>
  );

  const fbwSlot = <FbwSuppliesTable rows={fbwSupplies} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Поставки" description="Планы закупок из Китая + FBW-поставки на WB с расчётом доставки на единицу" />
        <Button asChild>
          <Link href="/supplies/new" className="inline-flex items-center gap-2">
            <Plus className="size-4" />
            Новая поставка
          </Link>
        </Button>
      </div>
      <SuppliesTabs plansSlot={plansSlot} fbwSlot={fbwSlot} />
    </div>
  );
}
