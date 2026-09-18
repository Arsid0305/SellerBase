// fetch-ozon-expenses — расходы Ozon: логистика, хранение, продвижение,
// эквайринг, штрафы, платная приёмка.
//
// Отчёт о реализации (fetch-ozon-finance) знает только продажу и ставку Ozon.
// Всё остальное, что Ozon удерживает, лежит в отчёте о движении денег:
// v1/finance/cash-flow-statement/list с with_details. Он режет время по
// неделям, поэтому неделя и есть единица хранения.
//
// Что забираем:
//   delivery.delivery_services.items — доставка до покупателя и сопутствующее
//   return.return_services.items     — обратная логистика
//   services.items                   — хранение, продвижение, эквайринг, штрафы
//   others.items                     — прочее (страховка и т.п.)
//
// Имена услуг Ozon отдаёт своими кодами. Переводим их на человеческий не
// здесь, а представлением в базе: код может появиться новый, и терять его
// на входе нельзя - лучше пусть попадёт в «прочее», чем исчезнет.
//
// На площадку не пишет ничего: у ключа права «Admin read only».
//
// ?days=N — за сколько дней назад забрать (по умолчанию 90).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-ozon-expenses";
const OZON_BASE = "https://api-seller.ozon.ru";
const PAUSE_MS = 700;
const PAGE_SIZE = 25;
const MAX_PAGES = 40;

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
const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const day = (iso?: string): string | null => (iso ? iso.slice(0, 10) : null);

interface ServiceItem {
  name?: string;
  price?: number;
}
interface ServiceBlock {
  items?: ServiceItem[];
  total?: number;
}
interface Detail {
  period?: { begin?: string; end?: string };
  delivery?: { amount?: number; total?: number; delivery_services?: ServiceBlock };
  return?: { amount?: number; total?: number; return_services?: ServiceBlock };
  services?: ServiceBlock;
  others?: ServiceBlock;
  payments?: { payment?: number }[];
  begin_balance_amount?: number;
  end_balance_amount?: number;
}
interface CashFlow {
  period?: { begin?: string; end?: string };
  orders_amount?: number;
  returns_amount?: number;
  commission_amount?: number;
  services_amount?: number;
  item_delivery_and_return_amount?: number;
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
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 90), 7), 800);

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
    const headers = {
      "Client-Id": clientId,
      "Api-Key": apiKey,
      "Content-Type": "application/json",
    };

    const now = new Date();
    const from = new Date(now.getTime() - days * 86400 * 1000);
    const fetchedAt = new Date().toISOString();

    // Итоги недели по period_begin: отчёт отдаёт их двумя списками -
    // cash_flows (сводка) и details (подробности). Сводим в одну строку.
    const weeks = new Map<string, Record<string, unknown>>();
    const services: Record<string, unknown>[] = [];
    let pages = 0;

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const resp = await fetch(`${OZON_BASE}/v1/finance/cash-flow-statement/list`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          date: { from: from.toISOString(), to: now.toISOString() },
          page,
          page_size: PAGE_SIZE,
          with_details: true,
        }),
      });
      const text = await resp.text();
      if (!resp.ok) throw new Error(`cash-flow ${resp.status}: ${text.slice(0, 300)}`);

      const data = JSON.parse(text) as {
        result?: { cash_flows?: CashFlow[]; details?: Detail[]; page_count?: number };
      };
      const flows = data.result?.cash_flows ?? [];
      const details = data.result?.details ?? [];
      pages = page;

      for (const f of flows) {
        const begin = day(f.period?.begin);
        if (!begin) continue;
        const row = weeks.get(begin) ?? { period_begin: begin, fetched_at: fetchedAt };
        row.period_end = day(f.period?.end) ?? begin;
        row.orders_amount = num(f.orders_amount);
        row.returns_amount = num(f.returns_amount);
        row.commission_amount = num(f.commission_amount);
        row.services_amount = num(f.services_amount);
        row.item_delivery_and_return_amount = num(f.item_delivery_and_return_amount);
        weeks.set(begin, row);
      }

      for (const d of details) {
        const begin = day(d.period?.begin);
        if (!begin) continue;
        const row = weeks.get(begin) ?? { period_begin: begin, fetched_at: fetchedAt };
        row.period_end = day(d.period?.end) ?? row.period_end ?? begin;
        row.payments_amount = (d.payments ?? []).reduce((s, p) => s + (Number(p.payment) || 0), 0);
        row.begin_balance_amount = num(d.begin_balance_amount);
        row.end_balance_amount = num(d.end_balance_amount);
        row.raw = d;
        weeks.set(begin, row);

        const blocks: [string, ServiceBlock | undefined][] = [
          ["delivery", d.delivery?.delivery_services],
          ["return", d.return?.return_services],
          ["services", d.services],
          ["others", d.others],
        ];
        for (const [block, b] of blocks) {
          for (const it of b?.items ?? []) {
            const name = it.name?.trim();
            const price = num(it.price);
            if (!name || price == null) continue;
            services.push({ period_begin: begin, block, name, price });
          }
        }
      }

      const pageCount = data.result?.page_count ?? 1;
      if (page >= pageCount || flows.length === 0) break;
      await sleep(PAUSE_MS);
    }

    const weekRows = [...weeks.values()];
    if (weekRows.length > 0) {
      const { error } = await supabase
        .from("ozon_cashflow")
        .upsert(weekRows, { onConflict: "period_begin" });
      if (error) throw new Error(`ozon_cashflow upsert: ${error.message}`);
    }

    // Одна услуга может встретиться в неделе несколькими строками - складываем,
    // иначе upsert по ключу (неделя, блок, услуга) потеряет часть суммы.
    const merged = new Map<string, Record<string, unknown>>();
    for (const s of services) {
      const key = `${s.period_begin}|${s.block}|${s.name}`;
      const prev = merged.get(key);
      if (prev) prev.price = (Number(prev.price) || 0) + (Number(s.price) || 0);
      else merged.set(key, { ...s });
    }
    const serviceRows = [...merged.values()];
    for (let i = 0; i < serviceRows.length; i += 500) {
      const { error } = await supabase
        .from("ozon_services")
        .upsert(serviceRows.slice(i, i + 500), { onConflict: "period_begin,block,name" });
      if (error) throw new Error(`ozon_services upsert: ${error.message}`);
    }

    const result = {
      ok: true,
      dney: days,
      stranic: pages,
      nedel: weekRows.length,
      uslug: serviceRows.length,
    };

    if (jobId) {
      await supabase.from("ingestion_log").update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_out: serviceRows.length,
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
