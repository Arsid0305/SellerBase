// fetch-wb-funnel-aggregate — воронка за длительный период (агрегат).
// WB: POST /api/analytics/v3/sales-funnel/products
// UPSERT в wb_sales_funnel_period.
// По умолчанию: last 60 days.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const JOB_NAME = "fetch-wb-funnel-aggregate";
const WB_BASE = "https://seller-analytics-api.wildberries.ru";
const PAGE = 20;

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

function toInt(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? Math.round(n) : 0;
}
function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = adminClient();
  const url = new URL(req.url);
  const qFrom = url.searchParams.get("from");
  const qTo = url.searchParams.get("to");

  const today = new Date().toISOString().slice(0, 10);
  const monthsAgo = new Date(Date.now() - 60 * 86400 * 1000).toISOString().slice(0, 10);
  const dateFrom = qFrom ?? monthsAgo;
  const dateTo = qTo ?? today;

  const { data: logRow } = await supabase.from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: { from: dateFrom, to: dateTo } })
    .select("id").single();
  const jobId: number = logRow?.id ?? 0;

  try {
    const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
    if (!token) throw new Error("WB_TOKEN_READ is not set");

    const { data: skus } = await supabase
      .from("sku_catalog").select("wb_article").not("wb_article", "is", null);
    const allNm = (skus ?? []).map((s: { wb_article: number }) => s.wb_article).filter(Boolean);

    let totalProducts = 0;
    let totalRows = 0;

    for (let i = 0; i < allNm.length; i += PAGE) {
      const batch = allNm.slice(i, i + PAGE);
      const body = {
        nmIds: batch,
        selectedPeriod: { start: dateFrom, end: dateTo },
        timezone: "Europe/Moscow",
        orderBy: { field: "openCard", mode: "desc" },
        page: 1,
      };
      const resp = await fetch(`${WB_BASE}/api/analytics/v3/sales-funnel/products`, {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`WB ${resp.status}: ${txt.slice(0, 500)}`);
      }
      const json = await resp.json();
      // deno-lint-ignore no-explicit-any
      const products = (json as { data?: { products?: any[] } })?.data?.products ?? [];
      totalProducts += products.length;

      // deno-lint-ignore no-explicit-any
      const rows = products.map((p: any) => {
        const sel = p?.statistic?.selected ?? {};
        const conv = sel?.conversions ?? {};
        return {
          nm_id: p?.product?.nmId,
          period_start: dateFrom,
          period_end: dateTo,
          open_count: toInt(sel.openCount),
          cart_count: toInt(sel.cartCount),
          order_count: toInt(sel.orderCount),
          order_sum: toNum(sel.orderSum),
          buyout_count: toInt(sel.buyoutCount),
          buyout_sum: toNum(sel.buyoutSum),
          cancel_count: toInt(sel.cancelCount),
          buyout_percent: toInt(conv.buyoutPercent),
          add_to_cart_percent: toInt(conv.addToCartPercent),
          cart_to_order_percent: toInt(conv.cartToOrderPercent),
          avg_price: toNum(sel.avgPrice),
          avg_orders_per_day: toNum(sel.avgOrdersCountPerDay),
          share_order_percent: toNum(sel.shareOrderPercent),
          localization_percent: toNum(sel.localizationPercent),
          fetched_at: new Date().toISOString(),
        };
      // deno-lint-ignore no-explicit-any
      }).filter((r: any) => r.nm_id);

      if (rows.length > 0) {
        const { error: upErr } = await supabase.from("wb_sales_funnel_period")
          .upsert(rows, { onConflict: "nm_id" });
        if (upErr) throw new Error(`upsert: ${upErr.message}`);
        totalRows += rows.length;
      }
      if (i + PAGE < allNm.length) await new Promise((r) => setTimeout(r, 22000));
    }

    await supabase.from("ingestion_log").update({
      status: "ok", finished_at: new Date().toISOString(),
      rows_in: totalProducts, rows_out: totalRows,
      meta: { from: dateFrom, to: dateTo, products: totalProducts, rows: totalRows },
    }).eq("id", jobId);

    return new Response(JSON.stringify({ ok: true, products: totalProducts, rows: totalRows }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("ingestion_log").update({
      status: "error", finished_at: new Date().toISOString(), error_text: msg,
    }).eq("id", jobId);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  }
});
