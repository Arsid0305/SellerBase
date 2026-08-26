'use client';

import { X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import { checkTitle, type SeoSkuRow } from '@/entities/seo';
import { RiskBadge } from './risk-badge';

/**
 * Разбор одной карточки: что нашли, где именно и что с этим делать.
 * Только чтение — правки владелец вносит в кабинете WB вручную.
 */
export function SeoSkuDetail({ sku, onClose }: { sku: SeoSkuRow; onClose: () => void }) {
  return (
    <Card className="border-primary/30">
      <CardHeader className="flex-row items-start gap-3 space-y-0 pb-3">
        <SkuThumb src={sku.photoUrl} alt={sku.title ?? sku.myArticle} size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <CardTitle className="text-base leading-tight">
            {sku.title ?? '— без наименования —'}
          </CardTitle>
          <CardDescription className="font-mono text-[11px]">
            {sku.myArticle}
            {sku.wbArticle ? ` · WB ${sku.wbArticle}` : ''}
            {sku.subjectName ? ` · ${sku.subjectName}` : ''} · описание {sku.descLen} зн. ·{' '}
            {sku.charCount} характеристик
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Закрыть разбор">
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pb-4">
        {sku.missingFields.length > 0 && (
          <div className="border-border bg-muted/20 flex flex-col gap-1.5 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Незаполненные поля WB</span>
              <span className="text-muted-foreground text-sm tabular-nums">
                — {sku.missingFields.length} из {sku.charcsTotal}
                {sku.requiredMissing > 0 ? `, обязательных ${sku.requiredMissing}` : ''}
              </span>
            </div>
            <p className="text-xs leading-relaxed">{sku.missingFields.join(' · ')}</p>
            {sku.charcsUnknown > 0 && (
              <p className="text-muted-foreground text-xs leading-relaxed">
                Ещё {sku.charcsUnknown} полей мы с WB не тянем (ТН ВЭД, сертификаты, НДС) — про них
                состояние неизвестно, в счёт они не идут.
              </p>
            )}
          </div>
        )}
        {sku.issues.map((issue, i) => (
          <div
            key={`${issue.checkName}-${issue.finding}-${i}`}
            className="border-border bg-muted/20 flex flex-col gap-1.5 rounded-md border p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge risk={issue.risk} />
              <span className="text-sm font-medium">{checkTitle(issue.checkName)}</span>
              <span className="text-muted-foreground text-sm">— {issue.finding}</span>
            </div>
            {issue.detail && (
              <p className="text-muted-foreground text-xs leading-relaxed">{issue.detail}</p>
            )}
            {issue.suggestion && (
              <p className="text-xs leading-relaxed">
                <span className="text-muted-foreground">Что делать: </span>
                {issue.suggestion}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
