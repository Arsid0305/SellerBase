// fetch-wb-supplies — фетч приёмок (поставок) FBW из Statistics API.
// /api/v1/supplier/incomes?dateFrom=YYYY-MM-DDThh:mm:ss
// Одна строка = один barcode в одной поставке (incomeId).
// UPSERT по (income_id, barcode). Пагинация через lastChangeDate (как в orders/sales).
// Запуск: cron раз в 6 часов (см. миграцию).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-wb-supplies";
const WB_BASE = "https://statistics-api.wildberries.ru";
const BATCH_SIZE = 1000;
const MAX_LOOPS = 30;
const DEFAULT_DAYS = 90;

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

interface WbIncomeRow {
  incomeId: number;
  number: string;
  date: string;
  lastChangeDate: string;
  supplierArticle?: string;
  techSize?: string;
  barcode?: string;
  quantity: number;
  totalPrice?: number;
  dateClose?: string;
  warehouseName?: string;
  nmId?: number;
  status?: string;
}

async function fetchPage(token: string, dateFrom: string): Promise<WbIncomeRow[]> {
  const url = `${WB_BASE}/api/v1/supplier/incomes?dateFrom=${encodeURIComponent(dateFrom)}`;
  const resp = await fetch(url, { headers: { Authorization: token } });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`WB incomes ${resp.status}: ${text.slice(0, 500)}`);
  }
  const json = await resp.json();
  if (!Array.isArray(json)) {
    throw new Error(`WB incomes returned non-array: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json as WbIncomeRow[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronCheck = checkCronSecret(req);
  if (!cronCheck.ok) return cronCheck.response;

  const supabase = adminClient();
  const url = new URL(req.url);
  const daysParam = Number(url.searchParams.get("days"));
  const lookbackDays = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : DEFAULT_DAYS;

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
    if (!token) throw new Error("WB_TOKEN_READ is not set in function secrets");

    const startDate = new Date(Date.now() - lookbackDays * 86_400_000);
    let cursor = startDate.toISOString();
    let totalUpserted = 0;
    let loops = 0;
    const seenIncomeIds = new Set<number>();

    while (loops < MAX_LOOPS) {
      loops += 1;
      const rows = await fetchPage(token, cursor);
      if (rows.length === 0) break;

      const upsertRows = rows
        .filter((r) => r.incomeId && r.barcode)
        .map((r) => ({
          income_id: r.incomeId,
          number: r.number ?? null,
          date: r.date,
          last_change_date: r.lastChangeDate,
          supplier_article: r.supplierArticle ?? null,
          tech_size: r.techSize ?? null,
          barcode: r.barcode!,
          quantity: r.quantity ?? 0,
          total_price: r.totalPrice ?? null,
          date_close: r.dateClose ?? null,
          warehouse_name: r.warehouseName ?? null,
          nm_id: r.nmId ?? null,
          status: r.status ?? null,
          fetched_at: new Date().toISOString(),
        }));

      if (upsertRows.length > 0) {
        const { error } = await supabase
          .from("wb_supplies_fact")
          .upsert(upsertRows, { onConflict: "income_id,barcode" });
        if (error) throw new Error(`wb_supplies_fact upsert: ${error.message}`);
        totalUpserted += upsertRows.length;
        for (const r of rows) if (r.incomeId) seenIncomeIds.add(r.incomeId);
      }

      // Пагинация: max(lastChangeDate) + 1 сек, как в orders/sales.
      if (rows.length < BATCH_SIZE) break;
      const maxLcd = rows.reduce((acc, r) => (r.lastChangeDate > acc ? r.lastChangeDate : acc), cursor);
      if (maxLcd === cursor) break;
      const nextDate = new Date(new Date(maxLcd).getTime() + 1000);
      cursor = nextDate.toISOString();
    }

    await supabase
      .from("ingestion_log")
      .update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_in: totalUpserted,
        rows_out: totalUpserted,
        meta: { lookback_days: lookbackDays, unique_supplies: seenIncomeIds.size, loops },
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({ ok: true, rows: totalUpserted, supplies: seenIncomeIds.size }),
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
