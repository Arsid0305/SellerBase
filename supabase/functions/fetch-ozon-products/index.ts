// fetch-ozon-products — товары и остатки кабинета Ozon.
// Шаг первый подключения Ozon, план — docs/integrations/OZON_PODKLYUCHENIE.md.
//
// Пишет в ozon_products, ozon_stocks (текущий срез) и ozon_stocks_history
// (посуточная история). На площадку не пишет ничего: у ключа права
// «Admin read only», методов записи у него нет.
//
// Урок ВБ, ради которого заведена история: без посуточной записи нельзя ни
// доказать пропажу товара, ни увидеть, что остаток замер. На ВБ это выяснилось
// дорого — 1 493 штуки простояли месяц незамеченными.
//
// Связь с каталогом — по артикулу: offer_id у Ozon = my_article у нас.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-ozon-products";
const OZON_BASE = "https://api-seller.ozon.ru";
const PAGE_LIMIT = 1000;
const PAUSE_MS = 700; // Ozon не любит частых запросов, идём с паузой

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

interface OzonProduct {
  product_id?: number;
  offer_id?: string;
  sku?: number;
  archived?: boolean;
  is_discounted?: boolean;
  has_fbo_stocks?: boolean;
  has_fbs_stocks?: boolean;
}

interface OzonStock {
  type?: string;
  present?: number;
  reserved?: number;
  sku?: number;
}

interface OzonStockItem {
  product_id?: number;
  offer_id?: string;
  stocks?: OzonStock[];
}

async function ozonPost(
  path: string,
  token: { clientId: string; apiKey: string },
  body: unknown,
): Promise<unknown> {
  const resp = await fetch(`${OZON_BASE}${path}`, {
    method: "POST",
    headers: {
      "Client-Id": token.clientId,
      "Api-Key": token.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Ozon ${resp.status} ${path}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
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
  const snapshotDate = new Date().toISOString().slice(0, 10);

  const { data: logRow } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: { snapshot_date: snapshotDate } })
    .select("id")
    .single();
  const jobId: number | null = (logRow as { id: number } | null)?.id ?? null;

  try {
    const clientId = Deno.env.get("OZON_CLIENT_ID");
    const apiKey = Deno.env.get("OZON_API_KEY");
    if (!clientId || !apiKey) throw new Error("OZON_CLIENT_ID / OZON_API_KEY не заданы");
    const token = { clientId, apiKey };

    // ── товары ────────────────────────────────────────────────────────
    const products: OzonProduct[] = [];
    let lastId = "";
    for (let page = 0; page < 20; page++) {
      const raw = (await ozonPost("/v3/product/list", token, {
        filter: { visibility: "ALL" },
        last_id: lastId,
        limit: PAGE_LIMIT,
      })) as { result?: { items?: OzonProduct[]; last_id?: string } };
      const items = raw.result?.items ?? [];
      products.push(...items);
      lastId = raw.result?.last_id ?? "";
      if (items.length < PAGE_LIMIT || !lastId) break;
      await sleep(PAUSE_MS);
    }

    const fetchedAt = new Date().toISOString();
    const productRows = products
      .filter((p) => p.product_id != null && p.offer_id)
      .map((p) => ({
        product_id: p.product_id!,
        offer_id: p.offer_id!,
        sku: p.sku ?? null,
        archived: p.archived === true,
        is_discounted: p.is_discounted === true,
        has_fbo_stocks: p.has_fbo_stocks === true,
        has_fbs_stocks: p.has_fbs_stocks === true,
        fetched_at: fetchedAt,
      }));

    if (productRows.length > 0) {
      const { error } = await supabase
        .from("ozon_products")
        .upsert(productRows, { onConflict: "product_id" });
      if (error) throw new Error(`ozon_products upsert: ${error.message}`);
    }

    await sleep(PAUSE_MS);

    // ── остатки ───────────────────────────────────────────────────────
    const stockItems: OzonStockItem[] = [];
    let cursor = "";
    for (let page = 0; page < 20; page++) {
      const raw = (await ozonPost("/v4/product/info/stocks", token, {
        filter: { visibility: "ALL" },
        cursor,
        limit: PAGE_LIMIT,
      })) as { items?: OzonStockItem[]; cursor?: string; total?: number };
      const items = raw.items ?? [];
      stockItems.push(...items);
      cursor = raw.cursor ?? "";
      if (items.length < PAGE_LIMIT || !cursor) break;
      await sleep(PAUSE_MS);
    }

    const stockRows: Array<{
      product_id: number;
      stock_type: string;
      offer_id: string;
      sku: number | null;
      present: number;
      reserved: number;
      fetched_at: string;
    }> = [];
    for (const it of stockItems) {
      if (it.product_id == null || !it.offer_id) continue;
      // Ozon отдаёт по строке на тип склада; складываем на случай, если типов
      // окажется несколько строк с одним именем.
      const byType = new Map<string, { present: number; reserved: number; sku: number | null }>();
      for (const st of it.stocks ?? []) {
        const type = st.type === "fbo" || st.type === "fbs" ? st.type : null;
        if (!type) continue;
        const cur = byType.get(type) ?? { present: 0, reserved: 0, sku: null };
        cur.present += Number(st.present ?? 0);
        cur.reserved += Number(st.reserved ?? 0);
        cur.sku = cur.sku ?? st.sku ?? null;
        byType.set(type, cur);
      }
      for (const [type, v] of byType) {
        stockRows.push({
          product_id: it.product_id,
          stock_type: type,
          offer_id: it.offer_id,
          sku: v.sku,
          present: v.present,
          reserved: v.reserved,
          fetched_at: fetchedAt,
        });
      }
    }

    if (stockRows.length > 0) {
      const { error } = await supabase
        .from("ozon_stocks")
        .upsert(stockRows, { onConflict: "product_id,stock_type" });
      if (error) throw new Error(`ozon_stocks upsert: ${error.message}`);

      // Товар, пропавший из ответа, остатка не имеет — иначе старые строки
      // висели бы вечно, как это было с закрытыми складами ВБ.
      const { error: pruneErr } = await supabase
        .from("ozon_stocks")
        .delete()
        .lt("fetched_at", fetchedAt);
      if (pruneErr) throw new Error(`ozon_stocks prune: ${pruneErr.message}`);

      const historyRows = stockRows.map((r) => ({
        snapshot_date: snapshotDate,
        product_id: r.product_id,
        stock_type: r.stock_type,
        offer_id: r.offer_id,
        present: r.present,
        reserved: r.reserved,
      }));
      const { error: histErr } = await supabase
        .from("ozon_stocks_history")
        .upsert(historyRows, { onConflict: "snapshot_date,product_id,stock_type" });
      if (histErr) throw new Error(`ozon_stocks_history upsert: ${histErr.message}`);
    }

    const fbo = stockRows.filter((r) => r.stock_type === "fbo").reduce((a, r) => a + r.present, 0);
    const fbs = stockRows.filter((r) => r.stock_type === "fbs").reduce((a, r) => a + r.present, 0);

    if (jobId) {
      await supabase.from("ingestion_log").update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_in: products.length,
        rows_out: stockRows.length,
        meta: {
          snapshot_date: snapshotDate,
          tovarov: productRows.length,
          strok_ostatkov: stockRows.length,
          fbo,
          fbs,
        },
      }).eq("id", jobId);
    }

    return json({ ok: true, tovarov: productRows.length, strok_ostatkov: stockRows.length, fbo, fbs });
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
