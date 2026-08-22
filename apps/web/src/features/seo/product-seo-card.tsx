import Link from 'next/link';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/lib/utils';
import { checkTitle, type SeoSkuSummary } from '@/entities/seo';
import { RiskBadge } from './risk-badge';

/**
 * Блок SEO внутри карточки товара. Индикатор берётся из той же view,
 * что и вкладка /seo — одна проверка, два места показа.
 */
export function ProductSeoCard({ seo }: { seo: SeoSkuSummary | null }) {
  if (!seo) return null;

  const href = `/seo?article=${encodeURIComponent(seo.myArticle)}`;
  const clean = seo.nTotal === 0;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="text-base">SEO карточки</CardTitle>
          <CardDescription>
            {clean
              ? 'Замечаний нет: стоп-слов не найдено, рабочие ключи группы на месте.'
              : `${seo.nTotal} замечаний по регламенту — наименование, описание, характеристики.`}
          </CardDescription>
        </div>
        <Link
          href={href}
          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-sm"
        >
          Во вкладке
          <ArrowUpRight className="size-4" />
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pb-4">
        {clean ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-4" />
            Карточка проходит проверку
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <Counter
                label="Высокий риск"
                n={seo.nRiskR}
                tone="text-rose-600 dark:text-rose-400"
              />
              <Counter
                label="Средний риск"
                n={seo.nRiskA}
                tone="text-amber-600 dark:text-amber-400"
              />
              <Counter label="Нет ключа" n={seo.nMissingG} tone="text-sky-600 dark:text-sky-400" />
            </div>
            <div className="flex flex-col gap-2">
              {seo.issues.slice(0, 6).map((issue, i) => (
                <div
                  key={`${issue.checkName}-${issue.finding}-${i}`}
                  className="border-border bg-muted/20 flex flex-col gap-1 rounded-md border p-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <RiskBadge risk={issue.risk} />
                    <span className="text-sm font-medium">{checkTitle(issue.checkName)}</span>
                    <span className="text-muted-foreground text-sm">— {issue.finding}</span>
                  </div>
                  {issue.suggestion && (
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {issue.suggestion}
                    </p>
                  )}
                </div>
              ))}
              {seo.issues.length > 6 && (
                <Link href={href} className="text-muted-foreground text-xs hover:underline">
                  ещё {seo.issues.length - 6} — смотреть во вкладке SEO
                </Link>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Counter({ label, n, tone }: { label: string; n: number; tone: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span
        className={cn('text-lg font-semibold tabular-nums', n === 0 && 'text-muted-foreground')}
      >
        {n}
      </span>
      <span className={cn('text-xs', n === 0 ? 'text-muted-foreground' : tone)}>{label}</span>
    </span>
  );
}
