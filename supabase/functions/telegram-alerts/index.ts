// telegram-alerts — ежедневная проверка ключевых метрик и алерт владелице в Telegram.
// Запускается раз в день кроном.
// 11 проверок параллельно: маржа, выкуп, дефицит, простой cron-задач, новые SKU без cost,
// акции ВБ заканчивающиеся завтра, обнулившийся остаток активных SKU, упавший рейтинг,
// устаревшие тарифы ВБ-комиссии, критические аномалии из sku_events (детектор),
// удержания и штрафы за неделю (реклама, платные отзывы, транзит).
// Если все проверки зелёные — ничего не отправляет (не спамим «всё ок»).
// verify_jwt = false (вызывается из pg_cron).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const BASE_URL = "https://seller-base.vercel.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

interface CheckResult {
  name: string;
  ok: boolean;
  // green   = всё в норме / улучшение
  // yellow  = внимание / нейтрально
  // orange  = на грани / стоит посмотреть
  // red     = критично, действовать срочно
  severity: "red" | "orange" | "yellow" | "green";
  // Краткая строка для ежедневной сводки: «🟢 Маржа стабильна: 18.6%»
  summary: string;
  // Подробный markdown-блок (только когда severity=red/orange, иначе null)
  message: string | null;
}

function emoji(s: CheckResult["severity"]): string {
  return s === "red" ? "🔴" : s === "orange" ? "🟠" : s === "yellow" ? "🟡" : "🟢";
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function fmtPp(n: number): string {
  // Процентные пункты (разница абсолютных %), а не относительный %. Пишем «п.п.» явно,
  // чтобы не путать (запрос владелицы 2026-06-27).
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)} п.п.`;
}

// Для маржи: чистая абсолютная разница без «%» — «было 4.1% → стало 5.2%».
function fmtMarginChange(prev: number, cur: number): string {
  return `было ${prev.toFixed(1)}% → стало ${cur.toFixed(1)}%`;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ============================================================
// 1. Маржа упала >5pp за последние 7д vs предыдущие 7д
// ============================================================
async function checkMargin(supabase: SupabaseClient): Promise<CheckResult> {
  // WB Report API лагает 1-2 дня (последние дни приходят неполные).
  // Поэтому окна сдвинуты на 2 дня назад: сравниваем [today-9, today-2] vs [today-16, today-9].
  // Иначе текущее окно включает 2 полупустых дня → искусственное «падение» маржи.
  const today = new Date();
  const LAG_DAYS = 2;
  const d0 = dateStr(new Date(today.getTime() - LAG_DAYS * 86_400_000));
  const d7 = dateStr(new Date(today.getTime() - (LAG_DAYS + 7) * 86_400_000));
  const d14 = dateStr(new Date(today.getTime() - (LAG_DAYS + 14) * 86_400_000));

  const [{ data: curRows, error: curErr }, { data: prevRows, error: prevErr }] = await Promise.all([
    supabase.rpc("get_full_pnl_by_period", { p_from: d7, p_to: d0 }),
    supabase.rpc("get_full_pnl_by_period", { p_from: d14, p_to: d7 }),
  ]);
  if (curErr || prevErr) {
    return {
      name: "margin",
      ok: false,
      severity: "yellow",
      summary: "Маржа: не удалось посчитать",
      message: `🟡 *Маржа* — не удалось посчитать (${curErr?.message ?? prevErr?.message})`,
    };
  }

  const totalMargin = (rows: { revenue_rub: number; net_profit_rub: number }[] | null) => {
    const rev = (rows ?? []).reduce((s, r) => s + Number(r.revenue_rub ?? 0), 0);
    const profit = (rows ?? []).reduce((s, r) => s + Number(r.net_profit_rub ?? 0), 0);
    return rev > 0 ? (profit / rev) * 100 : null;
  };

  const curMargin = totalMargin(curRows);
  const prevMargin = totalMargin(prevRows);
  if (curMargin == null || prevMargin == null) {
    return { name: "margin", ok: true, severity: "yellow", summary: "Маржа: нет данных за период", message: null };
  }

  const totalRevenue = (rows: { revenue_rub: number }[] | null) =>
    (rows ?? []).reduce((s, r) => s + Number(r.revenue_rub ?? 0), 0);
  const totalProfit = (rows: { net_profit_rub: number }[] | null) =>
    (rows ?? []).reduce((s, r) => s + Number(r.net_profit_rub ?? 0), 0);
  const curRevenue = totalRevenue(curRows);
  const prevRevenue = totalRevenue(prevRows);
  const curProfit = totalProfit(curRows);
  const prevProfit = totalProfit(prevRows);

  const deltaPp = curMargin - prevMargin;
  // Порог -15pp (не -5pp): при просадке выручки за неделю полуфиксированные расходы
  // (storage, логистика) сами по себе сжимают маржу на 5-10pp — обычная операционная
  // левередж-чувствительность тонкой маржи (10-20%), не аномалия. Разбор 2026-06-19:
  // delta -9.6pp при падении выручки -27.7% (63111₽ vs 87297₽) — не баг RPC.
  if (deltaPp < -15) {
    // топ-3 SKU где маржа упала больше всего
    const prevBySku = new Map<string, { margin: number; revenue: number }>();
    for (const r of (prevRows ?? []) as Array<{ my_article: string; margin_pct: number | null; revenue_rub: number }>) {
      // margin_pct RPC отдаёт уже в процентах (27.82 = 27.82%), умножать не нужно.
      if (r.margin_pct != null) prevBySku.set(r.my_article, { margin: Number(r.margin_pct), revenue: Number(r.revenue_rub) });
    }
    const drops: { article: string; deltaPp: number }[] = [];
    for (const r of (curRows ?? []) as Array<{ my_article: string; margin_pct: number | null; revenue_rub: number }>) {
      if (r.margin_pct == null) continue;
      const prev = prevBySku.get(r.my_article);
      if (!prev || prev.revenue <= 0) continue;
      // И в текущем окне должны быть продажи. Иначе в «топ-3 где маржа упала»
      // попадают SKU, которые просто не продавались: у них margin_pct = 0, и разница
      // с прошлой неделей читается как обвал маржи. Разбор 2026-09-02: все три SKU
      // в сводке имели revenue = 0 и 0 проданных штук.
      if (Number(r.revenue_rub) <= 0) continue;
      const curPct = Number(r.margin_pct);
      drops.push({ article: r.my_article, deltaPp: curPct - prev.margin });
    }
    drops.sort((a, b) => a.deltaPp - b.deltaPp);
    const top3 = drops.slice(0, 3);
    const top3Str = top3.length > 0
      ? top3.map((d) => `${d.article} (${fmtPp(d.deltaPp)})`).join(", ")
      : "нет данных по отдельным SKU";

    return {
      name: "margin",
      ok: false,
      severity: "red",
      summary: `Маржа упала: ${fmtMarginChange(prevMargin, curMargin)}`,
      message:
        `🔴 *Маржа упала на ${fmtPp(deltaPp)}*\n` +
        `За 7д: ${fmtMarginChange(prevMargin, curMargin)}\n` +
        `Выручка: ${Math.round(prevRevenue).toLocaleString("ru-RU")}₽ → ${Math.round(curRevenue).toLocaleString("ru-RU")}₽\n` +
        `Прибыль: ${Math.round(prevProfit).toLocaleString("ru-RU")}₽ → ${Math.round(curProfit).toLocaleString("ru-RU")}₽\n` +
        `Топ-3 SKU где маржа упала: ${top3Str}\n` +
        `→ Открыть ${BASE_URL}/margin-analyzer`,
    };
  }

  if (deltaPp <= -10) {
    return {
      name: "margin",
      ok: true,
      severity: "orange",
      summary: `Маржа: ${fmtMarginChange(prevMargin, curMargin)} — внимание`,
      message:
        `🟠 *Маржа снизилась на ${fmtPp(deltaPp)}*\n` +
        `За 7д: ${fmtMarginChange(prevMargin, curMargin)}\n` +
        `→ Открыть ${BASE_URL}/margin-analyzer`,
    };
  }

  if (deltaPp <= -1) {
    return {
      name: "margin",
      ok: true,
      severity: "yellow",
      summary: `Маржа: ${fmtMarginChange(prevMargin, curMargin)}`,
      message: null,
    };
  }

  if (deltaPp > 1) {
    return {
      name: "margin",
      ok: true,
      severity: "green",
      summary: `Маржа выросла: ${fmtMarginChange(prevMargin, curMargin)}`,
      message: null,
    };
  }

  return { name: "margin", ok: true, severity: "green", summary: `Маржа стабильна: ${curMargin.toFixed(1)}%`, message: null };
}

// ============================================================
// 2. Выкуп упал >10pp за последние 7д vs предыдущие 7д
//    Выкуп = доля проданных (quantity>0) среди всех движений (продажи+возвраты).
// ============================================================
async function checkBuyout(supabase: SupabaseClient): Promise<CheckResult> {
  // Окна со сдвигом 2д назад — тот же фикс что в checkMargin, WB Report лагает.
  const today = new Date();
  const LAG_DAYS = 2;
  const d0 = dateStr(new Date(today.getTime() - LAG_DAYS * 86_400_000));
  const d7 = dateStr(new Date(today.getTime() - (LAG_DAYS + 7) * 86_400_000));
  const d14 = dateStr(new Date(today.getTime() - (LAG_DAYS + 14) * 86_400_000));

  const buyoutRate = async (from: string, to: string): Promise<number | null> => {
    const { data, error } = await supabase
      .from("wb_reports_fact")
      .select("quantity")
      .eq("doc_type_name", "Продажа")
      .gte("sale_dt", from)
      .lte("sale_dt", to);
    if (error || !data) return null;
    let sold = 0;
    let returned = 0;
    for (const r of data as Array<{ quantity: number | null }>) {
      const q = Number(r.quantity ?? 0);
      if (q > 0) sold += q;
      else if (q < 0) returned += -q;
    }
    const total = sold + returned;
    return total > 0 ? (sold / total) * 100 : null;
  };

  const [curRate, prevRate] = await Promise.all([
    buyoutRate(d7, d0),
    buyoutRate(d14, d7),
  ]);

  if (curRate == null || prevRate == null) {
    return { name: "buyout", ok: true, severity: "yellow", summary: "Выкуп: нет данных за период", message: null };
  }

  const deltaPp = curRate - prevRate;
  if (deltaPp < -10) {
    return {
      name: "buyout",
      ok: false,
      severity: "red",
      summary: `Выкуп упал: ${curRate.toFixed(1)}% (Δ ${fmtPp(deltaPp)})`,
      message:
        `🔴 *Выкуп упал на ${fmtPp(deltaPp)}*\n` +
        `За 7д: ${curRate.toFixed(1)}% vs предыдущие 7д: ${prevRate.toFixed(1)}%\n` +
        `→ Открыть ${BASE_URL}/deficit`,
    };
  }

  if (deltaPp <= -5) {
    return {
      name: "buyout",
      ok: true,
      severity: "orange",
      summary: `Выкуп: ${curRate.toFixed(1)}% (Δ ${fmtPp(deltaPp)}) — внимание`,
      message:
        `🟠 *Выкуп снизился на ${fmtPp(deltaPp)}*\n` +
        `За 7д: ${curRate.toFixed(1)}% vs предыдущие 7д: ${prevRate.toFixed(1)}%\n` +
        `→ Открыть ${BASE_URL}/deficit`,
    };
  }

  if (deltaPp <= -1) {
    return {
      name: "buyout",
      ok: true,
      severity: "yellow",
      summary: `Выкуп: ${curRate.toFixed(1)}% (Δ ${fmtPp(deltaPp)})`,
      message: null,
    };
  }

  if (deltaPp > 1) {
    return {
      name: "buyout",
      ok: true,
      severity: "green",
      summary: `Выкуп улучшился: ${fmtPp(deltaPp)} (${curRate.toFixed(1)}%)`,
      message: null,
    };
  }

  return { name: "buyout", ok: true, severity: "green", summary: `Выкуп стабилен: ${curRate.toFixed(1)}%`, message: null };
}

// ============================================================
// 3. SKU в дефиците — daysOfStock < 7 для топ-20 SKU по выручке
// ============================================================
async function checkDeficit(supabase: SupabaseClient): Promise<CheckResult> {
  const today = new Date();
  const d0 = dateStr(today);
  const d30 = dateStr(new Date(today.getTime() - 30 * 86_400_000));

  const [{ data: pnlRows, error: pnlErr }, { data: turnoverRows, error: turErr }, { data: skus, error: skuErr }] =
    await Promise.all([
      supabase.rpc("get_full_pnl_by_period", { p_from: d30, p_to: d0 }),
      supabase.from("v_turnover_by_sku").select("nm_id, stock_qty, turnover_days"),
      supabase.from("sku_catalog").select("id, my_article, wb_article"),
    ]);
  if (pnlErr || turErr || skuErr) {
    return {
      name: "deficit",
      ok: false,
      severity: "yellow",
      summary: "Дефицит: не удалось посчитать",
      message: `🟡 *Дефицит* — не удалось посчитать (${pnlErr?.message ?? turErr?.message ?? skuErr?.message})`,
    };
  }

  const top20 = ((pnlRows ?? []) as Array<{ sku_id: number; my_article: string; wb_article: number; revenue_rub: number }>)
    .slice()
    .sort((a, b) => Number(b.revenue_rub) - Number(a.revenue_rub))
    .slice(0, 20);

  const turnoverByNm = new Map<number, { stock_qty: number; turnover_days: number | null }>();
  for (const r of (turnoverRows ?? []) as Array<{ nm_id: number; stock_qty: number; turnover_days: number | null }>) {
    turnoverByNm.set(r.nm_id, { stock_qty: r.stock_qty, turnover_days: r.turnover_days });
  }

  const deficits: { article: string; daysOfStock: number }[] = [];
  for (const sku of top20) {
    const t = turnoverByNm.get(sku.wb_article);
    if (!t) continue;
    // turnover_days == null означает либо нет продаж (сток лежит мёртвым грузом — не дефицит),
    // либо нет стока вообще (stock_qty === 0) — это и есть дефицит.
    if (t.stock_qty === 0) {
      deficits.push({ article: sku.my_article, daysOfStock: 0 });
    } else if (t.turnover_days != null && t.turnover_days < 7) {
      deficits.push({ article: sku.my_article, daysOfStock: t.turnover_days });
    }
  }

  if (deficits.length === 0) {
    return { name: "deficit", ok: true, severity: "green", summary: "Дефицит: 0 SKU из топ-20", message: null };
  }

  deficits.sort((a, b) => a.daysOfStock - b.daysOfStock);
  const listStr = deficits
    .slice(0, 10)
    .map((d) => `${d.article} (${d.daysOfStock.toFixed(0)}д)`)
    .join(", ");

  const severity: CheckResult["severity"] = deficits.length >= 4 ? "red" : "orange";
  const summary = `Дефицит: ${deficits.length} SKU из топ-20`;

  return {
    name: "deficit",
    ok: false,
    severity,
    summary,
    message:
      `${emoji(severity)} *Дефицит стока: ${deficits.length} SKU из топ-20 по выручке*\n` +
      `${listStr}\n` +
      `→ Открыть ${BASE_URL}/deficit`,
  };
}

// ============================================================
// 4. Здоровье cron-задач: провисшие + падающие с ошибкой
// ============================================================
// Читаем v_job_health, а не сырой ingestion_log.
//
// Было: `.limit(500)` по ingestion_log с сортировкой по дате. Продажи и заказы
// идут каждые 30 минут, поэтому 500 строк покрывали меньше двух суток —
// недельная fetch-wb-commissions в окно не попадала, и бот докладывал
// «нет успешных запусков» о задаче, отработавшей 5 дней назад. При этом
// соседняя проверка в том же сообщении писала «комиссии обновлены 5 дней назад».
// v_job_health агрегирует всю таблицу, усечения нет.
//
// Второе: раньше смотрели только на дату последнего успеха. Задачи, которые
// раньше работали, а теперь падают каждый день, проверку проходили молча —
// так поставки падали 32 раза за неделю, и бот об этом не сказал.
// Теперь есть отдельная строка про последний запуск с ошибкой.
//
// Мониторим только задачи с ВКЛЮЧЁННЫМ кроном. Выключенные намеренно
// (fetch-wb-ads, fetch-wb-supplies) не должны напоминать о себе каждый день.
async function checkCronHealth(supabase: SupabaseClient): Promise<CheckResult> {
  // Порог свежести на задачу. Считается от расписания её крона плюс слабина.
  const MONITORED: { job: string; staleHours: number }[] = [
    { job: "fetch-wb-sales", staleHours: 2 },              // cron 30 мин
    { job: "fetch-wb-orders", staleHours: 2 },             // cron 30 мин
    { job: "detect-anomalies", staleHours: 3 },            // ежечасно
    { job: "fetch-wb-funnel", staleHours: 30 },            // ежедневно
    { job: "fetch-wb-funnel-aggregate", staleHours: 30 },  // ежедневно
    { job: "fetch-wb-tariffs", staleHours: 30 },           // ежедневно
    { job: "fetch-wb-stocks", staleHours: 30 },            // ежедневно
    { job: "fetch-wb-goods-returns", staleHours: 30 },     // ежедневно
    { job: "fetch-wb-prices", staleHours: 30 },            // ежедневно
    { job: "fetch-wb-feedback", staleHours: 30 },          // ежедневно
    { job: "fetch-wb-content", staleHours: 24 * 9 },       // еженедельно, вт
    { job: "fetch-wb-report", staleHours: 24 * 9 },        // еженедельно, вт
    { job: "fetch-wb-commissions", staleHours: 24 * 9 },   // еженедельно, пн
  ];

  const { data, error } = await supabase
    .from("v_job_health")
    .select("job_name, last_run_at, last_success_at, last_status, errors_24h");
  if (error) {
    return {
      name: "cron",
      ok: false,
      severity: "yellow",
      summary: "Cron: не удалось проверить",
      message: `🟡 *Cron* — не удалось прочитать v_job_health (${error.message})`,
    };
  }

  type HealthRow = {
    job_name: string;
    last_run_at: string | null;
    last_success_at: string | null;
    last_status: string | null;
    errors_24h: number | null;
  };
  const health = new Map<string, HealthRow>();
  for (const r of (data ?? []) as HealthRow[]) health.set(r.job_name, r);

  const now = Date.now();
  const stale: string[] = [];   // давно не было успеха
  const failing: string[] = []; // последний запуск упал

  for (const m of MONITORED) {
    const h = health.get(m.job);

    if (!h || !h.last_success_at) {
      stale.push(`${m.job} (успешных запусков не было)`);
      continue;
    }

    const hoursAgo = (now - new Date(h.last_success_at).getTime()) / 3_600_000;
    if (hoursAgo > m.staleHours) {
      stale.push(`${m.job} (успех ${hoursAgo.toFixed(0)}ч назад)`);
    }

    // Падает сейчас, даже если недавний успех ещё в пределах порога.
    if (h.last_status === "error") {
      const n = h.errors_24h ?? 0;
      failing.push(`${m.job}${n > 1 ? ` (${n} ошибок за сутки)` : ""}`);
    }
  }

  if (stale.length === 0 && failing.length === 0) {
    return {
      name: "cron",
      ok: true,
      severity: "green",
      summary: `Все ${MONITORED.length} cron работают`,
      message: null,
    };
  }

  const total = stale.length + failing.length;
  const severity: CheckResult["severity"] = total >= 3 ? "red" : "orange";

  const parts: string[] = [];
  if (failing.length > 0) parts.push(`падают с ошибкой: ${failing.join(", ")}`);
  if (stale.length > 0) parts.push(`нет свежего успеха: ${stale.join(", ")}`);

  return {
    name: "cron",
    ok: false,
    severity,
    summary: `Cron: проблем ${total}`,
    message:
      `${emoji(severity)} *Cron: проблем ${total}*\n` +
      `${parts.join("\n")}\n` +
      `→ Открыть ${BASE_URL}/data-quality`,
  };
}

// ============================================================
// 5. Новые SKU без cost — добавлены за последние 7д, cost_price_rub IS NULL/0
// ============================================================
async function checkNewSkuNoCost(supabase: SupabaseClient): Promise<CheckResult> {
  const d7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("sku_catalog")
    .select("my_article, cost_price_rub, created_at")
    .gte("created_at", d7);
  if (error) {
    return {
      name: "new_sku_no_cost",
      ok: false,
      severity: "yellow",
      summary: "Новых SKU без cost: не удалось проверить",
      message: `🟡 *Новые SKU* — не удалось проверить (${error.message})`,
    };
  }

  const noCost = (data ?? []).filter(
    (r: { cost_price_rub: number | null }) => r.cost_price_rub == null || Number(r.cost_price_rub) === 0,
  ) as Array<{ my_article: string }>;

  if (noCost.length === 0) {
    return { name: "new_sku_no_cost", ok: true, severity: "green", summary: "Новых SKU без cost: 0", message: null };
  }

  const listStr = noCost.slice(0, 15).map((r) => r.my_article).join(", ");

  return {
    name: "new_sku_no_cost",
    ok: false,
    severity: "yellow",
    summary: `Новых SKU без cost: ${noCost.length}`,
    message:
      `🟡 *${noCost.length} новых SKU без себестоимости*\n` +
      `${listStr}\n` +
      `→ Открыть ${BASE_URL}/data-quality`,
  };
}

// ============================================================
// 6. Акция ВБ заканчивается завтра
// ============================================================
async function checkPromotionsEndingSoon(supabase: SupabaseClient): Promise<CheckResult> {
  const tomorrow = dateStr(new Date(Date.now() + 86_400_000));
  const { data, error } = await supabase
    .from("wb_promotions")
    .select("name, end_at")
    .gte("end_at", `${tomorrow}T00:00:00`)
    .lt("end_at", `${tomorrow}T23:59:59.999`);
  if (error) {
    // Таблица может не существовать в некоторых окружениях — не считаем это ошибкой алерта,
    // просто молча пропускаем проверку (yellow с ok:true, без сообщения).
    return { name: "promotions_ending", ok: true, severity: "green", summary: "Акции завтра: 0", message: null };
  }

  const rows = (data ?? []) as Array<{ name: string | null; end_at: string }>;
  if (rows.length === 0) {
    return { name: "promotions_ending", ok: true, severity: "green", summary: "Акции завтра: 0", message: null };
  }

  const endDate = new Date(`${tomorrow}T00:00:00`);
  const ddmm = `${String(endDate.getDate()).padStart(2, "0")}.${String(endDate.getMonth() + 1).padStart(2, "0")}`;
  const listStr = rows.map((r) => `«${r.name ?? "без названия"}»`).join(", ");

  return {
    name: "promotions_ending",
    ok: false,
    severity: "yellow",
    summary: `Акции завтра: ${rows.length}`,
    message: `🟡 *Акция ${listStr} заканчивается завтра ${ddmm}*`,
  };
}

// ============================================================
// 7. Остаток на ВБ-складах закончился для активных SKU (0 по всем складам)
// ============================================================
async function checkOutOfStockActiveSku(supabase: SupabaseClient): Promise<CheckResult> {
  const [{ data: skus, error: skuErr }, { data: stocks, error: stockErr }] = await Promise.all([
    supabase.from("sku_catalog").select("wb_article, my_article, title").eq("is_active", true),
    supabase.from("wb_stocks").select("nm_id, quantity"),
  ]);
  if (skuErr || stockErr) {
    return {
      name: "out_of_stock",
      ok: false,
      severity: "yellow",
      summary: "OOS активных SKU: не удалось проверить",
      message: `🟡 *Остатки ВБ* — не удалось проверить (${skuErr?.message ?? stockErr?.message})`,
    };
  }

  const stockByNm = new Map<number, number>();
  for (const r of (stocks ?? []) as Array<{ nm_id: number; quantity: number | null }>) {
    stockByNm.set(r.nm_id, (stockByNm.get(r.nm_id) ?? 0) + Number(r.quantity ?? 0));
  }

  const oos: { article: string; title: string }[] = [];
  for (const s of (skus ?? []) as Array<{ wb_article: number | null; my_article: string | null; title: string | null }>) {
    if (s.wb_article == null) continue;
    const qty = stockByNm.get(s.wb_article);
    // Нет записи в wb_stocks вообще = тоже нулевой остаток (склад не вернул товар).
    if (qty == null || qty === 0) {
      oos.push({ article: s.my_article ?? String(s.wb_article), title: s.title ?? "" });
    }
  }

  if (oos.length === 0) {
    return { name: "out_of_stock", ok: true, severity: "green", summary: "OOS активных SKU: 0", message: null };
  }

  const top3 = oos.slice(0, 3).map((o) => o.article).join(", ");
  const severity: CheckResult["severity"] = oos.length >= 6 ? "red" : "orange";
  const summary = `OOS активных SKU: ${oos.length}`;

  return {
    name: "out_of_stock",
    ok: false,
    severity,
    summary,
    message:
      `${emoji(severity)} *Остаток на ВБ-складах закончился: ${oos.length} активных SKU*\n` +
      `Топ-3: ${top3}\n` +
      `→ Открыть ${BASE_URL}/deficit`,
  };
}

// ============================================================
// 8. SKU с упавшим рейтингом (<4.0) среди активных
// ============================================================
async function checkLowRating(supabase: SupabaseClient): Promise<CheckResult> {
  const { data, error } = await supabase
    .from("sku_catalog")
    .select("my_article, rating")
    .eq("is_active", true)
    .not("rating", "is", null)
    .lt("rating", 4.0);
  if (error) {
    return {
      name: "low_rating",
      ok: false,
      severity: "yellow",
      summary: "SKU с рейтингом <4.0: не удалось проверить",
      message: `🟡 *Рейтинг* — не удалось проверить (${error.message})`,
    };
  }

  const rows = (data ?? []) as Array<{ my_article: string | null; rating: number | null }>;
  if (rows.length === 0) {
    return { name: "low_rating", ok: true, severity: "green", summary: "SKU с рейтингом <4.0: 0", message: null };
  }

  rows.sort((a, b) => Number(a.rating ?? 0) - Number(b.rating ?? 0));
  const top5 = rows.slice(0, 5).map((r) => `${r.my_article ?? "?"} (${Number(r.rating).toFixed(1)})`).join(", ");

  const severity: CheckResult["severity"] = rows.length >= 4 ? "red" : "orange";
  const summary = `SKU с рейтингом <4.0: ${rows.length}`;

  return {
    name: "low_rating",
    ok: false,
    severity,
    summary,
    message:
      `${emoji(severity)} *${rows.length} SKU с рейтингом ниже 4.0*\n` +
      `Худшие: ${top5}\n` +
      `→ Открыть ${BASE_URL}/products`,
  };
}

// ============================================================
// 9. Тарифы ВБ-комиссии не обновлялись 14+ дней
// ============================================================
async function checkStaleCommissions(supabase: SupabaseClient): Promise<CheckResult> {
  const { data, error } = await supabase
    .from("wb_commissions_by_subject")
    .select("fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1);
  if (error) {
    return {
      name: "stale_commissions",
      ok: false,
      severity: "yellow",
      summary: "Комиссии WB: не удалось проверить",
      message: `🟡 *Тарифы ВБ-комиссии* — не удалось проверить (${error.message})`,
    };
  }

  const rows = (data ?? []) as Array<{ fetched_at: string | null }>;
  const lastFetchedAt = rows[0]?.fetched_at;
  if (!lastFetchedAt) {
    return { name: "stale_commissions", ok: true, severity: "yellow", summary: "Комиссии WB: нет данных", message: null };
  }

  const daysAgo = (Date.now() - new Date(lastFetchedAt).getTime()) / 86_400_000;
  if (daysAgo < 14) {
    return {
      name: "stale_commissions",
      ok: true,
      severity: "green",
      summary: `Комиссии WB обновлены: ${Math.floor(daysAgo)} дней назад`,
      message: null,
    };
  }

  const severity: CheckResult["severity"] = daysAgo >= 21 ? "orange" : "yellow";

  return {
    name: "stale_commissions",
    ok: false,
    severity,
    summary: `Комиссии WB обновлены: ${Math.floor(daysAgo)} дней назад`,
    message: `${emoji(severity)} *Тарифы ВБ-комиссии не обновлялись ${Math.floor(daysAgo)}+ дней*\n→ Открыть ${BASE_URL}/data-quality`,
  };
}

// ============================================================
// 10. Критические аномалии за 24ч из sku_events (детектор detect-anomalies).
// ============================================================
async function checkAnomalies(supabase: SupabaseClient): Promise<CheckResult> {
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const CRITICAL_TYPES = ["anomaly_detected", "sales_stopped", "stock_zero", "margin_negative"];

  const { data, error } = await supabase
    .from("sku_events")
    .select("sku_id, event_type, title, event_dt")
    .eq("severity", "critical")
    .in("event_type", CRITICAL_TYPES)
    .gte("event_dt", since)
    .order("event_dt", { ascending: false });
  if (error) {
    // Таблица могла ещё не существовать в некоторых окружениях — не считаем ошибкой алерта.
    return { name: "anomalies", ok: true, severity: "green", summary: "Аномалии за 24ч: 0 критичных", message: null };
  }

  type Row = { sku_id: number; event_type: string; title: string; event_dt: string };
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) {
    return { name: "anomalies", ok: true, severity: "green", summary: "Аномалии за 24ч: 0 критичных", message: null };
  }

  const skuIds = [...new Set(rows.slice(0, 5).map((r) => r.sku_id))];
  const { data: skuRows } = await supabase
    .from("sku_catalog")
    .select("id, my_article")
    .in("id", skuIds);
  const articleById = new Map(
    ((skuRows ?? []) as Array<{ id: number; my_article: string | null }>).map((s) => [s.id, s.my_article]),
  );

  const top5 = rows.slice(0, 5)
    .map((r) => `${articleById.get(r.sku_id) ?? `sku#${r.sku_id}`} — ${r.title}`)
    .join("\n");

  return {
    name: "anomalies",
    ok: false,
    severity: "red",
    summary: `Аномалии за 24ч: ${rows.length} критичных`,
    message:
      `🔴 *Критические аномалии за 24ч: ${rows.length}*\n` +
      `${top5}\n` +
      `→ Открыть ${BASE_URL}/dashboard`,
  };
}

// ============================================================
// Заказы вчера — сумма + кол-во
// ============================================================
async function checkYesterdayOrders(supabase: SupabaseClient): Promise<CheckResult> {
  const today = new Date();
  const y = new Date(today.getTime() - 86_400_000);
  const dayStart = `${dateStr(y)}T00:00:00Z`;
  const dayEnd = `${dateStr(today)}T00:00:00Z`;

  const { data, error } = await supabase
    .from("wb_orders_fact")
    .select("price_with_disc, is_cancel")
    .gte("date", dayStart)
    .lt("date", dayEnd);

  if (error) {
    return {
      name: "yesterday_orders",
      ok: true,
      severity: "yellow",
      summary: "Заказы вчера: не удалось посчитать",
      message: null,
    };
  }
  const rows = (data ?? []) as Array<{ price_with_disc: number | null; is_cancel: boolean | null }>;
  const active = rows.filter((r) => !r.is_cancel);
  const sum = active.reduce((s, r) => s + Number(r.price_with_disc ?? 0), 0);
  const cnt = active.length;
  const rub = Math.round(sum).toLocaleString("ru-RU");
  return {
    name: "yesterday_orders",
    ok: true,
    severity: "green",
    summary: `Заказы вчера: ${rub} ₽ (${cnt} шт)`,
    message: null,
  };
}

// ============================================================
// Выкупы вчера — сумма + кол-во
// ============================================================
async function checkYesterdayBuyouts(supabase: SupabaseClient): Promise<CheckResult> {
  const yIso = dateStr(new Date(Date.now() - 86_400_000));
  const { data, error } = await supabase
    .from("wb_sales_fact")
    .select("price_with_disc, is_storno")
    .eq("sale_dt", yIso);

  if (error) {
    return {
      name: "yesterday_buyouts",
      ok: true,
      severity: "yellow",
      summary: "Выкупы вчера: не удалось посчитать",
      message: null,
    };
  }
  const rows = (data ?? []) as Array<{ price_with_disc: number | null; is_storno: boolean | null }>;
  const active = rows.filter((r) => !r.is_storno);
  const sum = active.reduce((s, r) => s + Number(r.price_with_disc ?? 0), 0);
  const cnt = active.length;
  const rub = Math.round(sum).toLocaleString("ru-RU");
  return {
    name: "yesterday_buyouts",
    ok: true,
    severity: "green",
    summary: `Выкупы вчера: ${rub} ₽ (${cnt} шт)`,
    message: null,
  };
}

// ============================================================
// 11. Удержания и штрафы за 7д — реклама, платные отзывы, транзит, штрафы.
// ============================================================
// Эти расходы приходят в отчёте с nm_id = 0: они не привязаны ни к одному товару,
// поэтому не видны ни в одной карточке и молча уходят в общий итог. Разбор 2026-09-02:
// недельная маржа ушла в -7.6% из-за одного списания «WB Продвижение» на 6757₽ —
// при прибыли от продаж 6712₽ реклама съела её целиком, и в сводке это выглядело
// как необъяснимый обвал маржи.
function deductionLabel(oper: string, bonus: string): string {
  const b = bonus || oper || "прочее";
  if (/Продвижение/i.test(b)) return "Реклама «WB Продвижение»";
  if (/Списание за отзыв/i.test(b)) return "Платные отзывы";
  if (/транзитных поставок/i.test(b)) return "Доставка транзитных поставок";
  if (/хранение возвратов/i.test(b)) return "Штраф: хранение возвратов на ПВЗ";
  if (/недовоз|поставка .* удалена|РЗШ/i.test(b)) return "Штраф по поставке";
  if (/программе лояльности/i.test(b)) return "Программа лояльности";
  // Номера документов и поставок отрезаем, иначе каждая строка своя группа.
  return b.replace(/[,.]?\s*(документ|поставка)\s*№\s*\d+/gi, "").trim();
}

async function checkDeductions(supabase: SupabaseClient): Promise<CheckResult> {
  // Окно как в checkMargin — WB Report лагает 1-2 дня.
  const today = new Date();
  const LAG_DAYS = 2;
  const d0 = dateStr(new Date(today.getTime() - LAG_DAYS * 86_400_000));
  const d7 = dateStr(new Date(today.getTime() - (LAG_DAYS + 7) * 86_400_000));

  const { data, error } = await supabase
    .from("wb_reports_fact")
    .select("supplier_oper_name, bonus_type_name, deduction, penalty, retail_amount, doc_type_name, quantity")
    .gte("sale_dt", d7)
    .lte("sale_dt", d0)
    .limit(10000);
  if (error) {
    return {
      name: "deductions",
      ok: false,
      severity: "yellow",
      summary: "Удержания: не удалось посчитать",
      message: `🟡 *Удержания* — не удалось посчитать (${error.message})`,
    };
  }

  type Row = {
    supplier_oper_name: string | null;
    bonus_type_name: string | null;
    deduction: number | null;
    penalty: number | null;
    retail_amount: number | null;
    doc_type_name: string | null;
    quantity: number | null;
  };

  const byLabel = new Map<string, number>();
  let total = 0;
  let revenue = 0;
  for (const r of (data ?? []) as Row[]) {
    if (r.doc_type_name === "Продажа" && Number(r.quantity ?? 0) > 0) {
      revenue += Number(r.retail_amount ?? 0);
    }
    const sum = Number(r.deduction ?? 0) + Number(r.penalty ?? 0);
    if (sum === 0) continue;
    total += sum;
    const label = deductionLabel(r.supplier_oper_name ?? "", r.bonus_type_name ?? "");
    byLabel.set(label, (byLabel.get(label) ?? 0) + sum);
  }

  const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
  if (total <= 0) {
    return { name: "deductions", ok: true, severity: "green", summary: "Удержания за 7д: 0 ₽", message: null };
  }

  const sharePct = revenue > 0 ? (total / revenue) * 100 : null;
  const shareStr = sharePct != null ? ` (${sharePct.toFixed(0)}% от выручки)` : "";
  const summary = `Удержания за 7д: ${rub(total)}${shareStr}`;

  // Порог по доле от выручки: удержания больше пятой части выручки съедают всю маржу
  // тонкого товара, это всегда разбор. Без продаж в окне любое удержание — красное.
  const severity: CheckResult["severity"] =
    sharePct == null || sharePct >= 20 ? "red" : sharePct >= 5 ? "orange" : "yellow";
  if (severity === "yellow") {
    return { name: "deductions", ok: true, severity, summary, message: null };
  }

  const lines = [...byLabel.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, sum]) => `• ${label}: ${rub(sum)}`)
    .join("\n");

  return {
    name: "deductions",
    ok: false,
    severity,
    summary,
    message:
      `${emoji(severity)} *Удержания за 7д: ${rub(total)}${shareStr}*\n` +
      `${lines}\n` +
      `Выручка за то же окно: ${rub(revenue)}\n` +
      `→ Открыть ${BASE_URL}/margin-analyzer`,
  };
}

async function sendTelegram(token: string, chatId: string, text: string): Promise<boolean> {
  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  return resp.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const gate = checkCronSecret(req);
  if (!gate.ok) return gate.response;

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Debug: /functions/v1/telegram-alerts?debug=env — отдаёт имена env-переменных
  // содержащих TELEGRAM/TG/BOT/CHAT (без значений). Помогает понять под каким именем
  // владелица добавила секреты.
  const url = new URL(req.url);
  if (url.searchParams.get("debug") === "env") {
    const keys: string[] = [];
    // deno-lint-ignore no-explicit-any
    const env: any = Deno.env;
    if (typeof env.toObject === "function") {
      for (const k of Object.keys(env.toObject() as Record<string, string>)) {
        if (/TELEGRAM|TG|BOT|CHAT/i.test(k)) keys.push(k);
      }
    }
    return json({ env_keys_matching: keys.sort() });
  }

  try {
    const supabase = adminClient();

    const results = await Promise.all([
      checkYesterdayOrders(supabase),
      checkYesterdayBuyouts(supabase),
      checkMargin(supabase),
      checkBuyout(supabase),
      checkDeficit(supabase),
      checkCronHealth(supabase),
      checkNewSkuNoCost(supabase),
      checkPromotionsEndingSoon(supabase),
      checkOutOfStockActiveSku(supabase),
      checkLowRating(supabase),
      checkStaleCommissions(supabase),
      checkAnomalies(supabase),
      checkDeductions(supabase),
    ]);

    const alerts = results.filter((r) => r.message != null);

    // Всегда формируем сводку по всем проверкам.
    const today = dateStr(new Date());
    const header = `📊 *SellerBase — ежедневная сводка ${today}*`;
    const allChecks = results.map((r) => `${emoji(r.severity)} ${r.summary}`).join("\n");

    // Детали — только для критичных/оранжевых проверок с подробным message.
    const details = results
      .filter((r) => r.message && (r.severity === "red" || r.severity === "orange"))
      .map((r) => r.message)
      .join("\n\n");

    const text = details
      ? `${header}\n\n${allChecks}\n\n---\n${details}`
      : `${header}\n\n${allChecks}`;

    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");

    // Берём всех активных подписчиков из notification_subscribers
    // (заполняется через @SellerBase_bot командой /start), фильтруем по whitelist.
    const allow = (
      Deno.env.get("TELEGRAM_CHAT_ID") ??
      Deno.env.get("TELEGRAM_ALLOWED_CHAT_IDS") ??
      Deno.env.get("TELEGRAM_ALLOWED_CHAT_ID") ??
      ""
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const { data: subsRaw } = await supabase
      .from("notification_subscribers")
      .select("telegram_chat_id")
      .eq("channel", "telegram")
      .eq("is_active", true);
    const subs = ((subsRaw ?? []) as { telegram_chat_id: string }[]).filter(
      (s) => allow.length === 0 || allow.includes(s.telegram_chat_id),
    );

    let sentCount = 0;
    if (token && subs && subs.length > 0) {
      for (const s of subs as { telegram_chat_id: string }[]) {
        const ok = await sendTelegram(token, s.telegram_chat_id, text);
        if (ok) sentCount += 1;
      }
    }

    return json({
      ok: true,
      alerts_sent: sentCount > 0 ? alerts.length : 0,
      checks: results.map((r) => ({ name: r.name, ok: r.ok, severity: r.severity })),
      subscribers_sent: sentCount,
      subscribers_total: subs?.length ?? 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
