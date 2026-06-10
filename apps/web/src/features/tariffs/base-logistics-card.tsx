import { CategoryCard } from '@/shared/ui/domain/category-card';
import { formatDate } from '@/shared/lib/format';
import { mockBaseLogistics } from './mock-data';

export function BaseLogisticsCard() {
  const t = mockBaseLogistics;

  return (
    <CategoryCard title="Базовые тарифы логистики Wildberries" tone="neutral">
      <div className="flex flex-col gap-6">
        <section>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Стоимость логистики до покупателя
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="mb-1.5 text-sm font-medium">Товар больше 1 л</div>
              <div className="text-xs leading-relaxed text-muted-foreground">
                (<span className="font-mono tabular-nums text-foreground">{t.bigItemBaseRate} ₽</span> за 1 л + <span className="font-mono tabular-nums text-foreground">{t.bigItemAdditionalRate} ₽</span> за каждый доп. л) × Коэф.склада × ИЛ × Цена×ИРП × дни заказа
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="mb-1.5 text-sm font-medium">Товар меньше 1 л</div>
              <div className="text-xs leading-relaxed text-muted-foreground">
                Объём × Тариф/л × Коэф.склада × ИЛ × Цена×ИРП × дни заказа
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Тарифы по объёму (для товаров меньше 1 л)
          </div>
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Объём, л</th>
                  <th className="px-3 py-2 text-right font-medium">Ставка</th>
                </tr>
              </thead>
              <tbody>
                {t.volumeBuckets.map((b) => (
                  <tr key={`${b.fromLitres}-${b.toLitres}`} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2">
                      от {b.fromLitres.toFixed(3)} до {b.toLitres.toFixed(3)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{b.ratePerLitre} ₽ / л</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Обратная логистика
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Тариф фиксируется в момент создания поставки на{' '}
            <span className="font-mono tabular-nums text-foreground">{t.reverseLogisticsFreezeDaysMin}</span> или{' '}
            <span className="font-mono tabular-nums text-foreground">{t.reverseLogisticsFreezeDaysMax}</span>{' '}
            дней в зависимости от категории. Для товаров &gt;1 л — те же {t.bigItemBaseRate} ₽ за 1-й литр + {t.bigItemAdditionalRate} ₽ за
            каждый доп., для &lt;1 л — по той же таблице объёмов.
          </p>
        </section>

        <div className="text-[10px] text-muted-foreground">
          Тарифы обновлены: {formatDate(t.updatedAt)}
        </div>
      </div>
    </CategoryCard>
  );
}
