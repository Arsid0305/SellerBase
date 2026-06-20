// fetch-wb-sales — ежедневный фетч продаж из Statistics API.
// /api/v1/supplier/sales?dateFrom=YYYY-MM-DDThh:mm:ss
// Пагинация через lastChangeDate (берём max + 1 секунда). UPSERT по srid.
// Запуск: cron каждые 30 мин (см. миграцию 20260614_cron_fetch_wb_sales.sql).
//
// Запуск: cron каждые 30 мин. dateFrom = max(last_change_date) - 1 час (overlap),
// либо ?days=N для бэкфилла.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { adminClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { wbGet, batchUpsert } from "../_shared/wb-client.ts";

const JOB_NAME = "fetch-wb-sales";
const WB_BASE = "https://statistics-api.wildberries.ru";
const MAX_LOOPS = 30; // защита от бесконечного цикла
const FULL_PAGE_THRESHOLD = 80000; // если страница меньше — данных больше нет

interface WbSaleRow {
  date: string;
  lastChangeDate: string;
  warehouseName?: string;
  countryName?: string;
  oblastOkrugName?: string;
  regionName?: string;
  supplierArticle?: string;
  nmId: number;
  barcode?: string;
  category?: string;
  subject?: string;
  brand?: string;
  techSize?: string;
  incomeID?: number;
  isSupply?: boolean;
  isRealization?: boolean;
  totalPrice?: number;
  discountPercent?: number;
  spp?: number;
  paymentSaleAmount?: number;
  forPay?: number;
  finishedPrice?: number;
  priceWithDisc?: number;
  saleID?: string;
  orderType?: string;
  sticker?: string;
  gNumber?: string;
  srid: string;
  [k: string]: unknown;
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

async function fetchPage(token: string, dateFrom: string): Promise<WbSaleRow[]> {
  const url = `${WB_BASE}/api/v1/supplier/sales?dateFrom=${encodeURIComponent(dateFrom)}`;
  const data = await wbGet(url, token);
  return Array.isArray(data) ? (data as WbSaleRow[]) : [];
}

async function run(supabase: SupabaseClient, jobId: number, dateFromStart: string) {
  const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
  if (!token) throw new Error("WB_TOKEN_READ / WB_API_TOKEN not set");

  let dateFrom = dateFromStart;
  let totalIn = 0;
  let totalOut = 0;
  const seen = new Set<string>();

  for (let loop = 0; loop < MAX_LOOPS; loop++) {
    const rows = await fetchPage(token, dateFrom);
    if (rows.length === 0) break;
    totalIn += rows.length;

    const uniqueRows: WbSaleRow[] = [];
    for (const r of rows) {
      if (r.srid && !seen.has(r.srid)) {
        seen.add(r.srid);
        uniqueRows.push(r);
      }
    }
    const dbRows = uniqueRows.map((r) => {
      const saleId = r.saleID ?? null;
      const isStorno = typeof saleId === "string" && saleId.startsWith("R");
      return {
        srid: r.srid,
        sale_id: saleId,
        sale_dt: dateOnly(r.date),
        sale_ts: r.date,
        last_change_date: r.lastChangeDate,
        nm_id: r.nmId,
        barcode: r.barcode ?? null,
        supplier_article: r.supplierArticle ?? null,
        tech_size: r.techSize ?? null,
        brand: r.brand ?? null,
        subject: r.subject ?? null,
        category: r.category ?? null,
        finished_price: toNum(r.finishedPrice),
        for_pay: toNum(r.forPay),
        price_with_disc: toNum(r.priceWithDisc),
        total_price: toNum(r.totalPrice),
        discount_percent: toNum(r.discountPercent),
        spp_percent: toNum(r.spp),
        is_storno: isStorno,
        warehouse_name: r.warehouseName ?? null,
        office_name: r.oblastOkrugName ?? null,
        region_name: r.regionName ?? null,
        country_name: r.countryName ?? null,
        raw: r,
        updated_at: new Date().toISOString(),
      };
    });

    if (dbRows.length > 0) {
      await batchUpsert(supabase, "wb_sales_fact", dbRows, { onConflict: "srid", batchSize: 1000 });
      totalOut += dbRows.length;
    }

    // Курсор: max(lastChangeDate). Если страница < 80k — следующая будет пустой.
    let maxLast = dateFrom;
    for (const r of rows) {
      if (r.lastChangeDate && r.lastChangeDate > maxLast) maxLast = r.lastChangeDate;
    }
    if (maxLast === dateFrom || rows.length < FULL_PAGE_THRESHOLD) break;
    // следующий dateFrom = maxLast + 1 сек
    const t = new Date(maxLast);
    t.setSeconds(t.getSeconds() + 1);
    dateFrom = t.toISOString().replace(/\.\d{3}Z$/, "");

    // мягкая пауза
    await new Promise((r) => setTimeout(r, 1000));
  }

  await supabase
    .from("ingestion_log")
    .update({
      status: "ok",
      finished_at: new Date().toISOString(),
      rows_in: totalIn,
      rows_out: totalOut,
      meta: { dateFromStart },
    })
    .eq("id", jobId);

  return { totalIn, totalOut };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = adminClient();
  const { data: logRow, error: logErr } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: {} })
    .select("id")
    .single();
  if (logErr || !logRow) {
    return new Response(JSON.stringify({ error: `init ingestion_log: ${logErr?.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const jobId = logRow.id;

  try {
    const url = new URL(req.url);
    const daysParam = url.searchParams.get("days");
    const days = daysParam ? Math.max(1, Math.min(90, parseInt(daysParam, 10))) : null;

    let dateFromStart: string;
    if (days) {
      const d = new Date(Date.now() - days * 86_400_000);
      dateFromStart = d.toISOString().replace(/\.\d{3}Z$/, "");
    } else {
      // инкрементально: max(last_change_date) - 1 час overlap, иначе 7 дней назад
      const { data } = await supabase
        .from("wb_sales_fact")
        .select("last_change_date")
        .order("last_change_date", { ascending: false })
        .limit(1)
        .single();
      if (data?.last_change_date) {
        const t = new Date(data.last_change_date);
        t.setHours(t.getHours() - 1);
        dateFromStart = t.toISOString().replace(/\.\d{3}Z$/, "");
      } else {
        const t = new Date(Date.now() - 7 * 86_400_000);
        dateFromStart = t.toISOString().replace(/\.\d{3}Z$/, "");
      }
    }

    const result = await run(supabase, jobId, dateFromStart);
    return new Response(JSON.stringify({ ok: true, ...result, dateFromStart }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("ingestion_log")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error: msg,
      })
      .eq("id", jobId);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
