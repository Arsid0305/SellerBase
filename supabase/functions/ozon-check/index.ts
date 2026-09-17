// ozon-check — проверка связи с кабинетом Ozon. Ничего не пишет ни в базу,
// ни на площадку: только спрашивает у Ozon список товаров и считает, сколько
// их. Нужна дважды: сейчас, чтобы убедиться что ключ рабочий, и потом - ключ
// Ozon живёт три месяца, и раз в квартал этим же запросом видно, жив ли он.
//
// Ключи лежат в секретах функций (OZON_CLIENT_ID, OZON_API_KEY) - в коде и в
// репозитории их нет.
//
// Права ключа: «Admin read only», 278 методов, без внесения изменений.
// Решение владелицы 17.09.2026 - из программы на площадку ничего не уходит.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { checkCronSecret } from "../_shared/auth.ts";

const OZON_BASE = "https://api-seller.ozon.ru";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const gate = checkCronSecret(req);
  if (!gate.ok) return gate.response;

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const clientId = Deno.env.get("OZON_CLIENT_ID");
  const apiKey = Deno.env.get("OZON_API_KEY");
  if (!clientId || !apiKey) {
    return json({ ok: false, error: "OZON_CLIENT_ID / OZON_API_KEY не заданы в секретах" }, 500);
  }

  const headers = {
    "Client-Id": clientId,
    "Api-Key": apiKey,
    "Content-Type": "application/json",
  };

  const out: Record<string, unknown> = {};

  // 1. Список товаров: самый безобидный метод, сразу показывает, что ключ живой.
  try {
    const resp = await fetch(`${OZON_BASE}/v3/product/list`, {
      method: "POST",
      headers,
      body: JSON.stringify({ filter: { visibility: "ALL" }, last_id: "", limit: 100 }),
    });
    const text = await resp.text();
    if (!resp.ok) {
      out.product_list = { status: resp.status, error: text.slice(0, 300) };
    } else {
      const data = JSON.parse(text) as { result?: { items?: unknown[]; total?: number } };
      out.product_list = {
        status: resp.status,
        vsego: data.result?.total ?? null,
        v_otvete: data.result?.items?.length ?? 0,
        primer: (data.result?.items ?? []).slice(0, 3),
      };
    }
  } catch (e) {
    out.product_list = { error: e instanceof Error ? e.message : String(e) };
  }

  // 2. Остатки на складах — второй по важности после самих товаров.
  try {
    const resp = await fetch(`${OZON_BASE}/v4/product/info/stocks`, {
      method: "POST",
      headers,
      body: JSON.stringify({ filter: { visibility: "ALL" }, cursor: "", limit: 100 }),
    });
    const text = await resp.text();
    out.stocks = resp.ok
      ? { status: resp.status, otvet: text.slice(0, 400) }
      : { status: resp.status, error: text.slice(0, 300) };
  } catch (e) {
    out.stocks = { error: e instanceof Error ? e.message : String(e) };
  }

  return json({ ok: true, client_id: clientId, proverka: out });
});
