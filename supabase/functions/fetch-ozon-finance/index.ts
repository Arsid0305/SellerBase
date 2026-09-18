// fetch-ozon-finance — деньги Ozon: отчёт о реализации по месяцам.
// Шаг третий подключения Ozon, план — docs/integrations/OZON_PODKLYUCHENIE.md.
//
// Метод транзакций (v3/finance/transaction/list) Ozon погасил: отвечает
// «obsolete method cannot be used». Проверено перебором 17.09.2026: живой
// источник денег — v2/finance/realization, помесячный отчёт с разбивкой по
// товарам. Это прямой аналог отчёта реализации ВБ.
//
// Статьи держим по отдельности — комиссия, бонус, стандартная ставка,
// звёзды, софинансирование банка и ПВЗ, компенсация. Складывать их в одну
// «комиссию» нельзя, они разной природы.
//
// На площадку не пишет ничего: у ключа права «Admin read only».
//
// ?months=N — сколько месяцев назад забрать (по умолчанию 2: текущий и
// прошлый, потому что текущий ещё дозаполняется).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-ozon-finance";
const OZON_BASE = "https://api-seller.ozon.ru";
const PAUSE_MS = 700;

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

interface Commission {
  price_per_instance?: number;
  quantity?: number;
  amount?: number;
  compensation?: number;
  commission?: number;
  bonus?: number;
  standard_fee?: number;
  total?: number;
  stars?: number;
  bank_coinvestment?: number;
  pick_up_point_coinvestment?: number;
}

interface RealizationRow {
  rowNumber?: number;
  item?: { name?: string; offer_id?: string; barcode?: string; sku?: number };
  seller_price_per_instance?: number;
  commission_ratio?: number;
  delivery_commission?: Commission | null;
  return_commission?: Commission | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const gate = checkCronSecret(req);
  if (!gate.ok) return gate.response;

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const supabase = adminClient();
  const url = new URL(req.url);
  const months = Math.min(Math.max(Number(url.searchParams.get("months") ?? 2), 1), 24);

  const { data: logRow } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: { months } })
    .select("id")
    .single();
  const jobId: number | null = (logRow as { id: number } | null)?.id ?? null;

  try {
    const clientId = Deno.env.get("OZON_CLIENT_ID");
    const apiKey = Deno.env.get("OZON_API_KEY");
    if (!clientId || !apiKey) throw new Error("OZON_CLIENT_ID / OZON_API_KEY не заданы");
    const headers = {
      "Client-Id": clientId,
      "Api-Key": apiKey,
      "Content-Type": "application/json",
    };

    const now = new Date();
    const fetchedAt = new Date().toISOString();
    const perMonth: Record<string, number> = {};
    const errors: Record<string, string> = {};
    // Месяцы, у которых отчёта ещё нет - Ozon закрывает их числа пятого.
    const notReady: string[] = [];
    let written = 0;

    for (let back = 0; back < months; back += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, "0")}`;

      try {
        const resp = await fetch(`${OZON_BASE}/v2/finance/realization`, {
          method: "POST",
          headers,
          body: JSON.stringify({ month, year }),
        });
        const text = await resp.text();
        if (!resp.ok) {
          // Текущий месяц Ozon отдаёт только после закрытия: до этого
          // «Report was not found». Это не сбой, и раз задание ходит каждый
          // день, в ошибки это писать нельзя - иначе журнал будет красным
          // всегда и настоящую поломку в нём не увидеть.
          if (resp.status === 404 && text.includes("Report was not found")) {
            notReady.push(key);
          } else {
            errors[key] = `${resp.status}: ${text.slice(0, 200)}`;
          }
          await sleep(PAUSE_MS);
          continue;
        }
        const data = JSON.parse(text) as {
          result?: {
            header?: { number?: string; doc_date?: string };
            rows?: RealizationRow[];
          };
        };
        const rows = data.result?.rows ?? [];
        perMonth[key] = rows.length;
        if (rows.length === 0) {
          await sleep(PAUSE_MS);
          continue;
        }

        const head = data.result?.header;
        const payload = rows.map((r) => {
          const s = r.delivery_commission ?? null;
          const v = r.return_commission ?? null;
          return {
            year,
            month,
            row_number: r.rowNumber ?? 0,
            doc_number: head?.number ?? null,
            doc_date: head?.doc_date ?? null,
            offer_id: r.item?.offer_id ?? null,
            sku: r.item?.sku ?? null,
            barcode: r.item?.barcode ?? null,
            name: r.item?.name ?? null,
            seller_price_per_instance: num(r.seller_price_per_instance),
            commission_ratio: num(r.commission_ratio),
            sale_qty: s?.quantity ?? null,
            sale_price_per_instance: num(s?.price_per_instance),
            sale_amount: num(s?.amount),
            sale_commission: num(s?.commission),
            sale_bonus: num(s?.bonus),
            sale_standard_fee: num(s?.standard_fee),
            sale_stars: num(s?.stars),
            sale_bank_coinvest: num(s?.bank_coinvestment),
            sale_pvz_coinvest: num(s?.pick_up_point_coinvestment),
            sale_compensation: num(s?.compensation),
            sale_total: num(s?.total),
            ret_qty: v?.quantity ?? null,
            ret_amount: num(v?.amount),
            ret_commission: num(v?.commission),
            ret_total: num(v?.total),
            raw: r,
            fetched_at: fetchedAt,
          };
        });

        for (let i = 0; i < payload.length; i += 500) {
          const { error } = await supabase
            .from("ozon_realization")
            .upsert(payload.slice(i, i + 500), { onConflict: "year,month,row_number" });
          if (error) throw new Error(`ozon_realization upsert ${key}: ${error.message}`);
        }
        written += payload.length;
      } catch (e) {
        errors[key] = e instanceof Error ? e.message : String(e);
      }
      await sleep(PAUSE_MS);
    }

    const result = {
      ok: Object.keys(errors).length === 0,
      mesyacev: months,
      strok: written,
      po_mesyacam: perMonth,
      ...(notReady.length > 0 ? { otchyot_eshchyo_ne_zakryt: notReady } : {}),
      ...(Object.keys(errors).length > 0 ? { oshibki: errors } : {}),
    };

    if (jobId) {
      await supabase.from("ingestion_log").update({
        status: Object.keys(errors).length === 0 ? "ok" : "error",
        finished_at: new Date().toISOString(),
        rows_out: written,
        error_text: Object.keys(errors).length > 0 ? JSON.stringify(errors).slice(0, 500) : null,
        meta: result,
      }).eq("id", jobId);
    }
    return json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (jobId) {
      await supabase.from("ingestion_log").update({
        status: "error", finished_at: new Date().toISOString(), error_text: message,
      }).eq("id", jobId);
    }
    return json({ ok: false, error: message }, 500);
  }
});
