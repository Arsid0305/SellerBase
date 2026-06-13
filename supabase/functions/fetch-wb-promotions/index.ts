// fetch-wb-promotions — тянет календарь акций WB + участвующие SKU.
// WB API: dp-calendar-api.wildberries.ru/api/v1/calendar/promotions
// UPSERT в wb_promotions + wb_promotion_items.
// Горизонт по умолчанию: now()..now()+30d. Можно ?from=YYYY-MM-DD&to=YYYY-MM-DD.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const JOB_NAME = "fetch-wb-promotions";
const WB_BASE = "https://dp-calendar-api.wildberries.ru";

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

interface WbPromotion {
  id: number;
  name: string;
  startDateTime: string;
  endDateTime: string;
  type: string;
}

interface WbNomenclature {
  id: number;
  inAction?: boolean;
  price?: number;
  planPrice?: number;
  discount?: number;
  planDiscount?: number;
}

async function fetchJson(url: string, token: string): Promise<unknown> {
  const resp = await fetch(url, { headers: { Authorization: token } });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`WB API ${resp.status} ${url}: ${body.slice(0, 400)}`);
  }
  return resp.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = adminClient();
  const url = new URL(req.url);
  const qFrom = url.searchParams.get("from");
  const qTo = url.searchParams.get("to");

  const startISO = qFrom
    ? new Date(qFrom).toISOString()
    : new Date().toISOString();
  const endISO = qTo
    ? new Date(qTo).toISOString()
    : new Date(Date.now() + 30 * 86400 * 1000).toISOString();

  const { data: logRow, error: insErr } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: { start: startISO, end: endISO } })
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

    const listUrl = `${WB_BASE}/api/v1/calendar/promotions`
      + `?startDateTime=${encodeURIComponent(startISO)}`
      + `&endDateTime=${encodeURIComponent(endISO)}`
      + `&allPromo=false`;
    const listData = (await fetchJson(listUrl, token)) as { data?: { promotions?: WbPromotion[] } };
    const promos: WbPromotion[] = listData?.data?.promotions ?? [];

    if (promos.length === 0) {
      await supabase.from("ingestion_log").update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_in: 0,
        rows_out: 0,
        meta: { start: startISO, end: endISO, promotions: 0 },
      }).eq("id", jobId);
      return new Response(
        JSON.stringify({ ok: true, promotions: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const promoRows = promos.map((p) => ({
      promotion_id: p.id,
      name: p.name,
      type: p.type ?? null,
      start_at: p.startDateTime,
      end_at: p.endDateTime,
      raw: p,
      fetched_at: new Date().toISOString(),
    }));
    {
      const { error } = await supabase.from("wb_promotions")
        .upsert(promoRows, { onConflict: "promotion_id" });
      if (error) throw new Error(`wb_promotions upsert: ${error.message}`);
    }

    let totalItems = 0;
    for (const promo of promos) {
      const debugRaws: Record<string, unknown> = {};
      for (const inAction of [true]) {
        const nUrl = `${WB_BASE}/api/v1/calendar/promotions/nomenclatures`
          + `?promotionID=${promo.id}`
          + `&inAction=${inAction}`
          + `&limit=1000&offset=0`;
        let rawResponse: unknown = null;
        let nomenclatures: WbNomenclature[] = [];
        try {
          rawResponse = await fetchJson(nUrl, token);
          debugRaws[`in_action_${inAction}`] = rawResponse;
          const data = rawResponse as { data?: { nomenclatures?: WbNomenclature[] } | WbNomenclature[] };
          // try both response shapes: {data:{nomenclatures:[]}} and {data:[]}
          if (Array.isArray((data as { data?: unknown }).data)) {
            nomenclatures = (data as { data: WbNomenclature[] }).data;
          } else if (Array.isArray((data as { data?: { nomenclatures?: unknown } }).data?.nomenclatures)) {
            nomenclatures = (data as { data: { nomenclatures: WbNomenclature[] } }).data.nomenclatures;
          }
        } catch (e) {
          console.error(`promo ${promo.id} inAction=${inAction}: ${e instanceof Error ? e.message : e}`);
          debugRaws[`in_action_${inAction}_err`] = e instanceof Error ? e.message : String(e);
          continue;
        }
        if (nomenclatures.length === 0) continue;

        const itemRows = nomenclatures.map((n) => ({
          promotion_id: promo.id,
          nm_id: n.id,
          in_action: !!n.inAction || inAction,
          current_price: n.price ?? null,
          plan_price: n.planPrice ?? null,
          current_discount: n.discount ?? null,
          plan_discount: n.planDiscount ?? null,
          fetched_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from("wb_promotion_items")
          .upsert(itemRows, { onConflict: "promotion_id,nm_id" });
        if (error) throw new Error(`wb_promotion_items upsert promo=${promo.id}: ${error.message}`);
        totalItems += itemRows.length;
        await new Promise((r) => setTimeout(r, 2500));
      }
      // сохраняем сырой ответ для отладки
      await supabase.from("wb_promotions")
        .update({ debug_nomenclatures_raw: debugRaws })
        .eq("promotion_id", promo.id);
    }

    await supabase.from("ingestion_log").update({
      status: "ok",
      finished_at: new Date().toISOString(),
      rows_in: promos.length,
      rows_out: totalItems,
      meta: { start: startISO, end: endISO, promotions: promos.length, items: totalItems },
    }).eq("id", jobId);

    return new Response(
      JSON.stringify({ ok: true, promotions: promos.length, items: totalItems }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("ingestion_log").update({
      status: "error",
      finished_at: new Date().toISOString(),
      error_text: message,
    }).eq("id", jobId);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
