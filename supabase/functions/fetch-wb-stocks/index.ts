// fetch-wb-stocks — ежедневный фетч остатков с WB Statistics API.
// UPSERT в wb_stocks (текущий снапшот) + wb_stocks_history (снапшот дня).
// Лог в ingestion_log. Повторный запуск идемпотентен.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const JOB_NAME = "fetch-wb-stocks";
const WB_BASE = "https://statistics-api.wildberries.ru";

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

interface WbStock {
  lastChangeDate: string;
  warehouseName: string;
  supplierArticle?: string;
  nmId: number;
  barcode: string;
  quantity: number;
  inWayToClient: number;
  inWayFromClient: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = adminClient();
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const dateFrom = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: logRow, error: insErr } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: { snapshot_date: snapshotDate, dateFrom } })
    .select("id")
    .single();
  if (insErr || !logRow) {
    return new Response(
      JSON.stringify({ ok: false, error: `Failed to open ingestion_log: ${insErr?.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const jobId: number = logRow.id;

  try {
    const token = Deno.env.get("WB_API_TOKEN");
    if (!token) throw new Error("WB_API_TOKEN is not set in function secrets");

    const url = `${WB_BASE}/api/v1/supplier/stocks?dateFrom=${encodeURIComponent(dateFrom)}`;
    const resp = await fetch(url, { headers: { Authorization: token } });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`WB API ${resp.status}: ${body.slice(0, 500)}`);
    }
    const stocks: WbStock[] = await resp.json();

    if (!Array.isArray(stocks)) {
      throw new Error(`WB API returned non-array: ${JSON.stringify(stocks).slice(0, 300)}`);
    }

    const stocksRows = stocks.map((s) => ({
      barcode: String(s.barcode),
      nm_id: s.nmId,
      warehouse_name: s.warehouseName,
      quantity: s.quantity ?? 0,
      in_way_to_client: s.inWayToClient ?? 0,
      in_way_from_client: s.inWayFromClient ?? 0,
      last_change_date: s.lastChangeDate,
      fetched_at: new Date().toISOString(),
    }));

    if (stocksRows.length > 0) {
      const { error: upsertErr } = await supabase
        .from("wb_stocks")
        .upsert(stocksRows, { onConflict: "barcode,warehouse_name" });
      if (upsertErr) throw new Error(`wb_stocks upsert: ${upsertErr.message}`);

      const historyRows = stocksRows.map((s) => ({
        snapshot_date: snapshotDate,
        barcode: s.barcode,
        nm_id: s.nm_id,
        warehouse_name: s.warehouse_name,
        quantity: s.quantity,
        in_way_to_client: s.in_way_to_client,
        in_way_from_client: s.in_way_from_client,
      }));

      const { error: histErr } = await supabase
        .from("wb_stocks_history")
        .upsert(historyRows, { onConflict: "snapshot_date,barcode,warehouse_name" });
      if (histErr) throw new Error(`wb_stocks_history upsert: ${histErr.message}`);
    }

    await supabase
      .from("ingestion_log")
      .update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_in: stocks.length,
        rows_out: stocksRows.length,
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({ ok: true, rows: stocksRows.length, snapshot_date: snapshotDate }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("ingestion_log")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_text: message,
      })
      .eq("id", jobId);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
