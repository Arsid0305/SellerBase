import { PageHeader } from '@/widgets/app-shell/page-header';
import { SeoExplorer } from '@/features/seo';
import { fetchSeoOverview } from '@/entities/seo';

export const metadata = { title: 'SEO карточек' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SeoPage() {
  const data = await fetchSeoOverview();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="SEO карточек"
        description="Проверка наименований, описаний и характеристик по регламенту — где горит и что чинить"
      />
      <SeoExplorer data={data} />
      <p className="text-muted-foreground text-xs">
        Проверка идёт по <code>v_sku_seo_issues</code>: правила в <code>seo_stop_words</code>, пороги
        в <code>app_settings</code>. Данные карточек — из <code>sku_catalog</code>, обновляются{' '}
        <code>fetch-wb-content</code>. Регламент — <code>docs/SEO_MARKETPLACES.md</code> §5, словарь
        с объяснениями — <code>docs/seo/stop-words.md</code>. Балла пока нет: без семантического ядра
        он мерил бы соблюдение формы, а не результат. В WB ничего не пишется, только чтение.
        Обновлено {data.generatedAt}.
      </p>
    </div>
  );
}
