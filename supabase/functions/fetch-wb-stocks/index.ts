// fetch-wb-stocks — ежедневный фетч остатков с WB Analytics API.
// Endpoint: POST /api/analytics/v1/stocks-report/wb-warehouses (заменяет /api/v1/supplier/stocks, отключённый 23.06.2026).
// Категория токена: Аналитика (WB_TOKEN_READ).
// Лимит: 1 req / 20 c per seller, до 250 000 строк за ответ, offset-пагинация, sort by nmId ASC.
// UPSERT в wb_stocks (текущий снапшот) + wb_stocks_history (снапшот дня). Идемпотентен.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const JOB_NAME = "fetch-wb-stocks";
const WB_BASE = "https://seller-analytics-api.wildberries.ru";
const PAGE_LIMIT = 250_000;
const RATE_DELAY_MS = 21_000;

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

interface WbStockRow {
  nmId?: number;
  nmID?: number;
  chrtId?: number;
  chrtID?: number;
  barcode?: string;
  warehouseId?: number;
  warehouseName?: string;
  warehouseRegion?: string;
  quantity?: number;
  inWayToClient?: number;
  inWayFromClient?: number;
  lastChangeDate?: string;
}

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(token: string, offset: number): Promise<WbStockRow[]> {
  const url = `${WB_BASE}/api/analytics/v1/stocks-report/wb-warehouses`;
  const body = { limit: PAGE_LIMIT, offset };
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (resp.status === 429) {
    await sleep(RATE_DELAY_MS);
    return fetchPage(token, offset);
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`WB API ${resp.status}: ${text.slice(0, 500)}`);
  }
  const json = await resp.json();
  const rows = Array.isArray(json) ? json : json?.data ?? json?.rows ?? json?.items ?? [];
  if (!Array.isArray(rows)) {
    throw new Error(`WB API returned non-array payload: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return rows as WbStockRow[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = adminClient();
  const snapshotDate = new Date().toISOString().slice(0, 10);

  const { data: logRow, error: insErr } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: { snapshot_date: snapshotDate } })
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
    const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
    if (!token) throw new Error("WB_TOKEN_READ is not set in function secrets");

    const all: WbStockRow[] = [];
    let offset = 0;
    let pages = 0;
    while (true) {
      const page = await fetchPage(token, offset);
      pages++;
      all.push(...page);
      if (page.length < PAGE_LIMIT) break;
      offset += PAGE_LIMIT;
      await sleep(RATE_DELAY_MS);
    }

    const stocksRows = all
      .filter((s) => s.barcode && (s.warehouseName || s.warehouseId !== undefined))
      .map((s) => ({
        barcode: String(s.barcode),
        nm_id: s.nmId ?? s.nmID ?? null,
        warehouse_name: s.warehouseName ?? String(s.warehouseId),
        quantity: num(s.quantity),
        in_way_to_client: num(s.inWayToClient),
        in_way_from_client: num(s.inWayFromClient),
        last_change_date: s.lastChangeDate ?? null,
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
        rows_in: all.length,
        rows_out: stocksRows.length,
        meta: { snapshot_date: snapshotDate, pages, offset_final: offset },
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({
        ok: true,
        rows: stocksRows.length,
        pages,
        snapshot_date: snapshotDate,
      }),
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
