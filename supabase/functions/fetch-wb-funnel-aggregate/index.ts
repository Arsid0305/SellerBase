// fetch-wb-funnel-aggregate — суммарная воронка за период (без разбивки по дням).
// WB: POST /api/analytics/v3/sales-funnel/products
// Запись результата в ingestion_log.meta для теста, потом решим как хранить.

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = adminClient();
  const url = new URL(req.url);
  const qFrom = url.searchParams.get("from");
  const qTo = url.searchParams.get("to");

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString().slice(0, 10);
  const dateFrom = qFrom ?? monthAgo;
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

    let firstRaw: unknown = null;
    let totalProducts = 0;

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
      if (i === 0) firstRaw = json;
      const arr = Array.isArray(json) ? json
        : Array.isArray((json as { data?: unknown[] })?.data) ? (json as { data: unknown[] }).data
        : Array.isArray((json as { data?: { products?: unknown[] } })?.data?.products) ? (json as { data: { products: unknown[] } }).data.products
        : [];
      totalProducts += arr.length;
      if (i + PAGE < allNm.length) await new Promise((r) => setTimeout(r, 22000));
    }

    await supabase.from("ingestion_log").update({
      status: "ok", finished_at: new Date().toISOString(),
      rows_in: totalProducts, rows_out: 0,
      meta: { from: dateFrom, to: dateTo, products: totalProducts, raw_sample: firstRaw },
    }).eq("id", jobId);

    return new Response(JSON.stringify({ ok: true, products: totalProducts }), {
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
