// telegram-alerts — ежедневная проверка ключевых метрик и алерт владелице в Telegram.
// Запускается раз в день кроном.
// 5 проверок параллельно: маржа, выкуп, дефицит, простой cron-задач, новые SKU без cost.
// Если все проверки зелёные — ничего не отправляет (не спамим «всё ок»).
// verify_jwt = false (вызывается из pg_cron).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE_URL = "https://seller-base.vercel.app";

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

interface CheckResult {
  name: string;
  ok: boolean;
  severity: "red" | "yellow";
  message: string | null; // Markdown-блок алерта, null если всё в порядке
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function fmtPp(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}п.п.`;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ============================================================
// 1. Маржа упала >5pp за последние 7д vs предыдущие 7д
// ============================================================
async function checkMargin(supabase: SupabaseClient): Promise<CheckResult> {
  const today = new Date();
  const d0 = dateStr(today);
  const d7 = dateStr(new Date(today.getTime() - 7 * 86_400_000));
  const d14 = dateStr(new Date(today.getTime() - 14 * 86_400_000));

  const [{ data: curRows, error: curErr }, { data: prevRows, error: prevErr }] = await Promise.all([
    supabase.rpc("get_pnl_by_period", { p_from: d7, p_to: d0 }),
    supabase.rpc("get_pnl_by_period", { p_from: d14, p_to: d7 }),
  ]);
  if (curErr || prevErr) {
    return {
      name: "margin",
      ok: false,
      severity: "yellow",
      message: `🟡 *Маржа* — не удалось посчитать (${curErr?.message ?? prevErr?.message})`,
    };
  }

  const totalMargin = (rows: { revenue_rub: number; net_profit_rub: number }[] | null) => {
    const rev = (rows ?? []).reduce((s, r) => s + Number(r.revenue_rub ?? 0), 0);
    const profit = (rows ?? []).reduce((s, r) => s + Number(r.net_profit_rub ?? 0), 0);
    return rev > 0 ? (profit / rev) * 100 : null;
  };

  const curMargin = totalMargin(curRows);
  const prevMargin = totalMargin(prevRows);
  if (curMargin == null || prevMargin == null) {
    return { name: "margin", ok: true, severity: "yellow", message: null };
  }

  const deltaPp = curMargin - prevMargin;
  if (deltaPp < -5) {
    // топ-3 SKU где маржа упала больше всего
    const prevBySku = new Map<string, { margin: number; revenue: number }>();
    for (const r of (prevRows ?? []) as Array<{ my_article: string; margin_pct: number | null; revenue_rub: number }>) {
      if (r.margin_pct != null) prevBySku.set(r.my_article, { margin: Number(r.margin_pct) * 100, revenue: Number(r.revenue_rub) });
    }
    const drops: { article: string; deltaPp: number }[] = [];
    for (const r of (curRows ?? []) as Array<{ my_article: string; margin_pct: number | null; revenue_rub: number }>) {
      if (r.margin_pct == null) continue;
      const prev = prevBySku.get(r.my_article);
      if (!prev || prev.revenue <= 0) continue;
      const curPct = Number(r.margin_pct) * 100;
      drops.push({ article: r.my_article, deltaPp: curPct - prev.margin });
    }
    drops.sort((a, b) => a.deltaPp - b.deltaPp);
    const top3 = drops.slice(0, 3);
    const top3Str = top3.length > 0
      ? top3.map((d) => `${d.article} (${fmtPp(d.deltaPp)})`).join(", ")
      : "нет данных по отдельным SKU";

    return {
      name: "margin",
      ok: false,
      severity: "red",
      message:
        `🔴 *Маржа упала на ${fmtPp(deltaPp)}*\n` +
        `За 7д: ${curMargin.toFixed(1)}% vs предыдущие 7д: ${prevMargin.toFixed(1)}%\n` +
        `Топ-3 SKU где маржа упала: ${top3Str}\n` +
        `→ Открыть ${BASE_URL}/margin-analyzer`,
    };
  }

  return { name: "margin", ok: true, severity: "yellow", message: null };
}

// ============================================================
// 2. Выкуп упал >10pp за последние 7д vs предыдущие 7д
//    Выкуп = доля проданных (quantity>0) среди всех движений (продажи+возвраты).
// ============================================================
async function checkBuyout(supabase: SupabaseClient): Promise<CheckResult> {
  const today = new Date();
  const d0 = dateStr(today);
  const d7 = dateStr(new Date(today.getTime() - 7 * 86_400_000));
  const d14 = dateStr(new Date(today.getTime() - 14 * 86_400_000));

  const buyoutRate = async (from: string, to: string): Promise<number | null> => {
    const { data, error } = await supabase
      .from("wb_reports_fact")
      .select("quantity")
      .eq("doc_type_name", "Продажа")
      .gte("sale_dt", from)
      .lte("sale_dt", to);
    if (error || !data) return null;
    let sold = 0;
    let returned = 0;
    for (const r of data as Array<{ quantity: number | null }>) {
      const q = Number(r.quantity ?? 0);
      if (q > 0) sold += q;
      else if (q < 0) returned += -q;
    }
    const total = sold + returned;
    return total > 0 ? (sold / total) * 100 : null;
  };

  const [curRate, prevRate] = await Promise.all([
    buyoutRate(d7, d0),
    buyoutRate(d14, d7),
  ]);

  if (curRate == null || prevRate == null) {
    return { name: "buyout", ok: true, severity: "yellow", message: null };
  }

  const deltaPp = curRate - prevRate;
  if (deltaPp < -10) {
    return {
      name: "buyout",
      ok: false,
      severity: "red",
      message:
        `🔴 *Выкуп упал на ${fmtPp(deltaPp)}*\n` +
        `За 7д: ${curRate.toFixed(1)}% vs предыдущие 7д: ${prevRate.toFixed(1)}%\n` +
        `→ Открыть ${BASE_URL}/deficit`,
    };
  }

  return { name: "buyout", ok: true, severity: "yellow", message: null };
}

// ============================================================
// 3. SKU в дефиците — daysOfStock < 7 для топ-20 SKU по выручке
// ============================================================
async function checkDeficit(supabase: SupabaseClient): Promise<CheckResult> {
  const today = new Date();
  const d0 = dateStr(today);
  const d30 = dateStr(new Date(today.getTime() - 30 * 86_400_000));

  const [{ data: pnlRows, error: pnlErr }, { data: turnoverRows, error: turErr }, { data: skus, error: skuErr }] =
    await Promise.all([
      supabase.rpc("get_pnl_by_period", { p_from: d30, p_to: d0 }),
      supabase.from("v_turnover_by_sku").select("nm_id, stock_qty, turnover_days"),
      supabase.from("sku_catalog").select("id, my_article, wb_article"),
    ]);
  if (pnlErr || turErr || skuErr) {
    return {
      name: "deficit",
      ok: false,
      severity: "yellow",
      message: `🟡 *Дефицит* — не удалось посчитать (${pnlErr?.message ?? turErr?.message ?? skuErr?.message})`,
    };
  }

  const top20 = ((pnlRows ?? []) as Array<{ sku_id: number; my_article: string; wb_article: number; revenue_rub: number }>)
    .slice()
    .sort((a, b) => Number(b.revenue_rub) - Number(a.revenue_rub))
    .slice(0, 20);

  const turnoverByNm = new Map<number, { stock_qty: number; turnover_days: number | null }>();
  for (const r of (turnoverRows ?? []) as Array<{ nm_id: number; stock_qty: number; turnover_days: number | null }>) {
    turnoverByNm.set(r.nm_id, { stock_qty: r.stock_qty, turnover_days: r.turnover_days });
  }

  const deficits: { article: string; daysOfStock: number }[] = [];
  for (const sku of top20) {
    const t = turnoverByNm.get(sku.wb_article);
    if (!t) continue;
    // turnover_days == null означает либо нет продаж (сток лежит мёртвым грузом — не дефицит),
    // либо нет стока вообще (stock_qty === 0) — это и есть дефицит.
    if (t.stock_qty === 0) {
      deficits.push({ article: sku.my_article, daysOfStock: 0 });
    } else if (t.turnover_days != null && t.turnover_days < 7) {
      deficits.push({ article: sku.my_article, daysOfStock: t.turnover_days });
    }
  }

  if (deficits.length === 0) {
    return { name: "deficit", ok: true, severity: "yellow", message: null };
  }

  deficits.sort((a, b) => a.daysOfStock - b.daysOfStock);
  const listStr = deficits
    .slice(0, 10)
    .map((d) => `${d.article} (${d.daysOfStock.toFixed(0)}д)`)
    .join(", ");

  return {
    name: "deficit",
    ok: false,
    severity: "red",
    message:
      `🔴 *Дефицит стока: ${deficits.length} SKU из топ-20 по выручке*\n` +
      `${listStr}\n` +
      `→ Открыть ${BASE_URL}/deficit`,
  };
}

// ============================================================
// 4. Cron не работает — last_success > 24ч для любого ingestion_log job
// ============================================================
async function checkCronHealth(supabase: SupabaseClient): Promise<CheckResult> {
  const { data, error } = await supabase
    .from("ingestion_log")
    .select("job_name, status, finished_at, started_at")
    .order("started_at", { ascending: false })
    .limit(500);
  if (error) {
    return {
      name: "cron",
      ok: false,
      severity: "yellow",
      message: `🟡 *Cron* — не удалось прочитать ingestion_log (${error.message})`,
    };
  }

  const lastSuccessByJob = new Map<string, string>(); // job_name -> finished_at ISO
  for (const r of (data ?? []) as Array<{ job_name: string; status: string; finished_at: string | null }>) {
    if (r.status === "ok" && r.finished_at && !lastSuccessByJob.has(r.job_name)) {
      lastSuccessByJob.set(r.job_name, r.finished_at);
    }
  }
  const allJobs = new Set<string>();
  for (const r of (data ?? []) as Array<{ job_name: string }>) allJobs.add(r.job_name);

  const now = Date.now();
  const stale: { job: string; hoursAgo: number | null }[] = [];
  for (const job of allJobs) {
    const lastSuccess = lastSuccessByJob.get(job);
    const hoursAgo = lastSuccess ? (now - new Date(lastSuccess).getTime()) / 3_600_000 : null;
    if (hoursAgo == null || hoursAgo > 24) {
      stale.push({ job, hoursAgo });
    }
  }

  if (stale.length === 0) {
    return { name: "cron", ok: true, severity: "yellow", message: null };
  }

  const listStr = stale
    .map((s) => `${s.job} (${s.hoursAgo == null ? "нет успешных запусков" : `${s.hoursAgo.toFixed(0)}ч назад`})`)
    .join(", ");

  return {
    name: "cron",
    ok: false,
    severity: "red",
    message:
      `🔴 *Cron не работает: ${stale.length} задач(а) без успешного запуска >24ч*\n` +
      `${listStr}\n` +
      `→ Открыть ${BASE_URL}/data-quality`,
  };
}

// ============================================================
// 5. Новые SKU без cost — добавлены за последние 7д, cost_price_rub IS NULL/0
// ============================================================
async function checkNewSkuNoCost(supabase: SupabaseClient): Promise<CheckResult> {
  const d7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("sku_catalog")
    .select("my_article, cost_price_rub, created_at")
    .gte("created_at", d7);
  if (error) {
    return {
      name: "new_sku_no_cost",
      ok: false,
      severity: "yellow",
      message: `🟡 *Новые SKU* — не удалось проверить (${error.message})`,
    };
  }

  const noCost = (data ?? []).filter(
    (r: { cost_price_rub: number | null }) => r.cost_price_rub == null || Number(r.cost_price_rub) === 0,
  ) as Array<{ my_article: string }>;

  if (noCost.length === 0) {
    return { name: "new_sku_no_cost", ok: true, severity: "yellow", message: null };
  }

  const listStr = noCost.slice(0, 15).map((r) => r.my_article).join(", ");

  return {
    name: "new_sku_no_cost",
    ok: false,
    severity: "yellow",
    message:
      `🟡 *${noCost.length} новых SKU без себестоимости*\n` +
      `${listStr}\n` +
      `→ Открыть ${BASE_URL}/data-quality`,
  };
}

async function sendTelegram(token: string, chatId: string, text: string): Promise<boolean> {
  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  return resp.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = adminClient();

    const results = await Promise.all([
      checkMargin(supabase),
      checkBuyout(supabase),
      checkDeficit(supabase),
      checkCronHealth(supabase),
      checkNewSkuNoCost(supabase),
    ]);

    const alerts = results.filter((r) => r.message != null);

    if (alerts.length === 0) {
      return json({ ok: true, alerts_sent: 0, checks: results.map((r) => ({ name: r.name, ok: r.ok })) });
    }

    const today = dateStr(new Date());
    const header = `📊 *SellerBase — алерты на ${today}*\n`;
    const body = alerts.map((a) => a.message).join("\n\n");
    const text = `${header}\n${body}`;

    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
    let sent = false;
    if (token && chatId) {
      sent = await sendTelegram(token, chatId, text);
    }

    return json({
      ok: true,
      alerts_sent: sent ? alerts.length : 0,
      checks: results.map((r) => ({ name: r.name, ok: r.ok, severity: r.severity })),
      telegram_sent: sent,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
