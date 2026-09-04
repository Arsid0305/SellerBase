// fetch-wb-supplies v3 — FBW-поставки WB.
//
// API (проверено 04.09.2026 через probe-wb-api):
//   POST supplies-api.wildberries.ru/api/v1/supplies        — список, тело {}
//   GET  supplies-api.wildberries.ru/api/v1/supplies/{id}       — детали
//   GET  supplies-api.wildberries.ru/api/v1/supplies/{id}/goods — состав
//
// Что изменилось у WB и почему функция стояла с 21.08:
//   • список переведён с GET на POST — прежний GET отдаёт 405 Method Not Allowed
//     (путь тот же, отсюда 405, а не 404). Это и есть те 160 ошибок в журнале;
//   • форма ответа другая: плоский массив вместо {next, supplies:[...]},
//     без курсора и без полей name / warehouseName / status / boxesCount;
//   • состав позиции тоже приходит плоским массивом, поле nmID вместо nmId
//     и techSize вместо sizeName.
//
// Склад, количества по стадиям приёмки и стоимость платной приёмки отдаёт
// GET /api/v1/supplies/{id} — отдельным запросом на поставку.
//
// Категория токена: «Поставки» / FBW. Env: WB_TOKEN_READ ?? WB_API_TOKEN.
// UPSERT в wb_supplies_v2 и wb_supply_items_v2.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-wb-supplies";
const WB_BASE = "https://supplies-api.wildberries.ru";

// Список приходит целиком одним запросом — постраничности у метода нет.
// А вот детали и состав — по запросу на поставку, поэтому за один прогон
// обогащаем ограниченное число: WB держит лимит на частоту, а Edge Function —
// на длительность. Очередь всегда начинается с тех, у кого деталей ещё нет.
const DETAILS_PER_RUN_DEFAULT = 25;
// 1200 мс не хватило: на 22-й поставке WB ответил 429 (прогон 04.09).
const PAUSE_MS = 2000;
// Сколько ждать, если WB не назвал срок в заголовке.
const RETRY_FALLBACK_MS = 10_000;

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

/** Запись списка поставок: то, что отдаёт POST /api/v1/supplies. */
interface WbSupplyListRow {
  supplyID: number | null;
  preorderID: number | null;
  createDate?: string | null;
  supplyDate?: string | null;
  factDate?: string | null;
  updatedDate?: string | null;
  statusID?: number | null;
  boxTypeID?: number | null;
  isBoxOnPallet?: boolean | null;
}

/** Детали поставки: GET /api/v1/supplies/{id}. */
interface WbSupplyDetails {
  statusID?: number | null;
  boxTypeID?: number | null;
  supplyDate?: string | null;
  factDate?: string | null;
  updatedDate?: string | null;
  warehouseID?: number | null;
  warehouseName?: string | null;
  actualWarehouseID?: number | null;
  actualWarehouseName?: string | null;
  transitWarehouseName?: string | null;
  acceptanceCost?: number | null;
  paidAcceptanceCoefficient?: number | null;
  rejectReason?: string | null;
  quantity?: number | null;
  readyForSaleQuantity?: number | null;
  acceptedQuantity?: number | null;
  unloadingQuantity?: number | null;
  isBoxOnPallet?: boolean | null;
}

/** Позиция поставки: GET /api/v1/supplies/{id}/goods. */
interface WbGood {
  nmID?: number | null;
  barcode?: string | null;
  vendorCode?: string | null;
  quantity?: number | null;
  techSize?: string | null;
  color?: string | null;
  tnved?: string | null;
  needKiz?: boolean | null;
  readyForSaleQuantity?: number | null;
  unloadingQuantity?: number | null;
  acceptedQuantity?: number | null;
}

/**
 * Запрос к WB с одной повторной попыткой на 429.
 *
 * WB ограничивает частоту и при превышении отвечает 429, называя срок ожидания
 * в заголовке X-RateLimit-Retry (секунды). Ждём именно столько: угадывать паузу
 * вслепую значит либо терять поставки, либо держать функцию впустую.
 */
async function wbFetch(url: string, token: string, init?: RequestInit): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const resp = await fetch(url, {
      ...init,
      headers: { Authorization: token, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (resp.ok) return resp.json();

    const body = (await resp.text()).slice(0, 300);
    if (resp.status === 429 && attempt === 0) {
      const retryHeader = resp.headers.get("X-RateLimit-Retry") ?? resp.headers.get("x-ratelimit-retry");
      const waitMs = Number(retryHeader) > 0 ? Number(retryHeader) * 1000 : RETRY_FALLBACK_MS;
      await sleep(waitMs);
      continue;
    }
    throw new Error(`WB ${resp.status} ${url}: ${body}`);
  }
  throw new Error(`WB 429 ${url}: лимит частоты не отпустил после повтора`);
}

/** Список поставок целиком. Пустое тело — WB отдаёт всю историю сразу. */
async function fetchSupplyList(token: string): Promise<WbSupplyListRow[]> {
  const json = await wbFetch(`${WB_BASE}/api/v1/supplies`, token, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!Array.isArray(json)) throw new Error("WB supplies: ожидался массив, пришло другое");
  return json as WbSupplyListRow[];
}

/**
 * Ключ строки. supplyID появляется не сразу: пока поставка — преордер, есть
 * только preorderID. Чтобы одна и та же поставка не задвоилась при переходе
 * из преордера в поставку, ключом всегда служит preorderID, когда он есть.
 */
function rowKey(r: { supplyID: number | null; preorderID: number | null }): string | null {
  if (r.preorderID) return `p${r.preorderID}`;
  if (r.supplyID) return `s${r.supplyID}`;
  return null;
}

async function upsertList(sb: SupabaseClient, rows: WbSupplyListRow[]): Promise<number> {
  const payload = rows
    .map((r) => {
      const id = rowKey(r);
      if (!id) return null;
      return {
        id,
        supply_id_num: r.supplyID ?? null,
        preorder_id: r.preorderID ?? null,
        date_created: r.createDate ?? null,
        supply_date: r.supplyDate ?? null,
        fact_date: r.factDate ?? null,
        updated_date: r.updatedDate ?? null,
        status_id: r.statusID ?? null,
        box_type_id: r.boxTypeID ?? null,
        is_box_on_pallet: r.isBoxOnPallet ?? null,
        fetched_at: new Date().toISOString(),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (payload.length === 0) return 0;
  const { error } = await sb.from("wb_supplies_v2").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(`upsert wb_supplies_v2: ${error.message}`);
  return payload.length;
}

async function saveDetails(sb: SupabaseClient, id: string, d: WbSupplyDetails): Promise<void> {
  const { error } = await sb.from("wb_supplies_v2").update({
    warehouse_id: d.warehouseID ?? null,
    warehouse_name: d.warehouseName ?? null,
    actual_warehouse_id: d.actualWarehouseID ?? null,
    actual_warehouse_name: d.actualWarehouseName ?? null,
    transit_warehouse_name: d.transitWarehouseName || null,
    acceptance_cost: d.acceptanceCost ?? null,
    paid_acceptance_coef: d.paidAcceptanceCoefficient ?? null,
    reject_reason: d.rejectReason ?? null,
    quantity: d.quantity ?? null,
    ready_for_sale_quantity: d.readyForSaleQuantity ?? null,
    accepted_quantity: d.acceptedQuantity ?? null,
    unloading_quantity: d.unloadingQuantity ?? null,
    status_id: d.statusID ?? null,
    box_type_id: d.boxTypeID ?? null,
    supply_date: d.supplyDate ?? null,
    fact_date: d.factDate ?? null,
    updated_date: d.updatedDate ?? null,
    details_fetched_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw new Error(`update details ${id}: ${error.message}`);
}

async function saveGoods(sb: SupabaseClient, id: string, goods: WbGood[]): Promise<number> {
  // Состав поставки перезаписывается целиком: позиции могут исчезать,
  // а не только меняться в количестве.
  await sb.from("wb_supply_items_v2").delete().eq("supply_id", id);
  if (goods.length === 0) return 0;
  const payload = goods.map((g) => ({
    supply_id: id,
    nm_id: g.nmID ?? null,
    barcode: g.barcode ?? null,
    vendor_code: g.vendorCode ?? null,
    quantity: g.quantity ?? 0,
    size_name: g.techSize ?? null,
    color: g.color ?? null,
    tnved: g.tnved ?? null,
    need_kiz: g.needKiz ?? null,
    ready_for_sale_quantity: g.readyForSaleQuantity ?? null,
    unloading_quantity: g.unloadingQuantity ?? null,
    accepted_quantity: g.acceptedQuantity ?? null,
    fetched_at: new Date().toISOString(),
  }));
  const { error } = await sb.from("wb_supply_items_v2").insert(payload);
  if (error) throw new Error(`insert wb_supply_items_v2 (${id}): ${error.message}`);
  return payload.length;
}

// Логируем в ingestion_log — общий журнал всех ingestion-функций.
// v2 изначально писала в integration_jobs, которой в схеме нет: запись падала,
// а вместе с ней терялась и ошибка из catch. Плюс job не видели v_data_quality
// и telegram-alerts, которые читают именно ingestion_log.
async function openJob(sb: SupabaseClient): Promise<number> {
  const { data, error } = await sb
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: {} })
    .select("id")
    .single();
  if (error || !data) throw new Error(`ingestion_log open: ${error?.message}`);
  return data.id as number;
}

async function closeJob(
  sb: SupabaseClient,
  jobId: number,
  status: "ok" | "error",
  rowsIn: number,
  rowsOut: number,
  errorText: string | null,
  meta: Record<string, unknown>,
): Promise<void> {
  await sb
    .from("ingestion_log")
    .update({
      status,
      finished_at: new Date().toISOString(),
      rows_in: rowsIn,
      rows_out: rowsOut,
      error_text: errorText,
      meta,
    })
    .eq("id", jobId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cron = checkCronSecret(req);
  if (!cron.ok) return cron.response;

  const supabase = adminClient();
  const url = new URL(req.url);
  const perRun = Math.max(1, Math.min(
    Number(url.searchParams.get("details") ?? DETAILS_PER_RUN_DEFAULT) || DETAILS_PER_RUN_DEFAULT,
    200,
  ));

  const jobId = await openJob(supabase);
  try {
    const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
    if (!token) throw new Error("WB_TOKEN_READ / WB_API_TOKEN not set");

    const list = await fetchSupplyList(token);
    const listed = await upsertList(supabase, list);

    // Очередь на обогащение: сначала те, у кого деталей нет вовсе (NULL идёт
    // первым), затем самые давно обновлённые. За несколько прогонов круг
    // замыкается, свежие данные приходят к тем, кого дольше всех не трогали.
    // Сравнить updated_date с details_fetched_at прямо в фильтре нельзя:
    // PostgREST сопоставляет колонку со значением, а не с другой колонкой, —
    // такой фильтр молча превратился бы в сравнение со строкой.
    // Поставка без supplyID (ещё преордер) деталей не имеет — её пропускаем.
    const { data: queue, error: qErr } = await supabase
      .from("wb_supplies_v2")
      .select("id, supply_id_num, updated_date, details_fetched_at")
      .not("supply_id_num", "is", null)
      .order("details_fetched_at", { ascending: true, nullsFirst: true })
      .order("updated_date", { ascending: false })
      .limit(perRun);
    if (qErr) throw new Error(`queue: ${qErr.message}`);

    let detailsOk = 0;
    let goodsRows = 0;
    const failed: string[] = [];

    for (const row of (queue ?? []) as Array<{ id: string; supply_id_num: number }>) {
      try {
        const d = await wbFetch(`${WB_BASE}/api/v1/supplies/${row.supply_id_num}`, token);
        await saveDetails(supabase, row.id, d as WbSupplyDetails);
        detailsOk += 1;
        await sleep(PAUSE_MS);

        const g = await wbFetch(`${WB_BASE}/api/v1/supplies/${row.supply_id_num}/goods`, token);
        goodsRows += await saveGoods(supabase, row.id, Array.isArray(g) ? (g as WbGood[]) : []);
        await sleep(PAUSE_MS);
      } catch (e) {
        // Одна недоступная поставка не должна ронять прогон: остальные нужнее.
        failed.push(`${row.id}: ${e instanceof Error ? e.message : e}`);
      }
    }

    const { count: pending } = await supabase
      .from("wb_supplies_v2")
      .select("id", { count: "exact", head: true })
      .not("supply_id_num", "is", null)
      .is("details_fetched_at", null);

    await closeJob(supabase, jobId, "ok", listed, goodsRows, null, {
      listed,
      details: detailsOk,
      goods: goodsRows,
      pending_details: pending ?? null,
      failed: failed.slice(0, 10),
    });
    return new Response(
      JSON.stringify({ ok: true, listed, details: detailsOk, goods: goodsRows, pending_details: pending ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await closeJob(supabase, jobId, "error", 0, 0, msg, {});
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
