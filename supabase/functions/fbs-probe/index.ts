// fbs-probe — временная разведка методов ФБС на обеих площадках.
//
// Владелица начинает торговать по ФБС и на ВБ, и на Ozon. Нужно понять, что
// площадки отдают по этой модели: остатки на складе продавца и продажи
// отдельно от ФБО. Документация ВБ и Ozon из рабочей среды закрыта сетевым
// фильтром, поиск даёт только пересказы - поэтому спрашиваем сами API.
//
// Только читает. Ни на одну площадку ничего не пишет.
//
// Удалить вместе с ozon-probe, когда ФБС заработает.
//
// ?what=ozon — методы ФБС Ozon
// ?what=wb   — методы ФБС ВБ (Маркетплейс)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { checkCronSecret } from "../_shared/auth.ts";

type Proba = { name: string; url: string; method: "GET" | "POST"; body?: unknown };

const OZON = "https://api-seller.ozon.ru";
const WB_MP = "https://marketplace-api.wildberries.ru";
const WB_ST = "https://statistics-api.wildberries.ru";

const nazad = (dney: number) => new Date(Date.now() - dney * 86400_000).toISOString();

const OZON_PROBY: Proba[] = [
  { name: "отправления ФБС", method: "POST", url: `${OZON}/v3/posting/fbs/list`,
    body: { filter: { since: nazad(30), to: new Date().toISOString() }, limit: 5, offset: 0, with: {} } },
  { name: "склады ФБС", method: "POST", url: `${OZON}/v1/warehouse/list`,
    body: { limit: 100, offset: 0 } },
  { name: "остатки по складам ФБС v1", method: "POST", url: `${OZON}/v1/product/info/stocks-by-warehouse/fbs`,
    body: { sku: [] } },
  { name: "остатки по складам ФБС v2", method: "POST", url: `${OZON}/v2/product/info/stocks-by-warehouse/fbs`,
    body: { sku: [] } },
];

const WB_PROBY: Proba[] = [
  { name: "склады продавца", method: "GET", url: `${WB_MP}/api/v3/warehouses` },
  { name: "склады ВБ для отгрузки", method: "GET", url: `${WB_MP}/api/v3/offices` },
  { name: "сборочные задания ФБС", method: "GET", url: `${WB_MP}/api/v3/orders?limit=5&next=0` },
  { name: "поставки ФБС", method: "GET", url: `${WB_MP}/api/v3/supplies?limit=5&next=0` },
  { name: "продажи (там же ФБС)", method: "GET",
    url: `${WB_ST}/api/v1/supplier/sales?dateFrom=${nazad(7).slice(0, 19)}&flag=0` },
];

function stroenie(text: string): unknown {
  try {
    const d = JSON.parse(text);
    const inner = (d as { result?: unknown }).result ?? d;
    if (Array.isArray(inner)) {
      return { strok: inner.length, pervaya: inner[0] ?? null };
    }
    if (inner && typeof inner === "object") {
      const o = inner as Record<string, unknown>;
      const out: Record<string, unknown> = { klyuchi: Object.keys(o) };
      for (const [k, v] of Object.entries(o)) {
        if (Array.isArray(v)) out[k] = { strok: v.length, pervaya: v[0] ?? null };
      }
      return out;
    }
    return inner;
  } catch {
    return text.slice(0, 300);
  }
}

Deno.serve(async (req: Request) => {
  const gate = checkCronSecret(req);
  if (!gate.ok) return gate.response;

  const what = new URL(req.url).searchParams.get("what") ?? "ozon";

  const ozonHeaders = {
    "Client-Id": Deno.env.get("OZON_CLIENT_ID") ?? "",
    "Api-Key": Deno.env.get("OZON_API_KEY") ?? "",
    "Content-Type": "application/json",
  };
  const wbToken = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN") ?? "";
  const wbHeaders = { Authorization: wbToken, "Content-Type": "application/json" };

  const proby = what === "wb" ? WB_PROBY : OZON_PROBY;
  const headers = what === "wb" ? wbHeaders : ozonHeaders;

  const out = [];
  for (const p of proby) {
    try {
      const resp = await fetch(p.url, {
        method: p.method,
        headers,
        ...(p.method === "POST" ? { body: JSON.stringify(p.body) } : {}),
      });
      const text = await resp.text();
      out.push({
        chto: p.name,
        put: p.url.replace(OZON, "").replace(WB_MP, "").replace(WB_ST, "").split("?")[0],
        status: resp.status,
        ok: resp.ok,
        stroenie: stroenie(text),
      });
    } catch (e) {
      out.push({ chto: p.name, put: p.url, status: 0, ok: false,
        stroenie: e instanceof Error ? e.message : String(e) });
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  return new Response(JSON.stringify({ ploshchadka: what, rezultaty: out }), {
    headers: { "Content-Type": "application/json" },
  });
});
