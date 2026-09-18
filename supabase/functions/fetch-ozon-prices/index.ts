// fetch-ozon-prices — цены Ozon и тарифы площадки по каждому товару.
//
// Шаг четвёртый подключения Ozon, план — docs/integrations/OZON_PODKLYUCHENIE.md.
//
// Главное, ради чего писалось: /v5/product/info/prices отдаёт не только цену,
// но и то, сколько площадка заберёт именно с этого товара — процент комиссии,
// логистику в рублях, эквайринг. По ВБ такое приходится собирать из отчётов
// реализации задним числом, здесь оно есть сразу и на сегодня.
//
// Отсюда же индекс цены: Ozon сравнивает нашу цену с другими площадками и
// красит светофором. Жёлтый и красный — товар показывают хуже.
//
// Пишет в ozon_prices (текущий срез) и ozon_prices_history (снимок за день).
// На площадку не пишет ничего: у ключа права «Admin read only».

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-ozon-prices";
const OZON_BASE = "https://api-seller.ozon.ru";
const PAGE = 100;
const PAUSE_MS = 700; // Ozon не любит частых запросов

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

// Ozon отдаёт числа то числом, то строкой — приводим к одному виду.
const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

interface PriceItem {
  product_id?: number;
  offer_id?: string;
  acquiring?: number;
  volume_weight?: number;
  commissions?: Record<string, unknown>;
  price?: Record<string, unknown>;
  price_indexes?: Record<string, Record<string, unknown> | string>;
  marketing_actions?: { ozon_actions_exist?: boolean };
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

  const { data: logRow } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME })
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

    const today = new Date().toISOString().slice(0, 10);
    const rows: Record<string, unknown>[] = [];
    const istoriya: Record<string, unknown>[] = [];
    let cursor = "";

    for (;;) {
      const resp = await fetch(`${OZON_BASE}/v5/product/info/prices`, {
        method: "POST",
        headers,
        body: JSON.stringify({ filter: { visibility: "ALL" }, limit: PAGE, cursor }),
      });
      const text = await resp.text();
      if (!resp.ok) throw new Error(`product/info/prices ${resp.status}: ${text.slice(0, 200)}`);

      const data = JSON.parse(text) as { items?: PriceItem[]; cursor?: string };
      const items = data.items ?? [];

      for (const it of items) {
        if (it.product_id == null) continue;
        const k = (it.commissions ?? {}) as Record<string, unknown>;
        const c = (it.price ?? {}) as Record<string, unknown>;
        const idx = (it.price_indexes ?? {}) as Record<string, Record<string, unknown> | string>;
        const vneshniy = (idx.external_index_data ?? {}) as Record<string, unknown>;
        const drugie = (idx.self_marketplaces_index_data ?? {}) as Record<string, unknown>;

        rows.push({
          product_id: it.product_id,
          offer_id: it.offer_id ?? null,
          price: num(c.price),
          old_price: num(c.old_price),
          min_price: num(c.min_price),
          marketing_seller_price: num(c.marketing_seller_price),
          currency_code: (c.currency_code as string) ?? null,
          acquiring: num(it.acquiring),
          volume_weight: num(it.volume_weight),
          commission_pct_fbo: num(k.sales_percent_fbo),
          commission_pct_fbs: num(k.sales_percent_fbs),
          fbo_logistika_min: num(k.fbo_direct_flow_trans_min_amount),
          fbo_logistika_max: num(k.fbo_direct_flow_trans_max_amount),
          fbo_dostavka_pokupatelyu: num(k.fbo_deliv_to_customer_amount),
          fbo_obratnaya_logistika: num(k.fbo_return_flow_amount),
          fbs_logistika_min: num(k.fbs_direct_flow_trans_min_amount),
          fbs_logistika_max: num(k.fbs_direct_flow_trans_max_amount),
          fbs_dostavka_pokupatelyu: num(k.fbs_deliv_to_customer_amount),
          fbs_pervaya_milya_max: num(k.fbs_first_mile_max_amount),
          fbs_obratnaya_logistika: num(k.fbs_return_flow_amount),
          index_cvet: (idx.color_index as string) ?? null,
          index_vneshnyaya_min: num(vneshniy.min_price),
          index_drugie_ploshchadki: num(drugie.min_price),
          avtoakcii_vklyucheny: (c.auto_action_enabled as boolean) ?? null,
          uchastvuet_v_akciyah: it.marketing_actions?.ozon_actions_exist ?? null,
          raw: it,
          fetched_at: new Date().toISOString(),
        });

        istoriya.push({
          snapshot_date: today,
          product_id: it.product_id,
          offer_id: it.offer_id ?? null,
          price: num(c.price),
          old_price: num(c.old_price),
          min_price: num(c.min_price),
          marketing_seller_price: num(c.marketing_seller_price),
          index_cvet: (idx.color_index as string) ?? null,
        });
      }

      cursor = data.cursor ?? "";
      if (!cursor || items.length < PAGE) break;
      await sleep(PAUSE_MS);
    }

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase
        .from("ozon_prices")
        .upsert(rows.slice(i, i + 500), { onConflict: "product_id" });
      if (error) throw new Error(`ozon_prices upsert: ${error.message}`);
    }
    for (let i = 0; i < istoriya.length; i += 500) {
      const { error } = await supabase
        .from("ozon_prices_history")
        .upsert(istoriya.slice(i, i + 500), { onConflict: "snapshot_date,product_id" });
      if (error) throw new Error(`ozon_prices_history upsert: ${error.message}`);
    }

    // В журнал кладём то, на что стоит смотреть: плохой индекс цены значит,
    // что Ozon показывает товар хуже, и это видно только здесь.
    const plohoy_index = rows.filter(
      (r) => r.index_cvet === "RED" || r.index_cvet === "YELLOW",
    ).length;
    const result = { ok: true, tovarov: rows.length, plohoy_index, na_datu: today };

    if (jobId) {
      await supabase.from("ingestion_log").update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_out: rows.length,
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
