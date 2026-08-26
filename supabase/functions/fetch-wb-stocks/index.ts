// fetch-wb-stocks — ежедневный фетч остатков с WB Seller Analytics API.
// Миграция 2026-06-15: старый /api/v1/supplier/stocks отключается WB 23.06.2026.
// Новый endpoint: POST /api/v1/warehouse_remains (асинхронный отчёт, polling статуса).
// Категория токена: Аналитика (WB_TOKEN_READ).
// Лимит: 1 запрос на отчёт в минуту, готовится 5-30 мин, живёт 4 часа.
// UPSERT в wb_stocks (текущий снапшот) + wb_stocks_history (снапшот дня). Идемпотентен.
//
// 2026-08-26: WB отдаёт служебные строки вперемешку со складами, и раньше мы принимали
// их за склады — итог `Всего находится на складах` складывался со складами, которые он
// уже просуммировал. Теперь строки классифицируются по справочнику wb_stock_service_rows:
// склады идут в wb_stocks, товар в пути — в wb_stocks_in_transit, итоги и свёртки
// отбрасываются. Плюс wb_stocks чистится от прошлого прогона: отчёт приходит целиком,
// поэтому склад, которого в нём нет, остатка не имеет. В wb_stocks_history пишем всё
// как пришло — это первоисточник, считать по нему через v_wb_stocks_history_clean.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

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

type ServiceKind = "total" | "in_transit_to_client" | "in_transit_from_client" | "aggregate";

/**
 * Справочник служебных строк. Читаем из базы, а не держим списком в коде: тот же
 * справочник использует v_wb_stocks_history_clean, и разойтись они не должны.
 * Пустой ответ — ошибка, а не «фильтровать нечего»: молча записать неотфильтрованное
 * и есть тот баг, ради которого всё это.
 */
async function loadServiceRows(supabase: SupabaseClient): Promise<Map<string, ServiceKind>> {
  const { data, error } = await supabase
    .from("wb_stock_service_rows")
    .select("warehouse_name, kind");
  if (error) throw new Error(`wb_stock_service_rows: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("wb_stock_service_rows пуст — без справочника приём остатков небезопасен");
  }
  return new Map(data.map((r) => [r.warehouse_name as string, r.kind as ServiceKind]));
}

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

  const gate = checkCronSecret(req);
  if (!gate.ok) return gate.response;

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

    // Историю пишем как есть, в wb_stocks — только настоящие склады.
    const historyRows: Array<{
      snapshot_date: string;
      barcode: string;
      nm_id: number | null;
      warehouse_name: string;
      quantity: number;
      in_way_to_client: number;
      in_way_from_client: number;
    }> = [];

    const inTransitByBarcode = new Map<
      string,
      { barcode: string; nm_id: number | null; to_client: number; from_client: number; fetched_at: string }
    >();

    const serviceRows = await loadServiceRows(supabase);
    const skippedByKind: Record<string, number> = {};

    const fetchedAt = new Date().toISOString();
    for (const r of report) {
      if (!r.barcode || !Array.isArray(r.warehouses)) continue;
      const barcode = String(r.barcode);
      const nmId = r.nmId ?? null;
      // Поля WB inWayToClient / inWayFromClient с августа 2026 приходят нулями —
      // товар в пути виден только в служебных строках. Значения всё равно кладём
      // в историю: если WB начнёт их заполнять снова, данные не потеряются.
      const inWayToClient = num(r.inWayToClient);
      const inWayFromClient = num(r.inWayFromClient);

      for (const w of r.warehouses) {
        if (!w?.warehouseName) continue;
        const quantity = num(w.quantity);

        historyRows.push({
          snapshot_date: snapshotDate,
          barcode,
          nm_id: nmId,
          warehouse_name: w.warehouseName,
          quantity,
          in_way_to_client: inWayToClient,
          in_way_from_client: inWayFromClient,
        });

        const kind = serviceRows.get(w.warehouseName);
        if (kind) {
          skippedByKind[kind] = (skippedByKind[kind] ?? 0) + 1;
          if (kind === "in_transit_to_client" || kind === "in_transit_from_client") {
            const entry = inTransitByBarcode.get(barcode) ??
              { barcode, nm_id: nmId, to_client: 0, from_client: 0, fetched_at: fetchedAt };
            if (kind === "in_transit_to_client") entry.to_client += quantity;
            else entry.from_client += quantity;
            inTransitByBarcode.set(barcode, entry);
          }
          continue; // итоги и свёртки не сохраняем нигде, кроме истории
        }

        stocksRows.push({
          barcode,
          nm_id: nmId,
          warehouse_name: w.warehouseName,
          quantity,
          in_way_to_client: inWayToClient,
          in_way_from_client: inWayFromClient,
          last_change_date: null,
          fetched_at: fetchedAt,
        });
      }
    }

    if (historyRows.length > 0) {
      const { error: histErr } = await supabase
        .from("wb_stocks_history")
        .upsert(historyRows, { onConflict: "snapshot_date,barcode,warehouse_name" });
      if (histErr) throw new Error(`wb_stocks_history upsert: ${histErr.message}`);
    }

    if (stocksRows.length > 0) {
      const { error: upsertErr } = await supabase
        .from("wb_stocks")
        .upsert(stocksRows, { onConflict: "barcode,warehouse_name" });
      if (upsertErr) throw new Error(`wb_stocks upsert: ${upsertErr.message}`);

      // Отчёт приходит целиком, поэтому склад, которого в нём нет, остатка не имеет.
      // Без этого строки закрытых складов оставались навсегда: на 26.08 таблица
      // держала 27 860 штук при 8 019 настоящих.
      const { error: pruneErr } = await supabase
        .from("wb_stocks")
        .delete()
        .lt("fetched_at", fetchedAt);
      if (pruneErr) throw new Error(`wb_stocks prune: ${pruneErr.message}`);
    }

    // Чистим только по живому отчёту. Пустой отчёт (WB отдал ноль строк) не повод
    // обнулять таблицы — это та же ошибка, что принять служебную строку за склад,
    // только в другую сторону.
    const inTransitRows = [...inTransitByBarcode.values()];
    if (stocksRows.length > 0) {
      if (inTransitRows.length > 0) {
        const { error: transitErr } = await supabase
          .from("wb_stocks_in_transit")
          .upsert(inTransitRows, { onConflict: "barcode" });
        if (transitErr) throw new Error(`wb_stocks_in_transit upsert: ${transitErr.message}`);
      }
      const { error: transitPruneErr } = await supabase
        .from("wb_stocks_in_transit")
        .delete()
        .lt("fetched_at", fetchedAt);
      if (transitPruneErr) throw new Error(`wb_stocks_in_transit prune: ${transitPruneErr.message}`);
    }

    await supabase
      .from("ingestion_log")
      .update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_in: report.length,
        rows_out: stocksRows.length,
        meta: {
          snapshot_date: snapshotDate,
          task_id: taskId,
          history_rows: historyRows.length,
          in_transit_barcodes: inTransitRows.length,
          skipped_service_rows: skippedByKind,
        },
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({
        ok: true,
        rows: stocksRows.length,
        in_transit_barcodes: inTransitRows.length,
        skipped_service_rows: skippedByKind,
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
