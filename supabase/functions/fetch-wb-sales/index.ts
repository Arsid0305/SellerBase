// fetch-wb-sales — ежедневный фетч продаж из Statistics API.
// /api/v1/supplier/sales?dateFrom=YYYY-MM-DDThh:mm:ss
// Пагинация через lastChangeDate (берём max + 1 секунда). UPSERT по srid.
// Запуск: cron каждые 30 мин (см. миграцию 20260614_cron_fetch_wb_sales.sql).
//
// Запуск: cron каждые 30 мин. dateFrom = max(last_change_date) - 1 час (overlap),
// либо ?days=N для бэкфилла.
//
// 05.09.2026 закрыты три дыры, найденные аудитом:
//   1) не было checkCronSecret;
//   2) не было advisory-lock: cron ходит каждые 30 минут, бэкфилл идёт дольше —
//      прогоны наслаивались;
//   3) в catch запись шла в колонку `error`, которой в ingestion_log нет (там
//      `error_text`). Обновление падало, задание оставалось в статусе running —
//      отсюда «зависла, закрыта уборщиком» в журнале.
// Журнал и блокировку ведёт runJob из _shared/ingestion.ts.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { paginateByLastChangeDate, wbGet } from "../_shared/wb-client.ts";
import { checkCronSecret } from "../_shared/auth.ts";
import { runJob } from "../_shared/ingestion.ts";

const JOB_NAME = "fetch-wb-sales";
const WB_BASE = "https://statistics-api.wildberries.ru";
const BATCH_SIZE = 1000;
const MAX_LOOPS = 30; // защита от бесконечного цикла

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

async function upsertInBatches(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("wb_sales_fact")
      .upsert(chunk, { onConflict: "srid", ignoreDuplicates: false });
    if (error) throw new Error(`upsert wb_sales_fact failed: ${error.message}`);
  }
}

async function run(supabase: SupabaseClient, dateFromStart: string) {
  const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
  if (!token) throw new Error("WB_TOKEN_READ / WB_API_TOKEN not set");

  let totalOut = 0;

  const { totalSeen, pages } = await paginateByLastChangeDate<WbSaleRow>({
    initialDateFrom: dateFromStart,
    pageLimit: 80_000,
    maxPages: MAX_LOOPS,
    fetchPage: async (dateFrom) => {
      const url = `${WB_BASE}/api/v1/supplier/sales?dateFrom=${encodeURIComponent(dateFrom)}`;
      const data = await wbGet(url, token);
      return Array.isArray(data) ? (data as WbSaleRow[]) : [];
    },
    getLastChangeDate: (r) => r.lastChangeDate,
    getDedupKey: (r) => r.srid,
    onPage: async (uniqueRows) => {
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
        await upsertInBatches(supabase, dbRows);
        totalOut += dbRows.length;
      }
      // мягкая пауза между страницами
      await new Promise((r) => setTimeout(r, 1000));
    },
  });

  return { totalIn: totalSeen, totalOut, pages };
}

/** С какой даты тянуть: инкрементально от последней записи или ?days=N. */
async function resolveDateFrom(supabase: SupabaseClient, days: number | null): Promise<string> {
  if (days) {
    const d = new Date(Date.now() - days * 86_400_000);
    return d.toISOString().replace(/\.\d{3}Z$/, "");
  }
  const { data } = await supabase
    .from("wb_sales_fact")
    .select("last_change_date")
    .order("last_change_date", { ascending: false })
    .limit(1)
    .single();
  if (data?.last_change_date) {
    const t = new Date(data.last_change_date);
    t.setHours(t.getHours() - 1);
    return t.toISOString().replace(/\.\d{3}Z$/, "");
  }
  const t = new Date(Date.now() - 7 * 86_400_000);
  return t.toISOString().replace(/\.\d{3}Z$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cron = checkCronSecret(req);
  if (!cron.ok) return cron.response;

  const supabase = adminClient();
  const url = new URL(req.url);
  const daysParam = url.searchParams.get("days");
  const days = daysParam ? Math.max(1, Math.min(90, parseInt(daysParam, 10))) : null;

  const outcome = await runJob(supabase, JOB_NAME, { days }, async () => {
    const dateFromStart = await resolveDateFrom(supabase, days);
    const { totalIn, totalOut, pages } = await run(supabase, dateFromStart);
    return {
      rows_in: totalIn,
      rows_out: totalOut,
      result: { dateFromStart, pages, totalIn, totalOut },
    };
  });

  if (outcome.skipped) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "предыдущий прогон ещё идёт" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!outcome.ok) {
    return new Response(JSON.stringify({ ok: false, error: outcome.error }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true, ...outcome.result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
