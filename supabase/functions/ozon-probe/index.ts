// ozon-probe — временная разведка методов Ozon. Только читает, ничего не пишет.
// Документация Ozon из рабочей среды закрыта сетевым фильтром, поэтому
// строение ответа выясняется опытом. Удалить, когда финансы Ozon заработают.
//
// ?what=realization — отчёт о реализации за месяц (строение строки)
// ?what=cashflow  — движение денег по неделям

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { checkCronSecret } from "../_shared/auth.ts";

const BASE = "https://api-seller.ozon.ru";

Deno.serve(async (req: Request) => {
  const gate = checkCronSecret(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const what = url.searchParams.get("what") ?? "realization";
  const monthBack = Number(url.searchParams.get("back") ?? 1);

  const headers = {
    "Client-Id": Deno.env.get("OZON_CLIENT_ID") ?? "",
    "Api-Key": Deno.env.get("OZON_API_KEY") ?? "",
    "Content-Type": "application/json",
  };

  const now = new Date();
  const m = new Date(now.getFullYear(), now.getMonth() - monthBack, 1);

  let path: string;
  let body: unknown;
  if (what === "cashflow") {
    path = "/v1/finance/cash-flow-statement/list";
    body = {
      date: {
        from: new Date(now.getTime() - Number(url.searchParams.get("days") ?? 120) * 86400 * 1000).toISOString(),
        to: now.toISOString(),
      },
      page: Number(url.searchParams.get("page") ?? 1),
      page_size: 5,
      with_details: true,
    };
  } else {
    path = "/v2/finance/realization";
    body = { month: m.getMonth() + 1, year: m.getFullYear() };
  }

  const resp = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await resp.text();

  // Отдаём строение, а не весь ответ: нужны имена полей и один пример.
  let shape: unknown = text.slice(0, 1500);
  try {
    const data = JSON.parse(text) as { result?: { rows?: unknown[]; cash_flows?: unknown[] } };
    const rows = data.result?.rows ?? data.result?.cash_flows ?? [];
    const details = (data.result as { details?: unknown[] } | undefined)?.details ?? [];
    shape = {
      vsego_strok: Array.isArray(rows) ? rows.length : 0,
      pervaya_stroka: Array.isArray(rows) ? rows[0] : null,
      klyuchi_result: data.result ? Object.keys(data.result) : [],
      podrobnosti: Array.isArray(details) ? details.slice(0, 1) : details,
    };
  } catch { /* оставляем текст */ }

  return new Response(
    JSON.stringify({ ok: resp.ok, status: resp.status, path, mesyac: body, shape }),
    { headers: { "Content-Type": "application/json" } },
  );
});
