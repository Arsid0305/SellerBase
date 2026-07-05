// fetch-wb-prices — ежедневный фетч текущих цен WB по всем nm_id.
// API: GET https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter
// Категория токена: «Цены и скидки». Env: WB_TOKEN_READ ?? WB_API_TOKEN.
// UPSERT в wb_prices_fact на CURRENT_DATE. Идемпотентно (повторный запуск за день перезаписывает snapshot).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-wb-prices";
const WB_BASE = "https://discounts-prices-api.wildberries.ru";
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

interface WbSize {
  sizeID?: number;
  price?: number;
  discountedPrice?: number;
  clubDiscountedPrice?: number;
  techSizeName?: string;
}

interface WbGood {
  nmID: number;
  vendorCode?: string;
  currencyIsoCode4217?: string;
  discount?: number;
  clubDiscount?: number;
  editableSizePrice?: boolean;
  sizes?: WbSize[];
}

interface WbResponse {
  data?: { listGoods?: WbGood[] };
}

async function fetchPage(token: string, offset: number): Promise<WbGood[]> {
  const url = `${WB_BASE}/api/v2/list/goods/filter?limit=${PAGE_LIMIT}&offset=${offset}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: { Authorization: token },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`WB prices ${resp.status}: ${text.slice(0, 500)}`);
  }
  const json = (await resp.json()) as WbResponse;
  return json.data?.listGoods ?? [];
}

type PriceRow = {
  nm_id: number;
  date: string;
  price_rub: number;
  discount_pct: number;
  club_discount_pct: number;
  final_price_rub: number;
  editable_size_price: boolean;
};

function goodToRow(g: WbGood, dateIso: string): PriceRow | null {
  if (!g.nmID) return null;
  const size = (g.sizes ?? [])[0];
  const basePrice = Number(size?.price ?? 0);
  const finalPrice = Number(size?.clubDiscountedPrice ?? size?.discountedPrice ?? basePrice);
  if (!Number.isFinite(basePrice) || basePrice <= 0) return null;
  return {
    nm_id: g.nmID,
    date: dateIso,
    price_rub: basePrice,
    discount_pct: Number(g.discount ?? 0),
    club_discount_pct: Number(g.clubDiscount ?? 0),
    final_price_rub: Number.isFinite(finalPrice) && finalPrice > 0 ? finalPrice : basePrice,
    editable_size_price: Boolean(g.editableSizePrice),
  };
}

async function upsertBatch(supabase: SupabaseClient, rows: PriceRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("wb_prices_fact").upsert(rows, { onConflict: "nm_id,date" });
  if (error) throw new Error(`upsert wb_prices_fact: ${error.message}`);
}

async function logJob(
  supabase: SupabaseClient,
  status: "success" | "error",
  rowsAffected: number,
  message: string | null,
): Promise<void> {
  await supabase.from("integration_jobs").insert({
    job_name: JOB_NAME,
    status,
    rows_affected: rowsAffected,
    message,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cron = checkCronSecret(req);
  if (!cron.ok) return cron.response;

  const supabase = adminClient();
  const dateIso = new Date().toISOString().slice(0, 10);

  try {
    const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
    if (!token) throw new Error("WB_TOKEN_READ / WB_API_TOKEN not set in function secrets");

    let offset = 0;
    let totalRows = 0;
    for (let page = 0; page < 200; page++) {
      const goods = await fetchPage(token, offset);
      if (goods.length === 0) break;
      const rows = goods.map((g) => goodToRow(g, dateIso)).filter((r): r is PriceRow => r !== null);
      await upsertBatch(supabase, rows);
      totalRows += rows.length;
      if (goods.length < PAGE_LIMIT) break;
      offset += PAGE_LIMIT;
    }

    await logJob(supabase, "success", totalRows, null);
    return new Response(
      JSON.stringify({ ok: true, rowsAffected: totalRows, date: dateIso }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logJob(supabase, "error", 0, msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
