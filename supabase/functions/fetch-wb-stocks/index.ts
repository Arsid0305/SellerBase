// fetch-wb-stocks — ежедневный фетч остатков с WB Seller Analytics API.
// Миграция 2026-06-15: старый /api/v1/supplier/stocks отключается WB 23.06.2026.
// Новый endpoint: POST /api/v1/warehouse_remains (асинхронный отчёт, polling статуса).
// Категория токена: Аналитика (WB_TOKEN_READ).
// Лимит: 1 запрос на отчёт в минуту, готовится 5-30 мин, живёт 4 часа.
// UPSERT в wb_stocks (текущий снапшот) + wb_stocks_history (снапшот дня). Идемпотентен.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const JOB_NAME = "fetch-wb-stocks";
const WB_BASE = "https://seller-analytics-api.wildberries.ru";
const POLL_INTERVAL_MS = 10_000;
const POLL_MAX_ATTEMPTS = 180; // 30 минут

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

interface WbWarehouseEntry {
  warehouseName: string;
  quantity: number;
}

interface WbRemainsRow {
  brand?: string;
  subjectName?: string;
  vendorCode?: string;
  nmId?: number;
  barcode?: string;
  techSize?: string;
  volume?: number;
  inWayToClient?: number;
  inWayFromClient?: number;
  quantityWarehousesFull?: number;
  warehouses?: WbWarehouseEntry[];
}

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function createReport(token: string): Promise<string> {
  // WB обновил API: вместо POST с телом теперь GET с query-параметрами.
  // Allow: GET, HEAD (старый POST возвращает 405 Method Not Allowed).
  const params = new URLSearchParams({
    locale: "ru",
    groupByBrand: "false",
    groupBySubject: "false",
    groupBySa: "false",
    groupByNm: "true",
    groupByBarcode: "true",
    groupBySize: "false",
    filterPics: "0",
    filterVolume: "0",
  });
  const url = `${WB_BASE}/api/v1/warehouse_remains?${params.toString()}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: { Authorization: token },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`WB create report ${resp.status}: ${text.slice(0, 500)}`);
  }
  const json = await resp.json();
  const taskId = json?.data?.taskId;
  if (!taskId) throw new Error(`WB create report: missing taskId in ${JSON.stringify(json).slice(0, 300)}`);
  return String(taskId);
}

async function pollStatus(token: string, taskId: string): Promise<void> {
  const url = `${WB_BASE}/api/v1/warehouse_remains/tasks/${taskId}/status`;
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const resp = await fetch(url, { headers: { Authorization: token } });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`WB status ${resp.status}: ${text.slice(0, 500)}`);
    }
    const json = await resp.json();
    const status = json?.data?.status ?? json?.status;
    if (status === "done") return;
    if (status === "purged" || status === "canceled") {
      throw new Error(`WB report ${taskId} terminated with status=${status}`);
    }
    // new / processing — continue polling
  }
  throw new Error(`WB report ${taskId} not ready after ${POLL_MAX_ATTEMPTS} attempts`);
}

async function downloadReport(token: string, taskId: string): Promise<WbRemainsRow[]> {
  const url = `${WB_BASE}/api/v1/warehouse_remains/tasks/${taskId}/download`;
  const resp = await fetch(url, { headers: { Authorization: token } });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`WB download ${resp.status}: ${text.slice(0, 500)}`);
  }
  const json = await resp.json();
  const rows = Array.isArray(json) ? json : json?.data ?? [];
  if (!Array.isArray(rows)) {
    throw new Error(`WB download returned non-array payload: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return rows as WbRemainsRow[];
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

    const taskId = await createReport(token);
    await pollStatus(token, taskId);
    const report = await downloadReport(token, taskId);

    const stocksRows: Array<{
      barcode: string;
      nm_id: number | null;
      warehouse_name: string;
      quantity: number;
      in_way_to_client: number;
      in_way_from_client: number;
      last_change_date: null;
      fetched_at: string;
    }> = [];

    const fetchedAt = new Date().toISOString();
    for (const r of report) {
      if (!r.barcode || !Array.isArray(r.warehouses)) continue;
      const nmId = r.nmId ?? null;
      const inWayToClient = num(r.inWayToClient);
      const inWayFromClient = num(r.inWayFromClient);
      for (const w of r.warehouses) {
        if (!w?.warehouseName) continue;
        stocksRows.push({
          barcode: String(r.barcode),
          nm_id: nmId,
          warehouse_name: w.warehouseName,
          quantity: num(w.quantity),
          in_way_to_client: inWayToClient,
          in_way_from_client: inWayFromClient,
          last_change_date: null,
          fetched_at: fetchedAt,
        });
      }
    }

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
        rows_in: report.length,
        rows_out: stocksRows.length,
        meta: { snapshot_date: snapshotDate, task_id: taskId },
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({
        ok: true,
        rows: stocksRows.length,
        task_id: taskId,
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
