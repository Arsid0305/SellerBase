// fetch-wb-promotions — тянет календарь акций WB, метрики участия и участвующие SKU.
// WB API: dp-calendar-api.wildberries.ru/api/v1/calendar/promotions
//         + /promotions/details   — агрегаты участия и пороги бустинга
//         + /promotions/nomenclatures — состав, ТОЛЬКО для обычных акций
// UPSERT в wb_promotions + wb_promotion_items.
// Горизонт по умолчанию: now()..now()+30d. Можно ?from=YYYY-MM-DD&to=YYYY-MM-DD.
//
// Про состав авто-акций: WB отдаёт 422 на /nomenclatures для type='auto' при любом
// значении inAction (проверено 04.09.2026 на четырёх живых акциях). Раньше функция
// всё равно ходила туда и молча получала 422 на каждую акцию — таблица участников
// оставалась пустой. Теперь для авто-акций запрос не делается вовсе, а вместо
// состава сохраняются агрегаты из /details: сколько наших товаров участвует,
// сколько нет, процент участия и пороги бустинга.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const JOB_NAME = "fetch-wb-promotions";
const WB_BASE = "https://dp-calendar-api.wildberries.ru";
// Сколько id акций уходит в /details за один запрос.
const DETAILS_BATCH = 10;

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

interface WbPromotionDetails {
  id: number;
  description?: string;
  advantages?: string[];
  inPromoActionTotal?: number;
  notInPromoActionTotal?: number;
  participationPercentage?: number;
  exceptionProductsCount?: number;
  ranging?: unknown;
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

    // Детали: агрегаты участия и пороги бустинга. Метод принимает несколько id
    // за раз, поэтому идём пачками — так на 30 акций уходит три запроса, а не тридцать.
    let detailsOk = 0;
    for (let i = 0; i < promos.length; i += DETAILS_BATCH) {
      const batch = promos.slice(i, i + DETAILS_BATCH);
      const qs = batch.map((p) => `promotionIDs=${p.id}`).join("&");
      try {
        const raw = await fetchJson(`${WB_BASE}/api/v1/calendar/promotions/details?${qs}`, token);
        const list = (raw as { data?: { promotions?: WbPromotionDetails[] } })?.data?.promotions ?? [];
        for (const d of list) {
          const { error } = await supabase.from("wb_promotions").update({
            description: d.description ?? null,
            advantages: d.advantages ?? null,
            in_promo_total: d.inPromoActionTotal ?? null,
            not_in_promo_total: d.notInPromoActionTotal ?? null,
            participation_pct: d.participationPercentage ?? null,
            exception_count: d.exceptionProductsCount ?? null,
            ranging: d.ranging ?? null,
            details_fetched_at: new Date().toISOString(),
          }).eq("promotion_id", d.id);
          if (error) throw new Error(`wb_promotions details update ${d.id}: ${error.message}`);
          detailsOk += 1;
        }
      } catch (e) {
        // Детали — не повод ронять весь прогон: календарь уже сохранён.
        console.error(`details batch ${i}: ${e instanceof Error ? e.message : e}`);
      }
      await new Promise((r) => setTimeout(r, 2500));
    }

    let totalItems = 0;
    for (const promo of promos) {
      // Состав участников. Для авто-акций WB закрыл метод: 422 при любом inAction.
      // Не ходим туда вовсе — вместо состава по таким акциям работают агрегаты выше.
      if (promo.type === "auto") continue;

      const debugRaws: Record<string, unknown> = {};
      // Тянем И inAction=true (уже выбранные), И inAction=false (доступные, но не выбранные).
      // Без false-варианта матрица в /promo пустая — владелица не видит SKU которые МОЖЕТ добавить.
      const variants: boolean[] = [true, false];
      for (const inAction of variants) {
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
          // in_action — фактический статус: true=участвует на витрине, false=доступен но не выбран
          in_action: typeof n.inAction === "boolean" ? n.inAction : inAction,
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
      meta: {
        start: startISO,
        end: endISO,
        promotions: promos.length,
        details: detailsOk,
        items: totalItems,
        auto_skipped: promos.filter((p) => p.type === "auto").length,
      },
    }).eq("id", jobId);

    return new Response(
      JSON.stringify({ ok: true, promotions: promos.length, details: detailsOk, items: totalItems }),
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
