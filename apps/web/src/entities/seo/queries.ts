import { createAdminClient } from '@/shared/lib/supabase/admin';
import { wbPhotoUrl } from '@/shared/lib/wb-photo';

/**
 * Проверка карточек по регламенту docs/SEO_MARKETPLACES.md §5.
 * Источник — view v_sku_seo_issues: правила лежат в seo_stop_words, пороги в app_settings.
 * Только чтение. В WB ничего не пишется.
 */

export type SeoRisk = 'R' | 'A' | 'G';

export type SeoIssue = {
  checkName: string;
  risk: SeoRisk;
  finding: string;
  detail: string;
  suggestion: string;
};

export type SeoSkuRow = {
  myArticle: string;
  wbArticle: number | null;
  subjectName: string | null;
  title: string | null;
  photoUrl: string | null;
  descLen: number;
  charCount: number;
  views30d: number;
  orders30d: number;
  cart30d: number;
  crCartPct: number | null;
  buyoutPct: number | null;
  crOrderPct: number | null;
  nRiskR: number;
  nRiskA: number;
  nMissingG: number;
  nTotal: number;
  issues: SeoIssue[];
};

export type SeoGroupRow = {
  subjectName: string;
  skuCount: number;
  cleanCount: number;
  withRiskR: number;
  issuesTotal: number;
};

export type SeoOverview = {
  skus: SeoSkuRow[];
  groups: SeoGroupRow[];
  totals: {
    skuCount: number;
    viewsAtRisk: number;
    cleanCount: number;
    withRiskR: number;
    withRiskA: number;
    issuesTotal: number;
    riskRTotal: number;
  };
  topFindings: { finding: string; risk: SeoRisk; count: number; detail: string }[];
  generatedAt: string;
};

const CHECK_TITLES: Record<string, string> = {
  stop_word_r: 'Стоп-слово, высокий риск',
  stop_word_a: 'Стоп-слово, средний риск',
  missing_key: 'Нет рабочего ключа группы',
  desc_length: 'Длина описания',
  lead_no_key: 'Первые знаки без ключа',
  characteristics_thin: 'Мало характеристик',
  characteristic_glued: 'Склейка значений',
};

export function checkTitle(checkName: string): string {
  return CHECK_TITLES[checkName] ?? checkName;
}

type IssueRow = {
  my_article: string;
  wb_article: number | null;
  subject_name: string | null;
  check_name: string;
  risk: string;
  finding: string;
  detail: string;
  suggestion: string;
};

type FunnelRow = {
  my_article: string | null;
  views_30d: number | null;
  orders_30d: number | null;
  cart_30d: number | null;
  cr_cart_pct: number | string | null;
  buyout_pct: number | string | null;
  cr_order_pct: number | string | null;
};

type CatalogRow = {
  my_article: string | null;
  wb_article: number | null;
  subject_name: string | null;
  title: string | null;
  photo_url: string | null;
  description: string | null;
  characteristics: unknown;
};

export async function fetchSeoOverview(): Promise<SeoOverview> {
  const supabase = createAdminClient();

  const [issuesRes, catalogRes, funnelRes] = await Promise.all([
    supabase
      .from('v_sku_seo_issues')
      .select('my_article, wb_article, subject_name, check_name, risk, finding, detail, suggestion')
      .range(0, 20_000),
    supabase
      .from('sku_catalog')
      .select(
        'my_article, wb_article, subject_name, title, photo_url, description, characteristics',
      )
      .range(0, 10_000),
    supabase
      .from('v_sku_seo_funnel_30d')
      .select('my_article, views_30d, orders_30d, cart_30d, cr_cart_pct, cr_order_pct, buyout_pct')
      .range(0, 10_000),
  ]);

  if (issuesRes.error) console.error('[fetchSeoOverview] v_sku_seo_issues', issuesRes.error);
  if (catalogRes.error) console.error('[fetchSeoOverview] sku_catalog', catalogRes.error);
  if (funnelRes.error) console.error('[fetchSeoOverview] v_sku_seo_funnel_30d', funnelRes.error);

  const issues = (issuesRes.data ?? []) as IssueRow[];
  const catalog = (catalogRes.data ?? []) as CatalogRow[];
  const funnel = new Map<string, FunnelRow>();
  for (const f of (funnelRes.data ?? []) as FunnelRow[]) {
    if (f.my_article) funnel.set(f.my_article, f);
  }
  const num = (v: number | string | null | undefined): number | null =>
    v == null ? null : typeof v === 'number' ? v : Number(v);

  const byArticle = new Map<string, SeoSkuRow>();

  for (const c of catalog) {
    if (!c.my_article) continue;
    const chars = Array.isArray(c.characteristics) ? c.characteristics.length : 0;
    byArticle.set(c.my_article, {
      myArticle: c.my_article,
      wbArticle: c.wb_article,
      subjectName: c.subject_name,
      title: c.title,
      photoUrl: c.photo_url ?? wbPhotoUrl(c.wb_article),
      descLen: c.description?.length ?? 0,
      charCount: chars,
      views30d: Number(funnel.get(c.my_article)?.views_30d ?? 0),
      orders30d: Number(funnel.get(c.my_article)?.orders_30d ?? 0),
      cart30d: Number(funnel.get(c.my_article)?.cart_30d ?? 0),
      crCartPct: num(funnel.get(c.my_article)?.cr_cart_pct),
      buyoutPct: num(funnel.get(c.my_article)?.buyout_pct),
      crOrderPct: num(funnel.get(c.my_article)?.cr_order_pct),
      nRiskR: 0,
      nRiskA: 0,
      nMissingG: 0,
      nTotal: 0,
      issues: [],
    });
  }

  const findingCounts = new Map<
    string,
    { finding: string; risk: SeoRisk; count: number; detail: string }
  >();

  for (const i of issues) {
    const row = byArticle.get(i.my_article);
    if (!row) continue;

    const risk = (i.risk === 'R' || i.risk === 'A' ? i.risk : 'G') as SeoRisk;
    row.issues.push({
      checkName: i.check_name,
      risk,
      finding: i.finding,
      detail: i.detail,
      suggestion: i.suggestion,
    });
    row.nTotal += 1;

    if (i.check_name === 'stop_word_r') row.nRiskR += 1;
    else if (i.check_name === 'stop_word_a') row.nRiskA += 1;
    else if (i.check_name === 'missing_key') row.nMissingG += 1;

    // топ повторяющихся находок — только стоп-слова и отсутствующие ключи
    if (
      i.check_name === 'stop_word_r' ||
      i.check_name === 'stop_word_a' ||
      i.check_name === 'missing_key'
    ) {
      const key = `${i.check_name}::${i.finding}`;
      const prev = findingCounts.get(key);
      if (prev) prev.count += 1;
      else findingCounts.set(key, { finding: i.finding, risk, count: 1, detail: i.detail });
    }
  }

  // Порядок: сначала высокий риск, внутри него — где больше просмотров.
  // Чинить надо там, где карточку видят, а не там, где просто больше замечаний.
  const skus = [...byArticle.values()].sort((a, b) => {
    if (b.nRiskR !== a.nRiskR) return b.nRiskR - a.nRiskR;
    if (b.views30d !== a.views30d) return b.views30d - a.views30d;
    if (b.nTotal !== a.nTotal) return b.nTotal - a.nTotal;
    return a.myArticle.localeCompare(b.myArticle);
  });

  // внутри карточки: сначала высокий риск, потом средний, потом остальное
  const RISK_ORDER: Record<SeoRisk, number> = { R: 0, A: 1, G: 2 };
  for (const s of skus) {
    s.issues.sort((x, y) => RISK_ORDER[x.risk] - RISK_ORDER[y.risk]);
  }

  const groupMap = new Map<string, SeoGroupRow>();
  for (const s of skus) {
    const name = s.subjectName ?? '— без предмета —';
    const g = groupMap.get(name) ?? {
      subjectName: name,
      skuCount: 0,
      cleanCount: 0,
      withRiskR: 0,
      issuesTotal: 0,
    };
    g.skuCount += 1;
    g.issuesTotal += s.nTotal;
    if (s.nTotal === 0) g.cleanCount += 1;
    if (s.nRiskR > 0) g.withRiskR += 1;
    groupMap.set(name, g);
  }

  const groups = [...groupMap.values()].sort((a, b) => {
    if (b.withRiskR !== a.withRiskR) return b.withRiskR - a.withRiskR;
    return b.issuesTotal - a.issuesTotal;
  });

  const topFindings = [...findingCounts.values()]
    .sort((a, b) => {
      if (a.risk !== b.risk) return RISK_ORDER[a.risk] - RISK_ORDER[b.risk];
      return b.count - a.count;
    })
    .slice(0, 12);

  return {
    skus,
    groups,
    totals: {
      skuCount: skus.length,
      // Просмотры, приходящиеся на карточки с высоким риском — цена бездействия.
      viewsAtRisk: skus.filter((s) => s.nRiskR > 0).reduce((acc, s) => acc + s.views30d, 0),
      cleanCount: skus.filter((s) => s.nTotal === 0).length,
      withRiskR: skus.filter((s) => s.nRiskR > 0).length,
      withRiskA: skus.filter((s) => s.nRiskA > 0).length,
      issuesTotal: skus.reduce((acc, s) => acc + s.nTotal, 0),
      riskRTotal: skus.reduce((acc, s) => acc + s.nRiskR, 0),
    },
    topFindings,
    generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
}

export type SeoSkuSummary = {
  myArticle: string;
  nRiskR: number;
  nRiskA: number;
  nMissingG: number;
  nTotal: number;
  issues: SeoIssue[];
};

/**
 * Проверка одной карточки — для блока внутри product-detail.
 * Отдельный запрос вместо fetchSeoOverview: тянуть весь каталог ради одной строки дорого.
 */
export async function fetchSkuSeoSummary(myArticle: string): Promise<SeoSkuSummary | null> {
  if (!myArticle) return null;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('v_sku_seo_issues')
    .select('my_article, check_name, risk, finding, detail, suggestion')
    .eq('my_article', myArticle);

  if (error) {
    console.error('[fetchSkuSeoSummary] v_sku_seo_issues', error);
    return null;
  }

  const rows = (data ?? []) as IssueRow[];
  const summary: SeoSkuSummary = {
    myArticle,
    nRiskR: 0,
    nRiskA: 0,
    nMissingG: 0,
    nTotal: rows.length,
    issues: [],
  };

  for (const r of rows) {
    const risk = (r.risk === 'R' || r.risk === 'A' ? r.risk : 'G') as SeoRisk;
    summary.issues.push({
      checkName: r.check_name,
      risk,
      finding: r.finding,
      detail: r.detail,
      suggestion: r.suggestion,
    });
    if (r.check_name === 'stop_word_r') summary.nRiskR += 1;
    else if (r.check_name === 'stop_word_a') summary.nRiskA += 1;
    else if (r.check_name === 'missing_key') summary.nMissingG += 1;
  }

  const order: Record<SeoRisk, number> = { R: 0, A: 1, G: 2 };
  summary.issues.sort((a, b) => order[a.risk] - order[b.risk]);

  return summary;
}
