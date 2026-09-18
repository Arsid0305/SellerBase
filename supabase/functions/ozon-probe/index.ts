// ozon-probe — временная разведка методов Ozon. Только читает, ничего не пишет.
// Документация Ozon из рабочей среды закрыта сетевым фильтром, поэтому
// строение ответа выясняется опытом. Удалить, когда разведка закончена.
//
// ?what=realization — отчёт о реализации за месяц
// ?what=cashflow    — движение денег по неделям
// ?what=zalezhi     — перебор методов про остатки, залежи и хранение по товарам

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { checkCronSecret } from "../_shared/auth.ts";

const BASE = "https://api-seller.ozon.ru";

// Кандидаты на «хранение и залежи по товарам». Что из этого живо -
// выясняется только запросом: угадывать по памяти нельзя.
const ZALEZHI: [string, unknown][] = [
  ["/v1/analytics/manage/stocks", { limit: 5, offset: 0 }],
  ["/v2/analytics/stock_on_warehouse", { limit: 5, offset: 0, warehouse_type: "ALL" }],
  ["/v1/analytics/stock_on_warehouse", { limit: 5, offset: 0, warehouse_type: "ALL" }],
  ["/v1/analytics/turnover/stocks", { limit: 5, offset: 0 }],
  ["/v1/report/warehouse/stock", { language: "RU", warehouseType: "ALL" }],
  ["/v1/finance/products/buyout", { date_from: "2026-08-01", date_to: "2026-08-31" }],
];

function shapeOf(text: string): unknown {
  try {
    const data = JSON.parse(text);
    const res = (data as { result?: unknown }).result ?? data;
    if (Array.isArray(res)) return { strok: res.length, pervaya: res[0] ?? null };
    if (res && typeof res === "object") {
      const o = res as Record<string, unknown>;
      const out: Record<string, unknown> = { klyuchi: Object.keys(o) };
      for (const [k, v] of Object.entries(o)) {
        if (Array.isArray(v)) {
          out[k] = { strok: v.length, pervaya: v[0] ?? null };
        }
      }
      return out;
    }
    return res;
  } catch {
    return text.slice(0, 400);
  }
}

Deno.serve(async (req: Request) => {
  const gate = checkCronSecret(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const what = url.searchParams.get("what") ?? "realization";
  const headers = {
    "Client-Id": Deno.env.get("OZON_CLIENT_ID") ?? "",
    "Api-Key": Deno.env.get("OZON_API_KEY") ?? "",
    "Content-Type": "application/json",
  };
  const now = new Date();

  const zapros = async (path: string, body: unknown) => {
    const resp = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    return { path, status: resp.status, ok: resp.ok, shape: shapeOf(text) };
  };

  if (what === "zalezhi") {
    const out = [];
    for (const [path, body] of ZALEZHI) {
      out.push(await zapros(path, body));
      await new Promise((r) => setTimeout(r, 600));
    }
    return new Response(JSON.stringify({ probe: "zalezhi", rezultaty: out }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (what === "cashflow") {
    const days = Number(url.searchParams.get("days") ?? 120);
    return new Response(
      JSON.stringify(await zapros("/v1/finance/cash-flow-statement/list", {
        date: {
          from: new Date(now.getTime() - days * 86400_000).toISOString(),
          to: now.toISOString(),
        },
        page: 1,
        page_size: 5,
        with_details: true,
      })),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  const back = Number(url.searchParams.get("back") ?? 1);
  const m = new Date(now.getFullYear(), now.getMonth() - back, 1);
  return new Response(
    JSON.stringify(await zapros("/v2/finance/realization", {
      month: m.getMonth() + 1,
      year: m.getFullYear(),
    })),
    { headers: { "Content-Type": "application/json" } },
  );
});
