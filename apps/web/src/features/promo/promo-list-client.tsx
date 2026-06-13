'use client';

import Link from 'next/link';
import { ArrowRight, Clock, TrendingUp } from 'lucide-react';
import type { PromoSummary } from '@/entities/promo';

const trafficLight = (avg: number | null) => {
  if (avg == null) return { color: 'bg-muted text-muted-foreground', label: 'Нет данных' };
  if (avg > 90) return { color: 'bg-red-500/15 text-red-600', label: 'Залежи' };
  if (avg >= 60) return { color: 'bg-amber-500/15 text-amber-600', label: 'Можно ускорить' };
  return { color: 'bg-emerald-500/15 text-emerald-600', label: 'Продаётся' };
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });

export function PromoListClient({ promos }: { promos: PromoSummary[] }) {
  if (promos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Нет активных или будущих акций WB.
        <br />
        Список обновляется автоматически — cron <code>fetch-wb-promotions</code>.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {promos.map((p) => {
        const tl = trafficLight(p.avgTurnoverDays);
        return (
          <Link
            key={p.promotionId}
            href={`/promo/${p.promotionId}`}
            className="group rounded-lg border border-border bg-card p-4 transition hover:border-primary hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="line-clamp-2 text-sm font-medium">{p.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.type === 'auto' ? 'Авто-акция' : 'Стандартная'}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {fmtDate(p.startAt)} – {fmtDate(p.endAt)}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">SKU</div>
                <div className="text-sm font-semibold">{p.skuCount}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Участвую</div>
                <div className="text-sm font-semibold text-emerald-600">{p.participatingCount}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Не решено</div>
                <div className="text-sm font-semibold text-amber-600">{p.pendingCount}</div>
              </div>
            </div>

            <div
              className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${tl.color}`}
            >
              <TrendingUp className="h-3 w-3" />
              {tl.label}
              {p.avgTurnoverDays != null && ` · ${p.avgTurnoverDays}д`}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
