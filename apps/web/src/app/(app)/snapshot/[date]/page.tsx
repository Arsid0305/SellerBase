import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/widgets/app-shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { fetchBusinessSnapshot } from '@/entities/business-snapshot';

export const metadata = { title: 'Снимок бизнеса' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = Promise<{ date: string }>;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function shiftDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateRu(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

function rub(n: number): string {
  return `${n.toLocaleString('ru-RU')} ₽`;
}

function severityVariant(severity: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (severity === 'critical' || severity === 'high') return 'destructive';
  if (severity === 'med') return 'default';
  return 'secondary';
}

function priorityVariant(priority: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (priority === 'high') return 'destructive';
  if (priority === 'med') return 'default';
  return 'secondary';
}

export default async function SnapshotDatePage({ params }: { params: Params }) {
  const { date } = await params;
  if (!ISO_RE.test(date)) notFound();
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) notFound();

  const snapshot = await fetchBusinessSnapshot(date);
  const today = todayIso();
  const isArchive = date < today;
  const prev = shiftDays(date, -1);
  const next = shiftDays(date, 1);
  const showNext = next <= today;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Снимок бизнеса на ${formatDateRu(date)}`}
        description="Что было известно в этот день"
      />

      {isArchive && (
        <div className="rounded-md border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          Архивные данные · состояние на {formatDateRu(date)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Активных SKU" value={snapshot.activeSkus.toLocaleString('ru-RU')} />
        <KpiCard label="Выручка за 30 дней" value={rub(snapshot.revenue30d)} />
        <KpiCard label="Заказов за 30 дней" value={snapshot.orders30d.toLocaleString('ru-RU')} />
        <KpiCard label="Средний чек" value={rub(snapshot.avgCheck)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Открытые цели</CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot.openGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет открытых целей.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {snapshot.openGoals.map((g) => (
                  <li key={g.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{g.title}</span>
                      <Badge variant="outline">{g.status}</Badge>
                    </div>
                    {g.progress != null && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.max(0, Math.min(100, g.progress))}%` }}
                        />
                      </div>
                    )}
                    {g.deadline && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Дедлайн: {formatDateRu(g.deadline)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Открытые задачи</CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot.openTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет открытых задач.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {snapshot.openTasks.slice(0, 20).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{t.title}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={priorityVariant(t.priority)}>{t.priority}</Badge>
                      <Badge variant="outline">{t.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Открытые проблемы</CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot.openProblems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет открытых проблем.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {snapshot.openProblems.slice(0, 20).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{p.title}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={severityVariant(p.severity)}>{p.severity}</Badge>
                      <Badge variant="outline">{p.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Аномалии на дату</CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot.anomalies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Аномалий не обнаружено.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {snapshot.anomalies.map((a) => (
                  <li key={a.barcode} className="flex items-center justify-between gap-2 text-sm">
                    <Link
                      href={`/products/${encodeURIComponent(a.barcode)}`}
                      className="truncate hover:underline"
                    >
                      {a.title}
                    </Link>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="text-muted-foreground">
                        {a.units} vs {a.baseline}
                      </span>
                      <Badge variant={a.direction === 'spike' ? 'default' : 'destructive'}>
                        z={a.zScore}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Топ-10 товаров по выручке за 30 дней</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshot.topSkus.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет данных по продажам.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {snapshot.topSkus.map((s, i) => (
                <li key={s.barcode} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-5 text-right text-muted-foreground tabular-nums">{i + 1}</span>
                    <Link
                      href={`/products/${encodeURIComponent(s.barcode)}`}
                      className="truncate hover:underline"
                    >
                      {s.title}
                    </Link>
                  </div>
                  <div className="flex items-center gap-4 tabular-nums">
                    <span className="text-muted-foreground">{s.orders} шт.</span>
                    <span className="font-medium">{rub(s.revenue)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <Link href={`/snapshot/${prev}`} className="text-muted-foreground hover:text-foreground">
          ← {formatDateRu(prev)}
        </Link>
        <Link href="/snapshot" className="text-muted-foreground hover:text-foreground">
          Выбрать другую дату
        </Link>
        {showNext ? (
          <Link href={`/snapshot/${next}`} className="text-muted-foreground hover:text-foreground">
            {formatDateRu(next)} →
          </Link>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-6">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}
