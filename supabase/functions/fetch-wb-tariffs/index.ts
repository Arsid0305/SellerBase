// fetch-wb-tariffs — ежедневный фетч общих тарифов WB (Box + Return).
// Лог в ingestion_log. UPSERT в wb_tariffs_box / wb_tariffs_return по (effective_date, warehouse_name).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const JOB_NAME = "fetch-wb-tariffs";
const WB_BASE = "https://common-api.wildberries.ru";

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

function toNum(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

interface WbBoxWh {
  warehouseName: string;
  geoName: string;
  boxDeliveryBase?: string;
  boxDeliveryLiter?: string;
  boxDeliveryMarketplaceBase?: string;
  boxDeliveryMarketplaceLiter?: string;
  boxStorageBase?: string;
  boxStorageLiter?: string;
  boxStorageCoefExpr?: string;
  boxDeliveryCoefExpr?: string;
}

interface WbReturnWh {
  warehouseName: string;
  geoName?: string;
  returnBase?: string;
  returnLiter?: string;
  // На случай разных полей в ответе API
  boxDeliveryReturnBase?: string;
  boxDeliveryReturnLiter?: string;
}

async function fetchWb<T>(path: string, token: string): Promise<T> {
  const resp = await fetch(`${WB_BASE}${path}`, { headers: { Authorization: token } });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`WB ${path} ${resp.status}: ${body.slice(0, 500)}`);
  }
  return await resp.json() as T;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = adminClient();
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const today = dateParam ?? new Date().toISOString().slice(0, 10);

  const { data: logRow, error: insErr } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: { effective_date: today } })
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
    const token = Deno.env.get("WB_TOKEN_READ");
    if (!token) throw new Error("WB_TOKEN_READ is not set in function secrets");

    // 1) BOX
    const boxJson = await fetchWb<{ response?: { data?: { warehouseList?: WbBoxWh[] } } }>(
      `/api/v1/tariffs/box?date=${today}`,
      token,
    );
    const boxList = boxJson?.response?.data?.warehouseList ?? [];
    const boxRows = boxList.map((w) => ({
      effective_date: today,
      warehouse_name: w.warehouseName,
      geo_name: w.geoName,
      box_delivery_base: toNum(w.boxDeliveryBase),
      box_delivery_liter: toNum(w.boxDeliveryLiter),
      box_delivery_marketplace_base: toNum(w.boxDeliveryMarketplaceBase),
      box_delivery_marketplace_liter: toNum(w.boxDeliveryMarketplaceLiter),
      box_storage_base: toNum(w.boxStorageBase),
      box_storage_liter: toNum(w.boxStorageLiter),
      warehouse_coef: toNum(w.boxStorageCoefExpr ?? w.boxDeliveryCoefExpr, 1),
      raw: w,
    }));
    if (boxRows.length > 0) {
      const { error } = await supabase
        .from("wb_tariffs_box")
        .upsert(boxRows, { onConflict: "effective_date,warehouse_name" });
      if (error) throw new Error(`wb_tariffs_box upsert: ${error.message}`);
    }

    // 2) RETURN
    const retJson = await fetchWb<{ response?: { data?: { warehouseList?: WbReturnWh[] } } }>(
      `/api/v1/tariffs/return?date=${today}`,
      token,
    );
    const retList = retJson?.response?.data?.warehouseList ?? [];
    const retRows = retList.map((w) => ({
      effective_date: today,
      warehouse_name: w.warehouseName,
      geo_name: w.geoName ?? null,
      return_base: toNum(w.returnBase ?? w.boxDeliveryReturnBase),
      return_liter: toNum(w.returnLiter ?? w.boxDeliveryReturnLiter),
      raw: w,
    }));
    if (retRows.length > 0) {
      const { error } = await supabase
        .from("wb_tariffs_return")
        .upsert(retRows, { onConflict: "effective_date,warehouse_name" });
      if (error) throw new Error(`wb_tariffs_return upsert: ${error.message}`);
    }

    await supabase
      .from("ingestion_log")
      .update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_in: boxList.length + retList.length,
        rows_out: boxRows.length + retRows.length,
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({ ok: true, box: boxRows.length, ret: retRows.length, date: today }),
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
