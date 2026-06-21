import { createAdminClient } from '@/shared/lib/supabase/admin';
import { wbPhotoUrl } from '@/shared/lib/wb-photo';

export type DataQualityIssueSku = {
  skuId: number;
  myArticle: string | null;
  wbArticle: number | null;
  title: string | null;
  photoUrl: string | null;
  barcode: string | null;
  detail?: string;
};

export type DataQualityCheck = {
  key: string;
  title: string;
  description: string;
  count: number;
  severity: 'ok' | 'amber' | 'rose';
  items: DataQualityIssueSku[];
};

export type CronCheck = {
  jobName: string;
  lastSuccessAt: string | null;
  hoursAgo: number | null;
  stale: boolean;
};

export type ChannelGap = {
  channel: string;
  daysWithoutSales: number;
  lastSaleDate: string | null;
};

export type DataQualityReport = {
  checks: DataQualityCheck[];
  cron: CronCheck[];
  channelGaps: ChannelGap[];
  generatedAt: string;
};

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type CatalogRow = {
  id: number;
  my_article: string | null;
  wb_article: number | null;
  barcode: string | null;
  title: string | null;
  photo_url: string | null;
  subject_name: string | null;
  is_active: boolean | null;
  cost_price_rub: number | null;
};

function toIssue(c: CatalogRow, detail?: string): DataQualityIssueSku {
  return {
    skuId: c.id,
    myArticle: c.my_article,
    wbArticle: c.wb_article,
    title: c.title,
    photoUrl: c.photo_url ?? wbPhotoUrl(c.wb_article),
    barcode: c.barcode,
    detail,
  };
}

export async function fetchDataQuality(): Promise<DataQualityReport> {
  const supabase = createAdminClient();
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const since30 = iso(new Date(todayUtc.getTime() - 30 * 86_400_000));
  const todayIso = iso(todayUtc);

  const [catalogRes, salesFactRes, stocksRes, cronRes, channelGapsRes] =
    await Promise.all([
      supabase
        .from('sku_catalog')
        .select(
          'id, my_article, wb_article, barcode, title, photo_url, subject_name, is_active, cost_price_rub',
        )
        .range(0, 10_000),
      // Заменено: было .from('wb_reports_fact').select('nm_id,rr_dt,quantity').range(0,200_000) — 200к строк в RSC.
      // Теперь агрегация в БД через RPC get_sku_reports_aggregate (создана 2026-06-19).
      supabase.rpc('get_sku_reports_aggregate', { p_from: since30, p_to: todayIso }),
      supabase.from('wb_stocks').select('nm_id, quantity').range(0, 50_000),
      supabase
        .from('ingestion_log')
        .select('job_name, started_at, finished_at, status')
        .eq('status', 'ok')
        .order('started_at', { ascending: false })
        .range(0, 2000),
      // Заменено: было два .range(0, 200_000)/50_000 на wb_sales_fact.sale_dt и wb_reports_fact.rr_dt.
      // Теперь один RPC возвращает distinct даты по обоим каналам — ≤60 строк вместо до 250k.
      supabase.rpc('get_channel_gap_dates', { p_since: since30 }),
    ]);

  if (catalogRes.error) console.error('[fetchDataQuality] catalog', catalogRes.error);
  if (salesFactRes.error) console.error('[fetchDataQuality] wb_reports_fact', salesFactRes.error);
  if (stocksRes.error) console.error('[fetchDataQuality] wb_stocks', stocksRes.error);
  if (cronRes.error && cronRes.error.code !== '42P01') {
    console.error('[fetchDataQuality] ingestion_log', cronRes.error);
  }
  if (channelGapsRes.error) console.error('[fetchDataQuality] channel_gap_dates', channelGapsRes.error);

  const catalog = (catalogRes.data ?? []) as CatalogRow[];

  // активные продажи/остаток за 30д по nm_id (агрегат из RPC get_sku_reports_aggregate).
  const unitsLast30ByNm = new Map<number, number>();
  for (const r of (salesFactRes.data ?? []) as { nm_id: number | null; units_sold: number | null }[]) {
    if (r.nm_id == null) continue;
    unitsLast30ByNm.set(r.nm_id, (unitsLast30ByNm.get(r.nm_id) ?? 0) + toNumber(r.units_sold));
  }
  const stockByNm = new Map<number, number>();
  for (const s of (stocksRes.data ?? []) as { nm_id: number | null; quantity: number | null }[]) {
    if (s.nm_id == null) continue;
    stockByNm.set(s.nm_id, (stockByNm.get(s.nm_id) ?? 0) + toNumber(s.quantity));
  }

  function isActiveSku(c: CatalogRow): boolean {
    const stock = c.wb_article != null ? stockByNm.get(c.wb_article) ?? 0 : 0;
    const units = c.wb_article != null ? unitsLast30ByNm.get(c.wb_article) ?? 0 : 0;
    return stock > 0 || units > 0;
  }

  const activeSkus = catalog.filter(isActiveSku);

  // 1. SKU без себестоимости (активные)
  const noCost = activeSkus.filter((c) => c.cost_price_rub == null || toNumber(c.cost_price_rub) === 0);

  // 2. SKU без штрихкода
  const noBarcode = catalog.filter((c) => !c.barcode || c.barcode.trim() === '');

  // 3. SKU без my_article
  const noMyArticle = catalog.filter((c) => !c.my_article || c.my_article.trim() === '');

  // 4. SKU без настоящего фото
  const noPhoto = catalog.filter((c) => !c.photo_url || c.photo_url.trim() === '');

  // 6. Дублирующиеся штрихкоды (на разных sku_id)
  const byBarcode = new Map<string, CatalogRow[]>();
  for (const c of catalog) {
    if (!c.barcode || c.barcode.trim() === '') continue;
    const list = byBarcode.get(c.barcode) ?? [];
    list.push(c);
    byBarcode.set(c.barcode, list);
  }
  const dupBarcodeGroups = [...byBarcode.values()].filter((list) => list.length > 1);
  const dupBarcodeSkus = dupBarcodeGroups.flat();

  // 7. Категории не заполнены
  const noCategory = catalog.filter((c) => !c.subject_name || c.subject_name.trim() === '');

  // 8. ARCHIVED, но остаток > 0
  const archivedWithStock = catalog.filter((c) => {
    if (c.is_active !== false) return false;
    const stock = c.wb_article != null ? stockByNm.get(c.wb_article) ?? 0 : 0;
    return stock > 0;
  });

  // 5. Продажи без sku_id — nm_id в wb_reports_fact, не матчится ни с одним sku_catalog.wb_article
  const knownNm = new Set(catalog.map((c) => c.wb_article).filter((v): v is number => v != null));
  const orphanNmSet = new Set<number>();
  for (const nm of unitsLast30ByNm.keys()) {
    if (!knownNm.has(nm)) orphanNmSet.add(nm);
  }
  const orphanSalesItems: DataQualityIssueSku[] = [...orphanNmSet].slice(0, 50).map((nm) => ({
    skuId: nm,
    myArticle: null,
    wbArticle: nm,
    title: `nm_id ${nm}`,
    photoUrl: wbPhotoUrl(nm),
    barcode: null,
    detail: `${unitsLast30ByNm.get(nm) ?? 0} шт. за 30д без сопоставления`,
  }));

  function makeCheck(
    key: string,
    title: string,
    description: string,
    rows: CatalogRow[],
    severity: 'amber' | 'rose',
    limit = 10,
    detailFn?: (c: CatalogRow) => string | undefined,
  ): DataQualityCheck {
    return {
      key,
      title,
      description,
      count: rows.length,
      severity: rows.length === 0 ? 'ok' : severity,
      items: rows.slice(0, limit).map((c) => toIssue(c, detailFn?.(c))),
    };
  }

  const checks: DataQualityCheck[] = [
    makeCheck(
      'no_cost',
      'SKU без себестоимости',
      'Активные товары (есть продажи за 30 дней или остаток > 0), у которых не указана себестоимость в каталоге. Без неё неверно считается маржа и P&L.',
      noCost,
      'rose',
    ),
    makeCheck(
      'no_barcode',
      'SKU без штрихкода',
      'Товары в каталоге без штрихкода — мешает сопоставлению с остатками и продажами по складу.',
      noBarcode,
      'amber',
    ),
    makeCheck(
      'no_my_article',
      'SKU без своего артикула',
      'Товары без my_article — внутреннего кода продавца. Усложняет учёт себестоимости и поставок.',
      noMyArticle,
      'amber',
    ),
    makeCheck(
      'no_photo',
      'SKU без фото',
      'Товары без настоящего фото в каталоге (photo_url пуст). Резервное фото с WB по артикулу — не подтверждённое.',
      noPhoto,
      'amber',
    ),
    {
      key: 'orphan_sales',
      title: 'Продажи без sku_id',
      description:
        'Артикулы WB (nm_id) из отчёта по продажам за 30 дней, которых нет в каталоге sku_catalog.wb_article. Продажи есть, но они не привязаны к товару.',
      count: orphanNmSet.size,
      severity: orphanNmSet.size === 0 ? 'ok' : 'rose',
      items: orphanSalesItems,
    },
    makeCheck(
      'dup_barcode',
      'Дублирующиеся штрихкоды',
      'Один и тот же штрихкод используется у нескольких разных SKU — нарушает однозначное сопоставление остатков и продаж.',
      dupBarcodeSkus,
      'rose',
      10,
      (c) => `barcode ${c.barcode}`,
    ),
    makeCheck(
      'no_category',
      'Категория не заполнена',
      'У товара не указана категория (subject_name) — нужна для аналитики по категориям и сравнения комиссий.',
      noCategory,
      'amber',
    ),
    makeCheck(
      'archived_with_stock',
      'Архив, но остаток > 0',
      'Товар выведен из оборота (is_active = false), но на складе остался физический остаток — нужно списать или вернуть в продажу.',
      archivedWithStock,
      'rose',
    ),
  ];

  // 9. Просроченные cron (последний успешный запуск > 24ч)
  let cron: CronCheck[] = [];
  if (!cronRes.error) {
    const lastSuccessByJob = new Map<string, string>();
    for (const r of (cronRes.data ?? []) as { job_name: string; started_at: string }[]) {
      if (!lastSuccessByJob.has(r.job_name)) lastSuccessByJob.set(r.job_name, r.started_at);
    }
    const nowMs = Date.now();
    cron = [...lastSuccessByJob.entries()].map(([jobName, lastSuccessAt]) => {
      const hoursAgo = (nowMs - new Date(lastSuccessAt).getTime()) / 3_600_000;
      return {
        jobName,
        lastSuccessAt,
        hoursAgo: Math.round(hoursAgo * 10) / 10,
        stale: hoursAgo > 24,
      };
    });
    cron.sort((a, b) => (b.hoursAgo ?? 0) - (a.hoursAgo ?? 0));
  }

  // 10. Дни без продаж по каналам — distinct даты приходят одним RPC.
  const wbSalesDates = new Set<string>();
  const wbReportsDates = new Set<string>();
  for (const r of (channelGapsRes.data ?? []) as { source: string; dt: string }[]) {
    if (r.source === 'wb_sales') wbSalesDates.add(r.dt);
    else if (r.source === 'wb_reports') wbReportsDates.add(r.dt);
  }

  function daysWithoutSales(dates: Set<string>): { days: number; lastDate: string | null } {
    let lastDate: string | null = null;
    let days = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(todayUtc.getTime() - i * 86_400_000);
      const dIso = iso(d);
      if (dates.has(dIso)) {
        lastDate = dIso;
        break;
      }
      days += 1;
    }
    if (lastDate == null && dates.size === 0) days = 30;
    return { days, lastDate };
  }

  const wbReports = daysWithoutSales(wbReportsDates);
  const wbSales = daysWithoutSales(wbSalesDates);

  const channelGaps: ChannelGap[] = [
    {
      channel: 'WB — финотчёт (wb_reports_fact)',
      daysWithoutSales: wbReports.days,
      lastSaleDate: wbReports.lastDate,
    },
    {
      channel: 'WB — ежедневные продажи (wb_sales_fact)',
      daysWithoutSales: wbSales.days,
      lastSaleDate: wbSales.lastDate,
    },
  ];

  return {
    checks,
    cron,
    channelGaps,
    generatedAt: todayIso,
  };
}
