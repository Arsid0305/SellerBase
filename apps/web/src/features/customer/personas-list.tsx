import Link from 'next/link';
import { Users } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { GENDER_LABEL, INCOME_LABEL, type PersonaWithScenarios } from '@/entities/customer';

type Props = { personas: PersonaWithScenarios[] };

function ageRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}–${max} лет`;
  if (min != null) return `от ${min} лет`;
  return `до ${max} лет`;
}

export function PersonasList({ personas }: Props) {
  if (personas.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
        <Users className="mx-auto mb-2 h-6 w-6 text-neutral-300" />
        Пока нет персон. Создайте первую — типового покупателя ваших товаров.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {personas.map((p) => {
        const age = ageRange(p.ageMin, p.ageMax);
        return (
          <Link
            key={p.id}
            href={`/customers/${p.id}`}
            className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-neutral-300"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold text-neutral-900">{p.name}</div>
              <Badge variant="outline" className="shrink-0 border-neutral-200 bg-neutral-50 text-neutral-700">
                {p.scenarios.length} сценариев
              </Badge>
            </div>
            {p.description ? (
              <p className="line-clamp-2 text-xs leading-relaxed text-neutral-600">{p.description}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {age ? <span className="text-neutral-500">{age}</span> : null}
              {p.gender ? (
                <Badge variant="outline" className="border-neutral-200 bg-neutral-50 text-neutral-600">
                  {GENDER_LABEL[p.gender]}
                </Badge>
              ) : null}
              {p.incomeLevel ? (
                <Badge variant="outline" className="border-neutral-200 bg-neutral-50 text-neutral-600">
                  Доход: {INCOME_LABEL[p.incomeLevel]}
                </Badge>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
