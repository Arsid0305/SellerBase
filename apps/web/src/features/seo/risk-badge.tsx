import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { SeoRisk } from '@/entities/seo';

/**
 * Три уровня риска из docs/seo/stop-words.md:
 *  R — меняет классификацию товара или требует разрешительных документов;
 *  A — довод против собственной карточки, продаёт хуже;
 *  G — рабочий ключ, его отсутствие само по себе дефект.
 */
export const RISK_META: Record<
  SeoRisk,
  { label: string; short: string; description: string; tone: string }
> = {
  R: {
    label: 'Высокий риск',
    short: 'R',
    description:
      'Слово меняет классификацию товара или требует разрешительных документов. Убрать до заливки.',
    tone: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  },
  A: {
    label: 'Средний риск',
    short: 'A',
    description: 'Довод против собственной карточки: снижает доверие или уводит в чужую выдачу.',
    tone: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  G: {
    label: 'Нет ключа',
    short: 'G',
    description: 'Рабочий ключ группы, отсутствие которого — само по себе дефект карточки.',
    tone: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  },
};

export function RiskBadge({
  risk,
  withLabel,
  className,
}: {
  risk: SeoRisk;
  withLabel?: boolean;
  className?: string;
}) {
  const meta = RISK_META[risk];
  return (
    <Badge
      variant="outline"
      className={cn(
        'cursor-help text-[10px] font-medium tracking-wider uppercase',
        meta.tone,
        className,
      )}
      title={meta.description}
    >
      {withLabel ? meta.label : meta.short}
    </Badge>
  );
}
