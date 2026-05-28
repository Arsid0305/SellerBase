// fetch-wb-stocks — ежедневный фетч остатков с WB Statistics API.
// UPSERT в wb_stocks (текущий снапшот) + wb_stocks_history (снапшот дня).
// Лог в ingestion_log. Повторный запуск идемпотентен.

import { adminClient } from "../_shared/supabase.ts";
import { runJob } from "../_shared/ingestion.ts";
import { corsHeaders } from "../_shared/cors.ts";

const JOB_NAME = "fetch-wb-stocks";
const WB_BASE = "https://statistics-api.wildberries.ru";

interface WbStock {
  lastChangeDate: string;
  warehouseName: string;
  supplierArticle?: string;
  nmId: number;
  barcode: string;
  quantity: number;
  inWayToClient: number;
  inWayFromClient: number;
  isSupply?: boolean;
  isRealization?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = adminClient();
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const dateFrom = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const outcome = await runJob(supabase, JOB_NAME, { snapshot_date: snapshotDate, dateFrom }, async () => {
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
      throw new Error(`WB API returned non-array body: ${JSON.stringify(stocks).slice(0, 300)}`);
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

    return { rows_in: stocks.length, rows_out: stocksRows.length, result: { snapshot_date: snapshotDate } };
  });

  const status = outcome.ok ? 200 : 500;
  return new Response(JSON.stringify(outcome), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
