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
  // Считаем итог по всем товарам, а не показываем первые строки: владелице
  // нужен ответ «сколько всего лежит», а не пример ответа Ozon.
  try {
    const resp = await fetch(`${OZON_BASE}/v4/product/info/stocks`, {
      method: "POST",
      headers,
      body: JSON.stringify({ filter: { visibility: "ALL" }, cursor: "", limit: 1000 }),
    });
    const text = await resp.text();
    if (!resp.ok) {
      out.stocks = { status: resp.status, error: text.slice(0, 300) };
    } else {
      type Stock = { type?: string; present?: number; reserved?: number };
      type Item = { offer_id?: string; stocks?: Stock[] };
      const data = JSON.parse(text) as { items?: Item[] };
      const items = data.items ?? [];
      let fbo = 0, fbs = 0, rez = 0;
      const s_ostatkom: { article: string; fbo: number; fbs: number }[] = [];
      for (const it of items) {
        let iFbo = 0, iFbs = 0;
        for (const st of it.stocks ?? []) {
          const n = Number(st.present ?? 0);
          rez += Number(st.reserved ?? 0);
          if (st.type === "fbo") iFbo += n;
          else if (st.type === "fbs") iFbs += n;
        }
        fbo += iFbo;
        fbs += iFbs;
        if (iFbo + iFbs > 0) s_ostatkom.push({ article: it.offer_id ?? "", fbo: iFbo, fbs: iFbs });
      }
      out.stocks = {
        status: resp.status,
        tovarov: items.length,
        fbo_vsego: fbo,
        fbs_vsego: fbs,
        v_rezerve: rez,
        s_ostatkom: s_ostatkom,
      };
    }
  } catch (e) {
    out.stocks = { error: e instanceof Error ? e.message : String(e) };
  }

  return json({ ok: true, client_id: clientId, proverka: out });
});
