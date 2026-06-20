// detect-anomalies — почасовой сканер аномалий по SKU.
// 5 проверок: sales_stopped, cost_updated (price drop >30%), rating_changed (drop 0.3+/7д),
// stock_zero, anomaly_detected (margin negative за 7д).
// Не дублирует события: перед INSERT проверяет наличие события того же типа за последние 24ч.
// State (рейтинг 7д назад, последняя дата продажи) хранится в anomaly_state.
// verify_jwt = false (вызывается из pg_cron, см. 20260620010002_cron_detect_anomalies.sql).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const JOB_NAME = "detect-anomalies";
const DEDUP_WINDOW_HOURS = 24;

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

  const { data, error } = await supabase
    .from("sku_events")
    .select("sku_id, event_type")
    .in("event_type", types)
    .gte("event_dt", since);
  if (error) throw new Error(`sku_events dedup check failed: ${error.message}`);

  const seen = new Set((data ?? []).map((r: { sku_id: number; event_type: string }) => `${r.sku_id}:${r.event_type}`));
  return candidates.filter((c) => !seen.has(`${c.sku_id}:${c.event_type}`));
}

async function insertEvents(supabase: SupabaseClient, events: NewEvent[]): Promise<number> {
  const deduped = await filterDuplicates(supabase, events);
  if (deduped.length === 0) return 0;
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

  const { data, error } = await supabase
    .from("wb_reports_fact")
    .select("nm_id, rr_dt, quantity")
    .gte("rr_dt", d14)
    .lte("rr_dt", d0)
    .range(0, 100_000);
  if (error) throw new Error(`detectSalesStopped: ${error.message}`);

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

  const { data, error } = await supabase
    .from("sku_cost_history")
    .select("sku_id, cost_rub, valid_from, valid_to")
    .in("sku_id", skuIds)
    .order("valid_from", { ascending: false });
  if (error) throw new Error(`detectCostUpdated: ${error.message}`);

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
  const { data: stateRows, error: stateErr } = await supabase
    .from("anomaly_state")
    .select("sku_id, value, updated_at")
    .eq("metric", "rating");
  if (stateErr) throw new Error(`detectRatingChanged: ${stateErr.message}`);

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
    const { error } = await supabase
      .from("anomaly_state")
      .upsert(upserts, { onConflict: "sku_id,metric" });
    if (error) throw new Error(`detectRatingChanged upsert state: ${error.message}`);
  }

  return events;
}

// ============================================================
// 4. Stock zero — суммарный quantity по wb_stocks стал 0 (раньше было > 0).
// ============================================================
async function detectStockZero(supabase: SupabaseClient, skus: SkuRow[]): Promise<NewEvent[]> {
  const { data, error } = await supabase.from("wb_stocks").select("nm_id, quantity");
  if (error) throw new Error(`detectStockZero: ${error.message}`);

  const stockByNm = new Map<number, number>();
  for (const r of (data ?? []) as Array<{ nm_id: number | null; quantity: number | null }>) {
    if (r.nm_id == null) continue;
    stockByNm.set(r.nm_id, (stockByNm.get(r.nm_id) ?? 0) + toNum(r.quantity));
  }

  const { data: stateRows, error: stateErr } = await supabase
    .from("anomaly_state")
    .select("sku_id, value")
    .eq("metric", "stock_total");
  if (stateErr) throw new Error(`detectStockZero state: ${stateErr.message}`);

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
    const { error: upErr } = await supabase
      .from("anomaly_state")
      .upsert(upserts, { onConflict: "sku_id,metric" });
    if (upErr) throw new Error(`detectStockZero upsert state: ${upErr.message}`);
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

  const { data, error } = await supabase.rpc("get_full_pnl_by_period", { p_from: d7, p_to: d0 });
  if (error) throw new Error(`detectMarginNegative: ${error.message}`);

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
  const { data: skusRaw, error: skuErr } = await supabase
    .from("sku_catalog")
    .select("id, wb_article, my_article, rating, is_active");
  if (skuErr) throw new Error(`load sku_catalog failed: ${skuErr.message}`);
  const skus = (skusRaw ?? []) as SkuRow[];

  const [salesStopped, costUpdated, ratingChanged, stockZero, marginNegative] = await Promise.all([
    detectSalesStopped(supabase, skus),
    detectCostUpdated(supabase, skus),
    detectRatingChanged(supabase, skus),
    detectStockZero(supabase, skus),
    detectMarginNegative(supabase, skus),
  ]);

  const checks: Record<string, NewEvent[]> = {
    sales_stopped: salesStopped,
    cost_updated: costUpdated,
    rating_changed: ratingChanged,
    stock_zero: stockZero,
    margin_negative: marginNegative,
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

  const supabase = adminClient();
  const { data: logRow, error: logErr } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: {} })
    .select("id")
    .single();
  if (logErr || !logRow) {
    return new Response(JSON.stringify({ error: `init ingestion_log: ${logErr?.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const jobId = logRow.id;

  try {
    const result = await run(supabase);

    await supabase
      .from("ingestion_log")
      .update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_out: result.inserted,
        meta: { byCheck: result.byCheck },
      })
      .eq("id", jobId);

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("ingestion_log")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_text: msg,
      })
      .eq("id", jobId);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
