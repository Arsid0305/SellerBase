// fetch-wb-report — еженедельный фетч отчёта о реализации (FBO).
// /api/v5/supplier/reportDetailByPeriod → wb_reports_fact_raw + wb_reports_fact.
// UPSERT по srid. Дедупликация в батче (WB может вернуть дубли).
// Пагинация через rrdid.
// Диапазон: от последней rr_dt в БД минус 7 дней (для перезаливки последней недели), или
// ?days=N в query (первый раз: ?days=60 для истории).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const JOB_NAME = "fetch-wb-report";
const WB_BASE = "https://statistics-api.wildberries.ru";
const PAGE_LIMIT = 100000;
const MAX_PAGES = 10;
const BATCH_SIZE = 1000;

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

interface WbReportRow {
  realizationreport_id: number;
  rrd_id: number;
  srid: string;
  nm_id: number;
  barcode?: string | number;
  sa_name?: string;
  doc_type_name?: string;
  supplier_oper_name?: string;
  bonus_type_name?: string;
  order_dt?: string;
  sale_dt?: string;
  rr_dt?: string;
  quantity?: number;
  retail_price?: number;
  retail_amount?: number;
  ppvz_for_pay?: number;
  delivery_rub?: number;
  ppvz_sales_commission?: number;
  ppvz_spp_prc?: number;
  commission_percent?: number;
  ppvz_kvw_prc?: number;
  ppvz_vw?: number;
  ppvz_vw_nds?: number;
  ppvz_reward?: number;
  acquiring_fee?: number;
  acquiring_percent?: number;
  storage_fee?: number;
  deduction?: number;
  rebill_logistic_cost?: number;
  penalty?: number;
  additional_payment?: number;
  office_name?: string;
  [k: string]: unknown;
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string | null {
  return v == null ? null : String(v);
}

async function upsertInBatches<T>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  onConflict: string,
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`${table} batch ${i}-${i + batch.length}: ${error.message}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = adminClient();
  const url = new URL(req.url);
  const lookbackDays = parseInt(url.searchParams.get("days") ?? "30", 10);

  const { data: logRow, error: insErr } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: { lookback_days: lookbackDays } })
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
    if (!token) throw new Error("WB_TOKEN_READ is not set");

    const qFrom = url.searchParams.get("from");
    const qTo = url.searchParams.get("to");

    let dateFrom: string;
    let dateTo: string;
    if (qFrom && qTo) {
      dateFrom = qFrom;
      dateTo = qTo;
    } else {
      const { data: latest } = await supabase
        .from("wb_reports_fact")
        .select("rr_dt")
        .order("rr_dt", { ascending: false })
        .limit(1)
        .maybeSingle();
      dateFrom = latest?.rr_dt
        ? new Date(new Date(latest.rr_dt).getTime() - 7 * 86400 * 1000).toISOString().slice(0, 10)
        : new Date(Date.now() - lookbackDays * 86400 * 1000).toISOString().slice(0, 10);
      dateTo = new Date().toISOString().slice(0, 10);
    }

    let totalIn = 0;
    let totalOut = 0;
    let rrdid = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      const apiUrl = `${WB_BASE}/api/v5/supplier/reportDetailByPeriod`
        + `?dateFrom=${dateFrom}`
        + `&dateTo=${dateTo}`
        + `&limit=${PAGE_LIMIT}`
        + `&rrdid=${rrdid}`;
      const resp = await fetch(apiUrl, { headers: { Authorization: token } });
      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`WB API ${resp.status} page=${page}: ${body.slice(0, 500)}`);
      }
      const rows: WbReportRow[] = await resp.json();
      if (!Array.isArray(rows)) {
        throw new Error(`WB API returned non-array page=${page}`);
      }
      if (rows.length === 0) break;
      totalIn += rows.length;

      const rawMap = new Map<number, { realizationreport_id: number; payload: WbReportRow }>();
      const factMap = new Map<number, Record<string, unknown>>();
      for (const r of rows) {
        if (!r.rrd_id) continue;
        rawMap.set(r.rrd_id, { realizationreport_id: r.realizationreport_id, payload: r });
        factMap.set(r.rrd_id, {
          rrd_id: r.rrd_id,
          srid: r.srid ?? null,
          realizationreport_id: r.realizationreport_id,
          nm_id: r.nm_id,
          barcode: r.barcode != null ? String(r.barcode) : null,
          sa_name: r.sa_name ?? null,
          doc_type_name: toStr(r.doc_type_name),
          supplier_oper_name: toStr(r.supplier_oper_name),
          bonus_type_name: toStr(r.bonus_type_name),
          order_dt: r.order_dt ?? null,
          sale_dt: r.sale_dt ?? null,
          rr_dt: r.rr_dt ?? null,
          quantity: r.quantity ?? null,
          retail_price: toNum(r.retail_price),
          retail_amount: toNum(r.retail_amount),
          ppvz_for_pay: toNum(r.ppvz_for_pay),
          delivery_rub: toNum(r.delivery_rub),
          commission_rub: toNum(r.ppvz_sales_commission),
          ppvz_sales_commission: toNum(r.ppvz_sales_commission),
          ppvz_spp_prc: toNum(r.ppvz_spp_prc),
          commission_percent: toNum(r.commission_percent),
          ppvz_kvw_prc: toNum(r.ppvz_kvw_prc),
          ppvz_vw: toNum(r.ppvz_vw),
          ppvz_vw_nds: toNum(r.ppvz_vw_nds),
          ppvz_reward: toNum(r.ppvz_reward),
          acquiring_fee: toNum(r.acquiring_fee),
          acquiring_percent: toNum(r.acquiring_percent),
          storage_fee: toNum(r.storage_fee),
          deduction: toNum(r.deduction),
          rebill_logistic_cost: toNum(r.rebill_logistic_cost),
          penalty: toNum(r.penalty),
          additional_payment: toNum(r.additional_payment),
          warehouse_name: r.office_name ?? null,
        });
      }

      await upsertInBatches(supabase, "wb_reports_fact_raw", Array.from(rawMap.values()), "rrd_id");
      await upsertInBatches(supabase, "wb_reports_fact", Array.from(factMap.values()), "rrd_id");
      totalOut += factMap.size;

      if (rows.length < PAGE_LIMIT) break;
      rrdid = rows[rows.length - 1].rrd_id;
    }

    await supabase
      .from("ingestion_log")
      .update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_in: totalIn,
        rows_out: totalOut,
        meta: { date_from: dateFrom, date_to: dateTo, lookback_days: lookbackDays },
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({ ok: true, rows_in: totalIn, rows_out: totalOut, date_from: dateFrom, date_to: dateTo }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("ingestion_log")
      .update({ status: "error", finished_at: new Date().toISOString(), error_text: message })
      .eq("id", jobId);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
