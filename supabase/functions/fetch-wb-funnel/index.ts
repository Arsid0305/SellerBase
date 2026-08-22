// fetch-wb-funnel — Воронка продаж WB по SKU и дням.
// WB API: POST /api/analytics/v3/sales-funnel/products/history (seller-analytics-api.wildberries.ru)
// UPSERT в wb_sales_funnel.
// Период по умолчанию: yesterday..yesterday. ?from=YYYY-MM-DD&to=YYYY-MM-DD — произвольный.
// nmIDs автоматически из sku_catalog (≤1000 за запрос).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-wb-funnel";
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

interface FunnelHistoryRow {
  date?: string;
  dt?: string;
  openCount?: number;
  // WB отдаёт корзину как cartCount. Поля addToCartCount у него нет — из-за него
  // add_to_cart_count лежал нулём с самого начала сбора. Оба имени на случай,
  // если контракт снова поменяется.
  cartCount?: number;
  addToCartCount?: number;
  orderCount?: number;
  orderSum?: number;
  buyoutCount?: number;
  buyoutSum?: number;
  cancelCount?: number;
  cancelSum?: number;
  // Конверсии WB считает сам, со своим знаменателем — берём как есть,
  // не пересчитываем: это главные метрики качества карточки.
  addToCartConversion?: number;
  cartToOrderConversion?: number;
  buyoutPercent?: number;
  addToWishlistCount?: number;
}

interface FunnelProduct {
  product?: { nmId?: number };
  nmId?: number;
  history?: FunnelHistoryRow[];
}

function toInt(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? Math.round(n) : 0;
}
function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const gate = checkCronSecret(req);
  if (!gate.ok) return gate.response;

  const supabase = adminClient();
  const url = new URL(req.url);
  const qFrom = url.searchParams.get("from");
  const qTo = url.searchParams.get("to");

  const yesterday = new Date(Date.now() - 86400 * 1000).toISOString().slice(0, 10);
  const dateFrom = qFrom ?? yesterday;
  const dateTo = qTo ?? yesterday;

  const { data: logRow } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: { from: dateFrom, to: dateTo } })
    .select("id").single();
  const jobId: number = logRow?.id ?? 0;

  try {
    const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
    if (!token) throw new Error("WB_TOKEN_READ is not set");

    // 1) SKUs
    const { data: skus, error: skuErr } = await supabase
      .from("sku_catalog")
      .select("wb_article")
      .not("wb_article", "is", null);
    if (skuErr) throw new Error(`sku_catalog read: ${skuErr.message}`);
    const allNm = (skus ?? []).map((s: { wb_article: number }) => s.wb_article).filter(Boolean);
    if (allNm.length === 0) {
      await supabase.from("ingestion_log").update({
        status: "ok", finished_at: new Date().toISOString(), rows_in: 0, rows_out: 0,
        meta: { from: dateFrom, to: dateTo, note: "no nmIDs" },
      }).eq("id", jobId);
      return new Response(JSON.stringify({ ok: true, rows: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalRows = 0;
    let totalProducts = 0;
    let firstRaw: unknown = null;

    // 2) batches by PAGE size
    for (let i = 0; i < allNm.length; i += PAGE) {
      const batch = allNm.slice(i, i + PAGE);
      const body = {
        nmIds: batch,
        selectedPeriod: { start: dateFrom, end: dateTo },
        timezone: "Europe/Moscow",
        aggregationLevel: "day",
      };
      const resp = await fetch(`${WB_BASE}/api/analytics/v3/sales-funnel/products/history`, {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`WB funnel ${resp.status}: ${txt.slice(0, 500)}`);
      }
      const json = await resp.json();
      if (i === 0) firstRaw = json;
      // root shapes: array, {data:[...]}, {data:{products:[...]}}
      let products: FunnelProduct[] = [];
      if (Array.isArray(json)) {
        products = json as FunnelProduct[];
      } else {
        const root = (json as { data?: unknown }).data;
        if (Array.isArray(root)) products = root as FunnelProduct[];
        else if (root && typeof root === "object" && Array.isArray((root as { products?: unknown }).products)) {
          products = (root as { products: FunnelProduct[] }).products;
        }
      }
      totalProducts += products.length;

      const rows: Record<string, unknown>[] = [];
      for (const p of products) {
        const nm = p.product?.nmId ?? p.nmId;
        if (!nm) continue;
        for (const h of p.history ?? []) {
          const dt = (h.date ?? h.dt ?? "").slice(0, 10);
          if (!dt) continue;
          rows.push({
            nm_id: nm,
            dt,
            open_count: toInt(h.openCount),
            add_to_cart_count: toInt(h.cartCount ?? h.addToCartCount),
            order_count: toInt(h.orderCount),
            order_sum: toNum(h.orderSum),
            buyout_count: toInt(h.buyoutCount),
            buyout_sum: toNum(h.buyoutSum),
            cancel_count: toInt(h.cancelCount),
            cancel_sum: toNum(h.cancelSum),
            add_to_wishlist_count: toInt(h.addToWishlistCount),
            add_to_cart_conversion: toNum(h.addToCartConversion),
            cart_to_order_conversion: toNum(h.cartToOrderConversion),
            buyout_percent: toNum(h.buyoutPercent),
            fetched_at: new Date().toISOString(),
          });
        }
      }
      if (rows.length > 0) {
        const { error: upErr } = await supabase.from("wb_sales_funnel")
          .upsert(rows, { onConflict: "nm_id,dt" });
        if (upErr) throw new Error(`wb_sales_funnel upsert: ${upErr.message}`);
        totalRows += rows.length;
      }
      // WB rate limit funnel: 3 req/min — пауза 22 сек между батчами
      if (i + PAGE < allNm.length) await new Promise((r) => setTimeout(r, 22000));
    }

    await supabase.from("ingestion_log").update({
      status: "ok", finished_at: new Date().toISOString(),
      rows_in: totalProducts, rows_out: totalRows,
      meta: { from: dateFrom, to: dateTo, products: totalProducts, rows: totalRows,
              raw_sample: firstRaw && Array.isArray(firstRaw) ? (firstRaw as unknown[])[0] :
                          firstRaw && typeof firstRaw === "object" ? Object.keys(firstRaw as object) : null },
    }).eq("id", jobId);

    return new Response(JSON.stringify({ ok: true, products: totalProducts, rows: totalRows }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("ingestion_log").update({
      status: "error", finished_at: new Date().toISOString(), error_text: msg,
    }).eq("id", jobId);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
