// fetch-ozon-postings — заказы и продажи Ozon.
// Шаг второй подключения Ozon, план — docs/integrations/OZON_PODKLYUCHENIE.md.
//
// У Ozon единица учёта — отправление, а не заказ: один заказ покупателя может
// уехать несколькими отправлениями. ФБО и ФБС отдаются разными методами, состав
// одинаковый — кладём в одну таблицу с пометкой схемы.
//
// Полный ответ площадки сохраняем в raw: документация Ozon из рабочей среды
// недоступна, и это единственный способ потом достроить недостающее, не
// перезапрашивая кабинет.
//
// На площадку не пишет ничего: у ключа права «Admin read only».
//
// ?days=N — за сколько дней забрать (по умолчанию 30). Первый прогон делается
// с большим окном, дальше хватает суток с запасом.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-ozon-postings";
const OZON_BASE = "https://api-seller.ozon.ru";
const PAGE_LIMIT = 1000;
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

interface OzonPostingProduct {
  offer_id?: string;
  sku?: number;
  quantity?: number;
  price?: string | number;
}

interface OzonPosting {
  posting_number?: string;
  order_id?: number;
  order_number?: string;
  status?: string;
  created_at?: string;
  in_process_at?: string;
  shipment_date?: string;
  delivering_date?: string;
  cancel_reason_id?: number;
  cancellation?: { cancel_reason?: string } | null;
  analytics_data?: { warehouse_name?: string } | null;
  products?: OzonPostingProduct[];
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

/** ФБО: /v2/posting/fbo/list, ответ в result массивом. */
async function loadFbo(
  token: { clientId: string; apiKey: string },
  since: string,
  to: string,
): Promise<OzonPosting[]> {
  const out: OzonPosting[] = [];
  for (let offset = 0; offset < 20000; offset += PAGE_LIMIT) {
    const raw = (await ozonPost("/v2/posting/fbo/list", token, {
      dir: "ASC",
      filter: { since, to },
      limit: PAGE_LIMIT,
      offset,
      translit: true,
      with: { analytics_data: true, financial_data: true },
    })) as { result?: OzonPosting[] };
    const items = raw.result ?? [];
    out.push(...items);
    if (items.length < PAGE_LIMIT) break;
    await sleep(PAUSE_MS);
  }
  return out;
}

/** ФБС: /v3/posting/fbs/list, ответ в result.postings. */
async function loadFbs(
  token: { clientId: string; apiKey: string },
  since: string,
  to: string,
): Promise<OzonPosting[]> {
  const out: OzonPosting[] = [];
  for (let offset = 0; offset < 20000; offset += PAGE_LIMIT) {
    const raw = (await ozonPost("/v3/posting/fbs/list", token, {
      dir: "ASC",
      filter: { since, to },
      limit: PAGE_LIMIT,
      offset,
      with: { analytics_data: true, financial_data: true },
    })) as { result?: { postings?: OzonPosting[]; has_next?: boolean } };
    const items = raw.result?.postings ?? [];
    out.push(...items);
    if (!raw.result?.has_next) break;
    await sleep(PAUSE_MS);
  }
  return out;
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
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 30), 1), 365);
  const to = new Date();
  const since = new Date(to.getTime() - days * 86400 * 1000);

  const { data: logRow } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: { days } })
    .select("id")
    .single();
  const jobId: number | null = (logRow as { id: number } | null)?.id ?? null;

  try {
    const clientId = Deno.env.get("OZON_CLIENT_ID");
    const apiKey = Deno.env.get("OZON_API_KEY");
    if (!clientId || !apiKey) throw new Error("OZON_CLIENT_ID / OZON_API_KEY не заданы");
    const token = { clientId, apiKey };

    const sinceIso = since.toISOString();
    const toIso = to.toISOString();

    const errors: Record<string, string> = {};
    let fbo: OzonPosting[] = [];
    let fbs: OzonPosting[] = [];

    // Схемы тянем по отдельности: если одна откажет, вторая всё равно доедет.
    try {
      fbo = await loadFbo(token, sinceIso, toIso);
    } catch (e) {
      errors.fbo = e instanceof Error ? e.message : String(e);
    }
    await sleep(PAUSE_MS);
    try {
      fbs = await loadFbs(token, sinceIso, toIso);
    } catch (e) {
      errors.fbs = e instanceof Error ? e.message : String(e);
    }

    const fetchedAt = new Date().toISOString();
    const postingRows: Record<string, unknown>[] = [];
    const itemRows: Record<string, unknown>[] = [];

    const add = (p: OzonPosting, scheme: "fbo" | "fbs") => {
      if (!p.posting_number) return;
      postingRows.push({
        posting_number: p.posting_number,
        order_id: p.order_id ?? null,
        order_number: p.order_number ?? null,
        scheme,
        status: p.status ?? null,
        created_at: p.created_at ?? p.in_process_at ?? null,
        shipment_date: p.shipment_date ?? null,
        delivering_date: p.delivering_date ?? null,
        cancel_reason: p.cancellation?.cancel_reason ?? null,
        warehouse_name: p.analytics_data?.warehouse_name ?? null,
        raw: p,
        fetched_at: fetchedAt,
      });
      // Один артикул в отправлении может встретиться несколькими строками -
      // складываем, иначе upsert по (отправление, артикул) потеряет часть.
      const byOffer = new Map<string, { sku: number | null; quantity: number; price: number | null }>();
      for (const it of p.products ?? []) {
        if (!it.offer_id) continue;
        const cur = byOffer.get(it.offer_id) ?? { sku: null, quantity: 0, price: null };
        cur.quantity += Number(it.quantity ?? 0);
        cur.sku = cur.sku ?? it.sku ?? null;
        const price = it.price == null ? null : Number(it.price);
        cur.price = cur.price ?? (Number.isFinite(price as number) ? price : null);
        byOffer.set(it.offer_id, cur);
      }
      for (const [offerId, v] of byOffer) {
        itemRows.push({
          posting_number: p.posting_number,
          offer_id: offerId,
          sku: v.sku,
          quantity: v.quantity,
          price: v.price,
          fetched_at: fetchedAt,
        });
      }
    };

    for (const p of fbo) add(p, "fbo");
    for (const p of fbs) add(p, "fbs");

    // Отправления пишем до состава: у состава ссылка на отправление.
    for (let i = 0; i < postingRows.length; i += 500) {
      const { error } = await supabase
        .from("ozon_postings")
        .upsert(postingRows.slice(i, i + 500), { onConflict: "posting_number" });
      if (error) throw new Error(`ozon_postings upsert: ${error.message}`);
    }
    for (let i = 0; i < itemRows.length; i += 500) {
      const { error } = await supabase
        .from("ozon_posting_items")
        .upsert(itemRows.slice(i, i + 500), { onConflict: "posting_number,offer_id" });
      if (error) throw new Error(`ozon_posting_items upsert: ${error.message}`);
    }

    const result = {
      ok: Object.keys(errors).length === 0,
      okno_dney: days,
      fbo: fbo.length,
      fbs: fbs.length,
      otpravleniy: postingRows.length,
      strok_sostava: itemRows.length,
      ...(Object.keys(errors).length > 0 ? { oshibki: errors } : {}),
    };

    if (jobId) {
      await supabase.from("ingestion_log").update({
        status: Object.keys(errors).length === 0 ? "ok" : "error",
        finished_at: new Date().toISOString(),
        rows_in: fbo.length + fbs.length,
        rows_out: itemRows.length,
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
