// fetch-wb-orders — фетч заказов из Statistics API.
// /api/v1/supplier/orders?dateFrom=YYYY-MM-DDThh:mm:ss
// Пагинация через lastChangeDate (берём max + 1 секунда). UPSERT по (g_number, date).
// Запуск: cron каждые 30 мин (см. миграцию 20260619120002_cron_fetch_wb_orders.sql).
//
// dateFrom = max(last_change_date) - 1 час (overlap), либо ?days=N для бэкфилла.
//
// 05.09.2026 закрыты три дыры, найденные аудитом:
//   1) не было checkCronSecret — функцию мог дёрнуть любой, у кого есть JWT;
//   2) не было advisory-lock: cron ходит каждые 30 минут, а бэкфилл на 90 дней
//      идёт дольше — два прогона наслаивались и писали одно и то же;
//   3) в catch запись шла в колонку `error`, которой в ingestion_log нет
//      (там `error_text`). Обновление падало, задание оставалось в статусе
//      running — те самые «зависла, закрыта уборщиком» в журнале.
// Теперь журнал и блокировку ведёт runJob из _shared/ingestion.ts.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { paginateByLastChangeDate, wbGet } from "../_shared/wb-client.ts";
import { checkCronSecret } from "../_shared/auth.ts";
import { runJob } from "../_shared/ingestion.ts";

const JOB_NAME = "fetch-wb-orders";
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

interface WbOrderRow {
  gNumber: string;
  date: string;
  lastChangeDate: string;
  warehouseName?: string;
  nmId: number;
  subject?: string;
  category?: string;
  brand?: string;
  techSize?: string;
  barcode?: string;
  totalPrice?: number;
  discountPercent?: number;
  spp?: number;
  priceWithDisc?: number;
  finishedPrice?: number;
  forPay?: number;
  oblast?: string;
  countryName?: string;
  incomeID?: number;
  number?: string;
  isSupply?: boolean;
  isRealization?: boolean;
  isCancel?: boolean;
  cancel_dt?: string;
  [k: string]: unknown;
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

async function upsertInBatches(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("wb_orders_fact")
      .upsert(chunk, { onConflict: "g_number,date", ignoreDuplicates: false });
    if (error) throw new Error(`upsert wb_orders_fact failed: ${error.message}`);
  }
}

/** С какой даты тянуть: инкрементально от последней записи или ?days=N. */
async function resolveDateFrom(supabase: SupabaseClient, days: number | null): Promise<string> {
  if (days) {
    const d = new Date(Date.now() - days * 86_400_000);
    return d.toISOString().replace(/\.\d{3}Z$/, "");
  }
  // инкрементально: max(last_change_date) - 1 час overlap, иначе 7 дней назад
  const { data } = await supabase
    .from("wb_orders_fact")
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

async function run(supabase: SupabaseClient, dateFromStart: string) {
  const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
  if (!token) throw new Error("WB_TOKEN_READ / WB_API_TOKEN not set");

  let totalOut = 0;

  const { totalSeen, pages } = await paginateByLastChangeDate<WbOrderRow>({
    initialDateFrom: dateFromStart,
    pageLimit: 80_000,
    maxPages: MAX_LOOPS,
    fetchPage: async (dateFrom) => {
      const url = `${WB_BASE}/api/v1/supplier/orders?dateFrom=${encodeURIComponent(dateFrom)}`;
      const data = await wbGet(url, token);
      return Array.isArray(data) ? (data as WbOrderRow[]) : [];
    },
    getLastChangeDate: (r) => r.lastChangeDate,
    getDedupKey: (r) => (r.gNumber && r.date ? `${r.gNumber}|${r.date}` : ""),
    onPage: async (uniqueRows) => {
      const dbRows = uniqueRows.map((r) => ({
        g_number: r.gNumber,
        date: r.date,
        last_change_date: r.lastChangeDate,
        warehouse_name: r.warehouseName ?? null,
        nm_id: r.nmId,
        subject: r.subject ?? null,
        category: r.category ?? null,
        brand: r.brand ?? null,
        tech_size: r.techSize ?? null,
        barcode: r.barcode ?? null,
        total_price: toNum(r.totalPrice),
        discount_percent: toNum(r.discountPercent),
        spp: toNum(r.spp),
        price_with_disc: toNum(r.priceWithDisc),
        finished_price: toNum(r.finishedPrice),
        for_pay: toNum(r.forPay),
        oblast: r.oblast ?? null,
        country_name: r.countryName ?? null,
        income_id: r.incomeID ?? null,
        number: r.number ?? null,
        is_supply: r.isSupply ?? null,
        is_realization: r.isRealization ?? null,
        is_cancel: r.isCancel ?? false,
        cancel_dt: r.cancel_dt && r.cancel_dt.length > 0 ? r.cancel_dt : null,
        fetched_at: new Date().toISOString(),
      }));
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
