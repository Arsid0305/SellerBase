// detect-anomalies — почасовой сканер аномалий по SKU.
// 5 проверок: sales_stopped, cost_updated (price drop >30%), rating_changed (drop 0.3+/7д),
// stock_zero, anomaly_detected (margin negative за 7д).
// Не дублирует события: перед INSERT проверяет наличие события того же типа за последние 24ч.
// State (рейтинг 7д назад, последняя дата продажи) хранится в anomaly_state.
// verify_jwt = true; cron ходит с service_role-ключом и X-Cron-Secret
// (см. 20260620010002_cron_detect_anomalies.sql).
//
// 09.09.2026 — почему проверки идут последовательно, а не через Promise.all.
// Раз в сутки прогон падал с «Gateway Timeout». По логам шлюза видно точно:
// шесть запросов уходили в одну миллисекунду, четыре возвращались за 83–129 мс,
// а два висели ровно 5 секунд и получали 504; PostgREST в тот же момент писал
// «Warp server error: Thread killed by timeout manager». То есть запросы не
// выполнялись вовсе — они не дождались свободного соединения в пуле и были
// убиты по таймауту. Сами запросы дешёвые: выборка отчётов за 14 дней идёт
// 1,5 мс по индексу (277 строк), расчёт P&L — 100 мс. Вся работа функции
// укладывается в ~150 мс, поэтому параллельность не давала выигрыша, а залп
// из шести соединений исчерпывал пул. Проверки выстроены в цепочку.
// Повтор (withRetry) оставлен на случай, если соединение займёт кто-то ещё.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";
import { runJob } from "../_shared/ingestion.ts";

const JOB_NAME = "detect-anomalies";
const DEDUP_WINDOW_HOURS = 24;
const RETRY_ATTEMPTS = 3;

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

// Сбой на пути «функция → шлюз», а не отказ базы: запрос не дождался
// соединения и был убит. Такое лечится повтором, ошибка в данных — нет.
function isTransient(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("gateway timeout") ||
    m.includes("timeout") ||
    m.includes("fetch failed") ||
    m.includes("connection closed") ||
    m.includes("502") ||
    m.includes("503") ||
    m.includes("504");
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastMessage = "";
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastMessage = e instanceof Error ? e.message : String(e);
      if (!isTransient(lastMessage) || attempt === RETRY_ATTEMPTS) throw e;
      console.warn(`[${label}] попытка ${attempt} из ${RETRY_ATTEMPTS}: ${lastMessage} — повтор`);
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw new Error(`${label}: ${lastMessage}`);
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

interface NewEvent {
  sku_id: number;
  event_type: string;
  severity: "info" | "warn" | "critical";
  title: string;
  details: Record<string, unknown> | null;
}

// Проверяет наличие события того же типа за последние 24ч для каждого SKU,
// отсеивает дубликаты перед INSERT.
async function filterDuplicates(
  supabase: SupabaseClient,
  candidates: NewEvent[],
): Promise<NewEvent[]> {
  if (candidates.length === 0) return [];
  const types = [...new Set(candidates.map((c) => c.event_type))];
  const since = new Date(Date.now() - DEDUP_WINDOW_HOURS * 3_600_000).toISOString();

  const data = await withRetry("sku_events dedup", async () => {
    const { data, error } = await supabase
      .from("sku_events")
      .select("sku_id, event_type")
      .in("event_type", types)
      .gte("event_dt", since);
    if (error) throw new Error(`sku_events dedup check failed: ${error.message}`);
    return data;
  });

  const seen = new Set((data ?? []).map((r: { sku_id: number; event_type: string }) => `${r.sku_id}:${r.event_type}`));
  return candidates.filter((c) => !seen.has(`${c.sku_id}:${c.event_type}`));
}

async function insertEvents(supabase: SupabaseClient, events: NewEvent[]): Promise<number> {
  const deduped = await filterDuplicates(supabase, events);
  if (deduped.length === 0) return 0;
  await withRetry("sku_events insert", async () => {
    const { error } = await supabase.from("sku_events").insert(
      deduped.map((e) => ({
        sku_id: e.sku_id,
        event_type: e.event_type,
        severity: e.severity,
        title: e.title,
        details: e.details,
      })),
    );
    if (error) throw new Error(`sku_events insert failed: ${error.message}`);
  });
  return deduped.length;
}

type SkuRow = {
  id: number;
  wb_article: number | null;
  my_article: string | null;
  rating: number | null;
  is_active: boolean;
};

// ============================================================
// 1. Sales stopped — у активного SKU 3 дня подряд нет продаж, а раньше были.
// ============================================================
async function detectSalesStopped(supabase: SupabaseClient, skus: SkuRow[]): Promise<NewEvent[]> {
  const today = new Date();
  const d0 = dateStr(today);
  const d14 = dateStr(new Date(today.getTime() - 14 * 86_400_000));

  const data = await withRetry("detectSalesStopped", async () => {
    const { data, error } = await supabase
      .from("wb_reports_fact")
      .select("nm_id, rr_dt, quantity")
      .gte("rr_dt", d14)
      .lte("rr_dt", d0)
      .range(0, 100_000);
    if (error) throw new Error(`detectSalesStopped: ${error.message}`);
    return data;
  });

  const lastSaleByNm = new Map<number, string>();
  for (const r of (data ?? []) as Array<{ nm_id: number; rr_dt: string; quantity: number | null }>) {
    if (toNum(r.quantity) <= 0) continue;
    const cur = lastSaleByNm.get(r.nm_id);
    if (!cur || r.rr_dt > cur) lastSaleByNm.set(r.nm_id, r.rr_dt);
  }

  const events: NewEvent[] = [];
  const cutoff3d = dateStr(new Date(today.getTime() - 3 * 86_400_000));
  for (const s of skus) {
    if (!s.is_active || s.wb_article == null) continue;
    const lastSale = lastSaleByNm.get(s.wb_article);
    // Были продажи в окне 14д, но не за последние 3 дня — значит остановились.
    if (lastSale && lastSale < cutoff3d) {
      events.push({
        sku_id: s.id,
        event_type: "sales_stopped",
        severity: "critical",
        title: "Продажи остановились",
        details: { last_sale_dt: lastSale, my_article: s.my_article },
      });
    }
  }
  return events;
}

// ============================================================
// 2. Price drop — cost_price_rub изменилась >30% (через sku_cost_history).
// ============================================================
async function detectCostUpdated(supabase: SupabaseClient, skus: SkuRow[]): Promise<NewEvent[]> {
  const skuIds = skus.map((s) => s.id);
  if (skuIds.length === 0) return [];

  const data = await withRetry("detectCostUpdated", async () => {
    const { data, error } = await supabase
      .from("sku_cost_history")
      .select("sku_id, cost_rub, valid_from, valid_to")
      .in("sku_id", skuIds)
      .order("valid_from", { ascending: false });
    if (error) throw new Error(`detectCostUpdated: ${error.message}`);
    return data;
  });

  type Hist = { sku_id: number; cost_rub: number; valid_from: string; valid_to: string | null };
  const bySku = new Map<number, Hist[]>();
  for (const r of (data ?? []) as Hist[]) {
    const arr = bySku.get(r.sku_id) ?? [];
    arr.push(r);
    bySku.set(r.sku_id, arr);
  }

  const myArticleById = new Map(skus.map((s) => [s.id, s.my_article]));
  const events: NewEvent[] = [];
  for (const [skuId, rows] of bySku) {
    if (rows.length < 2) continue;
    // rows уже сортирован valid_from DESC: rows[0] — текущая, rows[1] — предыдущая.
    const cur = toNum(rows[0]!.cost_rub);
    const prev = toNum(rows[1]!.cost_rub);
    if (prev <= 0 || cur <= 0) continue;
    const deltaPct = ((cur - prev) / prev) * 100;
    if (Math.abs(deltaPct) > 30) {
      events.push({
        sku_id: skuId,
        event_type: "cost_updated",
        severity: "warn",
        title: `Себестоимость изменилась на ${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(0)}%`,
        details: {
          old_cost_rub: prev,
          new_cost_rub: cur,
          delta_pct: Math.round(deltaPct * 10) / 10,
          my_article: myArticleById.get(skuId) ?? null,
        },
      });
    }
  }
  return events;
}

// ============================================================
// 3. Rating drop — рейтинг упал на 0.3+ за последние 7д (через anomaly_state снапшот).
// ============================================================
async function detectRatingChanged(supabase: SupabaseClient, skus: SkuRow[]): Promise<NewEvent[]> {
  const stateRows = await withRetry("detectRatingChanged", async () => {
    const { data, error } = await supabase
      .from("anomaly_state")
      .select("sku_id, value, updated_at")
      .eq("metric", "rating");
    if (error) throw new Error(`detectRatingChanged: ${error.message}`);
    return data;
  });

  type StateRow = { sku_id: number; value: { rating: number }; updated_at: string };
  const stateBySku = new Map<number, StateRow>();
  for (const r of (stateRows ?? []) as StateRow[]) stateBySku.set(r.sku_id, r);

  const events: NewEvent[] = [];
  const upserts: { sku_id: number; metric: string; value: Record<string, unknown> }[] = [];
  const now = Date.now();

  for (const s of skus) {
    if (s.rating == null) continue;
    const prevState = stateBySku.get(s.id);
    const ageMs = prevState ? now - new Date(prevState.updated_at).getTime() : Infinity;

    if (prevState && ageMs >= 7 * 86_400_000) {
      const prevRating = toNum(prevState.value?.rating);
      const drop = prevRating - toNum(s.rating);
      if (prevRating > 0 && drop >= 0.3) {
        events.push({
          sku_id: s.id,
          event_type: "rating_changed",
          severity: "warn",
          title: `Рейтинг упал на ${drop.toFixed(1)}`,
          details: { old_rating: prevRating, new_rating: s.rating, my_article: s.my_article },
        });
      }
      // Снапшот старше 7д — обновляем точку отсчёта.
      upserts.push({ sku_id: s.id, metric: "rating", value: { rating: s.rating } });
    } else if (!prevState) {
      // Первый снапшот — просто фиксируем точку отсчёта, без события.
      upserts.push({ sku_id: s.id, metric: "rating", value: { rating: s.rating } });
    }
  }

  if (upserts.length > 0) {
    await withRetry("detectRatingChanged upsert state", async () => {
      const { error } = await supabase
        .from("anomaly_state")
        .upsert(upserts, { onConflict: "sku_id,metric" });
      if (error) throw new Error(`detectRatingChanged upsert state: ${error.message}`);
    });
  }

  return events;
}

// ============================================================
// 4. Stock zero — суммарный quantity по wb_stocks стал 0 (раньше было > 0).
// ============================================================
async function detectStockZero(supabase: SupabaseClient, skus: SkuRow[]): Promise<NewEvent[]> {
  const data = await withRetry("detectStockZero", async () => {
    const { data, error } = await supabase.from("wb_stocks").select("nm_id, quantity");
    if (error) throw new Error(`detectStockZero: ${error.message}`);
    return data;
  });

  const stockByNm = new Map<number, number>();
  for (const r of (data ?? []) as Array<{ nm_id: number | null; quantity: number | null }>) {
    if (r.nm_id == null) continue;
    stockByNm.set(r.nm_id, (stockByNm.get(r.nm_id) ?? 0) + toNum(r.quantity));
  }

  const stateRows = await withRetry("detectStockZero state", async () => {
    const { data, error } = await supabase
      .from("anomaly_state")
      .select("sku_id, value")
      .eq("metric", "stock_total");
    if (error) throw new Error(`detectStockZero state: ${error.message}`);
    return data;
  });

  type StateRow = { sku_id: number; value: { qty: number } };
  const stateBySku = new Map<number, StateRow>();
  for (const r of (stateRows ?? []) as StateRow[]) stateBySku.set(r.sku_id, r);

  const events: NewEvent[] = [];
  const upserts: { sku_id: number; metric: string; value: Record<string, unknown> }[] = [];

  for (const s of skus) {
    if (!s.is_active || s.wb_article == null) continue;
    const qty = stockByNm.get(s.wb_article) ?? 0;
    const prevQty = toNum(stateBySku.get(s.id)?.value?.qty);

    if (qty === 0 && prevQty > 0) {
      events.push({
        sku_id: s.id,
        event_type: "stock_zero",
        severity: "critical",
        title: "Остаток закончился",
        details: { prev_qty: prevQty, my_article: s.my_article },
      });
    }
    upserts.push({ sku_id: s.id, metric: "stock_total", value: { qty } });
  }

  if (upserts.length > 0) {
    await withRetry("detectStockZero upsert state", async () => {
      const { error } = await supabase
        .from("anomaly_state")
        .upsert(upserts, { onConflict: "sku_id,metric" });
      if (error) throw new Error(`detectStockZero upsert state: ${error.message}`);
    });
  }

  return events;
}

// ============================================================
// 5. Margin negative — маржа за последние 7д < 0 (через get_pnl_by_period).
// ============================================================
async function detectMarginNegative(supabase: SupabaseClient, skus: SkuRow[]): Promise<NewEvent[]> {
  const today = new Date();
  const d0 = dateStr(today);
  const d7 = dateStr(new Date(today.getTime() - 7 * 86_400_000));

  const data = await withRetry("detectMarginNegative", async () => {
    const { data, error } = await supabase.rpc("get_full_pnl_by_period", { p_from: d7, p_to: d0 });
    if (error) throw new Error(`detectMarginNegative: ${error.message}`);
    return data;
  });

  const myArticleById = new Map(skus.map((s) => [s.id, s.my_article]));
  const events: NewEvent[] = [];
  for (const r of (data ?? []) as Array<{
    sku_id: number;
    my_article: string;
    revenue_rub: number;
    net_profit_rub: number;
    margin_pct: number | null;
  }>) {
    if (toNum(r.revenue_rub) <= 0) continue; // нет активности — не считаем аномалией
    if (r.margin_pct != null && toNum(r.margin_pct) < 0) {
      events.push({
        sku_id: r.sku_id,
        event_type: "anomaly_detected",
        severity: "critical",
        title: `Маржа за 7д отрицательная: ${toNum(r.margin_pct).toFixed(1)}%`,
        details: {
          revenue_rub: Math.round(toNum(r.revenue_rub)),
          net_profit_rub: Math.round(toNum(r.net_profit_rub)),
          margin_pct: toNum(r.margin_pct),
          my_article: myArticleById.get(r.sku_id) ?? r.my_article,
        },
      });
    }
  }
  return events;
}

async function run(supabase: SupabaseClient): Promise<{
  inserted: number;
  byCheck: Record<string, { candidates: number; inserted: number }>;
}> {
  const skusRaw = await withRetry("load sku_catalog", async () => {
    const { data, error } = await supabase
      .from("sku_catalog")
      .select("id, wb_article, my_article, rating, is_active");
    if (error) throw new Error(`load sku_catalog failed: ${error.message}`);
    return data;
  });
  const skus = (skusRaw ?? []) as SkuRow[];

  // Последовательно, а не Promise.all — см. пояснение в шапке файла.
  const checks: Record<string, NewEvent[]> = {
    sales_stopped: await detectSalesStopped(supabase, skus),
    cost_updated: await detectCostUpdated(supabase, skus),
    rating_changed: await detectRatingChanged(supabase, skus),
    stock_zero: await detectStockZero(supabase, skus),
    margin_negative: await detectMarginNegative(supabase, skus),
  };

  const byCheck: Record<string, { candidates: number; inserted: number }> = {};
  let totalInserted = 0;
  for (const [name, candidates] of Object.entries(checks)) {
    const inserted = await insertEvents(supabase, candidates);
    byCheck[name] = { candidates: candidates.length, inserted };
    totalInserted += inserted;
  }

  return { inserted: totalInserted, byCheck };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const gate = checkCronSecret(req);
  if (!gate.ok) return gate.response;

  const supabase = adminClient();

  // Журнал и защиту от наложения прогонов ведёт runJob — та же обёртка, что у
  // фетчеров. До 09.09.2026 функция вела ingestion_log сама и работала без
  // advisory-lock: два прогона могли идти внахлёст и записать одно событие дважды.
  const outcome = await runJob(supabase, JOB_NAME, {}, async () => {
    const result = await run(supabase);
    return {
      rows_in: 0,
      rows_out: result.inserted,
      result,
      meta: { byCheck: result.byCheck },
    };
  });

  if (outcome.skipped) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "предыдущий прогон ещё идёт" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!outcome.ok) {
    return new Response(JSON.stringify({ ok: false, error: outcome.error }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true, ...outcome.result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
