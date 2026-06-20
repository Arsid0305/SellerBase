// fetch-wb-ads — фетч расходов на рекламу из WB Advert API.
// Шаг 1: GET /adv/v1/promotion/count — список кампаний.
// Шаг 2: POST /adv/v2/fullstats — детальная статистика (views/clicks/spend/orders)
//        по дням, в т.ч. в разрезе nm_id (карточек товара).
// UPSERT в wb_ads_fact по (campaign_id, date, nm_id_key). Логирует в ingestion_log.
//
// Запуск: cron каждый час (см. миграцию 20260620020002_cron_fetch_wb_ads.sql).
// ?days=N — фетч статистики за последние N дней (default 7, max 90).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { adminClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { wbPost, batchUpsert } from "../_shared/wb-client.ts";

const JOB_NAME = "fetch-wb-ads";
const WB_BASE = "https://advert-api.wildberries.ru";
// fullstats принимает максимум 100 кампаний и 31 дату за один запрос.
const CAMPAIGNS_PER_CALL = 100;

interface WbCampaign {
  advertId: number;
  campaignName?: string;
  type?: number;
  status?: number;
  [k: string]: unknown;
}

interface WbCampaignCountGroup {
  type: number;
  status: number;
  count: number;
  advert_list?: { advertId: number; changeTime?: string }[];
}

interface WbFullstatsNm {
  nmId: number;
  name?: string;
  views?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  sum?: number;
  atbs?: number;
  orders?: number;
  shks?: number;
  sum_price?: number;
}

interface WbFullstatsApp {
  views?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  sum?: number;
  atbs?: number;
  orders?: number;
  shks?: number;
  sum_price?: number;
  nm?: WbFullstatsNm[];
}

interface WbFullstatsDay {
  date: string; // YYYY-MM-DDTHH:mm:ssZ
  views?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  sum?: number;
  atbs?: number;
  orders?: number;
  shks?: number;
  sum_price?: number;
  apps?: WbFullstatsApp[];
}

interface WbFullstatsCampaign {
  advertId: number;
  campaignName?: string;
  days?: WbFullstatsDay[];
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function dateRangeDays(days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86_400_000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Список всех кампаний продавца (любого статуса/типа).
 * Особый случай: WB возвращает 204 No Content когда кампаний нет —
 * стандартный wbGet помощник упадёт на res.json(), поэтому здесь свой fetch.
 */
async function fetchCampaignIds(token: string): Promise<WbCampaign[]> {
  const url = `${WB_BASE}/adv/v1/promotion/count`;
  const res = await fetch(url, {
    headers: { Authorization: token, "Content-Type": "application/json" },
  });
  if (res.status === 429) {
    const retry = parseInt(res.headers.get("x-ratelimit-retry") ?? "20", 10);
    await new Promise((r) => setTimeout(r, (retry + 1) * 1000));
    return fetchCampaignIds(token);
  }
  if (res.status === 204) return []; // нет кампаний
  if (!res.ok) throw new Error(`wb promotion/count ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { adverts?: WbCampaignCountGroup[] };
  const groups = data?.adverts ?? [];
  const out: WbCampaign[] = [];
  for (const g of groups) {
    for (const a of g.advert_list ?? []) {
      out.push({ advertId: a.advertId, type: g.type, status: g.status });
    }
  }
  return out;
}

async function fetchFullstats(
  token: string,
  campaignIds: number[],
  dates: string[],
): Promise<WbFullstatsCampaign[]> {
  const url = `${WB_BASE}/adv/v2/fullstats`;
  const body = campaignIds.map((id) => ({ id, dates }));
  const data = await wbPost(url, token, body);
  return Array.isArray(data) ? (data as WbFullstatsCampaign[]) : [];
}

function buildRows(
  campaigns: WbFullstatsCampaign[],
  campaignMeta: Map<number, { type?: number; status?: number }>,
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const fetchedAt = new Date().toISOString();

  for (const camp of campaigns) {
    const meta = campaignMeta.get(camp.advertId);
    for (const day of camp.days ?? []) {
      const date = dateOnly(day.date);
      const nmList = (day.apps ?? []).flatMap((app) => app.nm ?? []);

      if (nmList.length === 0) {
        // нет детализации по товару — пишем агрегат по кампании/дню (nm_id = NULL)
        rows.push({
          campaign_id: camp.advertId,
          date,
          nm_id: null,
          campaign_name: camp.campaignName ?? null,
          views: Math.round(toNum(day.views)),
          clicks: Math.round(toNum(day.clicks)),
          ctr: toNum(day.ctr) || null,
          cpc_rub: toNum(day.cpc) || null,
          spend_rub: toNum(day.sum),
          orders_count: Math.round(toNum(day.orders)),
          orders_sum_rub: toNum(day.sum_price) || null,
          shks: Math.round(toNum(day.shks)),
          type: meta?.type ?? null,
          status: meta?.status ?? null,
          fetched_at: fetchedAt,
        });
        continue;
      }

      for (const nm of nmList) {
        rows.push({
          campaign_id: camp.advertId,
          date,
          nm_id: nm.nmId,
          campaign_name: camp.campaignName ?? null,
          views: Math.round(toNum(nm.views)),
          clicks: Math.round(toNum(nm.clicks)),
          ctr: toNum(nm.ctr) || null,
          cpc_rub: toNum(nm.cpc) || null,
          spend_rub: toNum(nm.sum),
          orders_count: Math.round(toNum(nm.orders)),
          orders_sum_rub: toNum(nm.sum_price) || null,
          shks: Math.round(toNum(nm.shks)),
          type: meta?.type ?? null,
          status: meta?.status ?? null,
          fetched_at: fetchedAt,
        });
      }
    }
  }

  return rows;
}

async function run(supabase: SupabaseClient, jobId: number, days: number) {
  const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
  if (!token) throw new Error("WB_TOKEN_READ / WB_API_TOKEN not set");

  const dates = dateRangeDays(days);
  const allCampaigns = await fetchCampaignIds(token);

  let totalIn = 0;
  let totalOut = 0;

  if (allCampaigns.length === 0) {
    await supabase
      .from("ingestion_log")
      .update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_in: 0,
        rows_out: 0,
        meta: { days, campaigns: 0 },
      })
      .eq("id", jobId);
    return { totalIn: 0, totalOut: 0, campaigns: 0 };
  }

  const campaignMeta = new Map<number, { type?: number; status?: number }>();
  for (const c of allCampaigns) campaignMeta.set(c.advertId, { type: c.type, status: c.status });

  const allIds = allCampaigns.map((c) => c.advertId);

  for (let i = 0; i < allIds.length; i += CAMPAIGNS_PER_CALL) {
    const idsChunk = allIds.slice(i, i + CAMPAIGNS_PER_CALL);
    const stats = await fetchFullstats(token, idsChunk, dates);
    totalIn += stats.length;

    const rows = buildRows(stats, campaignMeta);
    if (rows.length > 0) {
      await batchUpsert(supabase, "wb_ads_fact", rows, {
        onConflict: "campaign_id,date,nm_id_key",
        batchSize: 1000,
      });
      totalOut += rows.length;
    }

    // мягкая пауза между батчами кампаний (rate limit advert-api строже statistics-api)
    if (i + CAMPAIGNS_PER_CALL < allIds.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  await supabase
    .from("ingestion_log")
    .update({
      status: "ok",
      finished_at: new Date().toISOString(),
      rows_in: totalIn,
      rows_out: totalOut,
      meta: { days, campaigns: allIds.length },
    })
    .eq("id", jobId);

  return { totalIn, totalOut, campaigns: allIds.length };
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
    const days = daysParam ? Math.max(1, Math.min(90, parseInt(daysParam, 10))) : 7;

    const result = await run(supabase, jobId, days);
    return new Response(JSON.stringify({ ok: true, ...result, days }), {
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
