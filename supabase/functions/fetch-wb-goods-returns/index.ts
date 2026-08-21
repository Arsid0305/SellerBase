// fetch-wb-goods-returns — поэвентный лог возвратов товаров от покупателей.
// WB API: GET /api/v1/analytics/goods-return (seller-analytics-api.wildberries.ru)
// Категория токена: Аналитика (WB_TOKEN_READ).
// Лимит: одно окно запроса <= 31 день. Дефолт: последние 30 дней.
// ?from=YYYY-MM-DD&to=YYYY-MM-DD — произвольный период (бьётся на 31-дневные окна).
// UPSERT в wb_goods_returns_events по srid. Идемпотентен.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-wb-goods-returns";
const WB_BASE = "https://seller-analytics-api.wildberries.ru";
const WINDOW_DAYS = 31;
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

// ASSUMPTION: точная схема ответа WB /api/v1/analytics/goods-return публично не задокументирована
// в стабильном виде (dev.wildberries.ru возвращает 403 для скрапинга). Берём наиболее частые
// camelCase-имена полей из WB API. Парсер устойчив к их отсутствию: всё в raw JSONB.
interface WbReturnRow {
  srid?: string;
  srId?: string;
  nmId?: number;
  nmID?: number;
  supplierArticle?: string;
  barcode?: string;
  reasonCode?: string;
  reason?: string;
  reasonText?: string;
  returnDate?: string;
  date?: string;
  status?: string;
  // Формат seller-analytics-api на 2026-08: причина приходит в returnType,
  // reason при этом пустой; даты — completedDt / readyToReturnDt / orderDt.
  returnType?: string;
  completedDt?: string;
  readyToReturnDt?: string;
  orderDt?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchWindow(token: string, dateFrom: string, dateTo: string): Promise<{ rows: WbReturnRow[]; raw: unknown }> {
  const url = `${WB_BASE}/api/v1/analytics/goods-return`
    + `?dateFrom=${encodeURIComponent(dateFrom)}`
    + `&dateTo=${encodeURIComponent(dateTo)}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: { Authorization: token },
  });
  if (resp.status === 429) {
    await sleep(RATE_DELAY_MS);
    return fetchWindow(token, dateFrom, dateTo);
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`WB API ${resp.status}: ${text.slice(0, 500)}`);
  }
  const json = await resp.json();
  // root shapes: array | {data:[...]} | {data:{returns:[...]}} | {report:[...]}
  let rows: WbReturnRow[] = [];
  if (Array.isArray(json)) {
    rows = json as WbReturnRow[];
  } else if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.data)) rows = obj.data as WbReturnRow[];
    else if (obj.data && typeof obj.data === "object"
      && Array.isArray((obj.data as { returns?: unknown }).returns)) {
      rows = (obj.data as { returns: WbReturnRow[] }).returns;
    } else if (Array.isArray(obj.report)) rows = obj.report as WbReturnRow[];
  }
  return { rows, raw: json };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const gate = checkCronSecret(req);
  if (!gate.ok) return gate.response;

  const supabase = adminClient();
  const url = new URL(req.url);
  const qFrom = url.searchParams.get("from");
  const qTo = url.searchParams.get("to");

  const today = new Date();
  const defaultFrom = new Date(today.getTime() - 30 * 86400 * 1000);
  const dateFrom = qFrom ?? toIsoDate(defaultFrom);
  const dateTo = qTo ?? toIsoDate(today);

  const { data: logRow, error: insErr } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: { from: dateFrom, to: dateTo } })
    .select("id")
    .single();
  if (insErr || !logRow) {
    return new Response(
      JSON.stringify({ ok: false, error: `ingestion_log open: ${insErr?.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const jobId: number = logRow.id;

  try {
    const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
    if (!token) throw new Error("WB_TOKEN_READ is not set");

    // Bить период на окна по WINDOW_DAYS
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    const allRows: WbReturnRow[] = [];
    let firstRaw: unknown = null;
    let windows = 0;

    let cursor = new Date(start);
    while (cursor <= end) {
      const winEnd = new Date(Math.min(
        cursor.getTime() + (WINDOW_DAYS - 1) * 86400 * 1000,
        end.getTime(),
      ));
      const { rows, raw } = await fetchWindow(token, toIsoDate(cursor), toIsoDate(winEnd));
      if (windows === 0) firstRaw = raw;
      windows++;
      allRows.push(...rows);
      cursor = new Date(winEnd.getTime() + 86400 * 1000);
      if (cursor <= end) await sleep(RATE_DELAY_MS);
    }

    const nowIso = new Date().toISOString();
    const upsertRows = allRows
      .map((r) => {
        const srid = r.srid ?? r.srId;
        if (!srid) return null;
        const firstFilled = (...vals: (string | undefined)[]) =>
          vals.find((v) => typeof v === "string" && v.trim() !== "") ?? null;
        const returnDate = firstFilled(r.returnDate, r.date, r.completedDt, r.readyToReturnDt, r.orderDt);
        return {
          srid: String(srid),
          nm_id: r.nmId ?? r.nmID ?? null,
          supplier_article: r.supplierArticle ?? null,
          barcode: r.barcode ?? null,
          reason_code: r.reasonCode ?? null,
          reason_text: firstFilled(r.reasonText, r.reason, r.returnType),
          return_date: returnDate,
          status: r.status ?? null,
          raw: r,
          fetched_at: nowIso,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (upsertRows.length > 0) {
      const { error: upErr } = await supabase
        .from("wb_goods_returns_events")
        .upsert(upsertRows, { onConflict: "srid" });
      if (upErr) throw new Error(`wb_goods_returns_events upsert: ${upErr.message}`);
    }

    await supabase
      .from("ingestion_log")
      .update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_in: allRows.length,
        rows_out: upsertRows.length,
        meta: {
          from: dateFrom,
          to: dateTo,
          windows,
          raw_sample_keys: firstRaw && typeof firstRaw === "object" && !Array.isArray(firstRaw)
            ? Object.keys(firstRaw as object) : Array.isArray(firstRaw) ? "array" : null,
        },
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({ ok: true, rows: upsertRows.length, raw_count: allRows.length, windows }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
