// fetch-wb-supplies v2 — FBW-поставки WB.
// API: GET supplies-api.wildberries.ru/api/v1/supplies?limit=1000&next=<cursor>
//      GET supplies-api.wildberries.ru/api/v1/supplies/{id}/goods
// Категория токена: «Поставки» / FBW. Env: WB_TOKEN_READ ?? WB_API_TOKEN.
// UPSERT в wb_supplies_v2 и wb_supply_items_v2.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-wb-supplies";
const WB_BASE = "https://supplies-api.wildberries.ru";
const PAGE_LIMIT = 1000;

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

interface WbSupply {
  id: string;
  name?: string;
  dateCreated?: string;
  warehouseId?: number;
  warehouseName?: string;
  status?: string;
  boxesCount?: number;
}

interface WbSuppliesResponse {
  next?: number;
  supplies?: WbSupply[];
}

interface WbGood {
  nmId?: number;
  barcode?: string;
  quantity?: number;
  sizeName?: string;
}

interface WbGoodsResponse {
  goods?: WbGood[];
}

async function fetchSuppliesPage(token: string, next: number): Promise<WbSuppliesResponse> {
  const url = `${WB_BASE}/api/v1/supplies?limit=${PAGE_LIMIT}&next=${next}`;
  const resp = await fetch(url, { method: "GET", headers: { Authorization: token } });
  if (!resp.ok) throw new Error(`WB supplies ${resp.status}: ${(await resp.text()).slice(0, 500)}`);
  return (await resp.json()) as WbSuppliesResponse;
}

async function fetchGoods(token: string, supplyId: string): Promise<WbGood[]> {
  const url = `${WB_BASE}/api/v1/supplies/${encodeURIComponent(supplyId)}/goods`;
  const resp = await fetch(url, { method: "GET", headers: { Authorization: token } });
  if (!resp.ok) throw new Error(`WB goods ${supplyId} ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const json = (await resp.json()) as WbGoodsResponse;
  return json.goods ?? [];
}

async function upsertSupplies(sb: SupabaseClient, rows: WbSupply[]): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map((s) => ({
    id: s.id,
    name: s.name ?? null,
    date_created: s.dateCreated ?? null,
    warehouse_id: s.warehouseId ?? null,
    warehouse_name: s.warehouseName ?? null,
    status: s.status ?? null,
    boxes_count: s.boxesCount ?? null,
  }));
  const { error } = await sb.from("wb_supplies_v2").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(`upsert wb_supplies_v2: ${error.message}`);
}

async function upsertGoods(sb: SupabaseClient, supplyId: string, goods: WbGood[]): Promise<void> {
  if (goods.length === 0) return;
  await sb.from("wb_supply_items_v2").delete().eq("supply_id", supplyId);
  const payload = goods.map((g) => ({
    supply_id: supplyId,
    nm_id: g.nmId ?? null,
    barcode: g.barcode ?? null,
    quantity: g.quantity ?? 0,
    size_name: g.sizeName ?? null,
  }));
  const { error } = await sb.from("wb_supply_items_v2").insert(payload);
  if (error) throw new Error(`insert wb_supply_items_v2 (${supplyId}): ${error.message}`);
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
  const jobId = await openJob(supabase);
  try {
    const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
    if (!token) throw new Error("WB_TOKEN_READ / WB_API_TOKEN not set");

    let next = 0;
    let totalSupplies = 0;
    let totalGoods = 0;
    for (let page = 0; page < 50; page++) {
      const resp = await fetchSuppliesPage(token, next);
      const supplies = resp.supplies ?? [];
      if (supplies.length === 0) break;
      await upsertSupplies(supabase, supplies);
      totalSupplies += supplies.length;

      for (const s of supplies) {
        try {
          const goods = await fetchGoods(token, s.id);
          await upsertGoods(supabase, s.id, goods);
          totalGoods += goods.length;
        } catch (e) {
          console.error(`goods ${s.id}:`, e);
        }
      }

      if (typeof resp.next !== "number" || resp.next === next || supplies.length < PAGE_LIMIT) break;
      next = resp.next;
    }

    await closeJob(supabase, jobId, "ok", totalSupplies, totalGoods, null, {
      supplies: totalSupplies,
      goods: totalGoods,
    });
    return new Response(
      JSON.stringify({ ok: true, supplies: totalSupplies, goods: totalGoods }),
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
