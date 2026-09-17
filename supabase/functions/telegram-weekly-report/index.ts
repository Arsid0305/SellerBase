// telegram-weekly-report — недельный снимок бизнеса в телеграм.
// Запускается кроном в понедельник 07:00 UTC (10:00 МСК): к этому времени
// ВБ уже закрыл прошлую неделю в отчёте реализации.
//
// Вся сборка цифр — в SQL-функции get_weekly_owner_report(): один источник
// истины, здесь только текст. Состав показателей и честная оценка
// «есть / частично / нет» — docs/WEEKLY_REVIEW.md.
//
// Ozon в сводке не упоминается: интеграции нет, писать «Ozon: 0» каждую
// неделю бессмысленно. Реклама не упоминается, пока сбор выключен.
//
// Параметр ?week=YYYY-MM-DD — собрать за конкретную неделю (понедельник).
// Без параметра берётся последняя закрытая неделя.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "telegram-weekly-report";
const BASE_URL = "https://seller-base.vercel.app";
const TG_LIMIT = 3800; // запас к лимиту телеграма в 4096 символов

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

// ── формат ───────────────────────────────────────────────────────────

function strip(text: unknown): string {
  return String(text ?? "").replace(/[_*`\[\]]/g, " ").replace(/\s+/g, " ").trim();
}

function rub(n: unknown): string {
  const v = Number(n ?? 0);
  return `${Math.round(v).toLocaleString("ru-RU")} ₽`;
}

function num(n: unknown): string {
  return Number(n ?? 0).toLocaleString("ru-RU");
}

/** Десятичная запятая вместо точки — как принято по-русски. */
function dec(n: unknown, digits = 1): string {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return "-";
  return v.toFixed(digits).replace(".", ",").replace(/,0+$/, "");
}

/** «41 товар» / «2 товара» / «60 товаров». */
function plural(n: unknown, one: string, few: string, many: string): string {
  const v = Math.abs(Math.round(Number(n ?? 0)));
  const mod10 = v % 10;
  const mod100 = v % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** «+12,5% к прошлой» — со знаком и стрелкой. Без базы сравнения вернёт пустое. */
function delta(cur: unknown, base: unknown, label: string): string {
  const c = Number(cur ?? 0);
  const b = Number(base ?? 0);
  if (!isFinite(c) || !isFinite(b) || b === 0) return "";
  const pct = ((c - b) / Math.abs(b)) * 100;
  const sign = pct >= 0 ? "+" : "";
  const arrow = pct >= 0 ? "↑" : "↓";
  return ` · ${arrow}${sign}${dec(pct)}% ${label}`;
}

/** Две строки сравнения: с прошлой неделей и со средним за 4 недели. */
function compare(cur: unknown, prev: unknown, avg4: unknown): string[] {
  const out: string[] = [];
  const a = delta(cur, prev, "к прошлой");
  const b = delta(cur, avg4, "к среднему за 4 недели");
  if (a) out.push(a.slice(3));
  if (b) out.push(b.slice(3));
  return out;
}

function flag(cur: unknown, base: unknown): string {
  const c = Number(cur ?? 0);
  const b = Number(base ?? 0);
  if (b === 0) return "";
  const pct = ((c - b) / Math.abs(b)) * 100;
  if (pct <= -20) return " 🔴";
  if (pct <= -5) return " 🟡";
  if (pct >= 10) return " 🟢";
  return "";
}

function ruDate(iso: unknown): string {
  const s = String(iso ?? "");
  const [y, m, d] = s.split("-");
  const months = ["января","февраля","марта","апреля","мая","июня",
                  "июля","августа","сентября","октября","ноября","декабря"];
  const mi = Number(m) - 1;
  if (!y || !d || mi < 0 || mi > 11) return s;
  return `${Number(d)} ${months[mi]}`;
}

// deno-lint-ignore no-explicit-any
function buildMessages(r: any): string[] {
  const p = r.period ?? {};
  const s = r.sales ?? {};
  const e = r.economy ?? {};
  const f = r.funnel ?? {};
  const st = r.stock ?? {};
  const a = r.assortment ?? {};
  const pp = r.price_promo ?? {};
  const c = r.cards ?? {};
  const fin = r.finance ?? {};

  const parts: string[] = [];

  // ── 1. Деньги ──────────────────────────────────────────────────────
  const money: string[] = [];
  money.push(`📊 *Неделя ${ruDate(p.week_start)} - ${ruDate(p.week_end)}*`);
  money.push("");
  money.push(`*Выручка* ${rub(s.revenue)}${flag(s.revenue, s.revenue_prev)}`);
  for (const l of compare(s.revenue, s.revenue_prev, s.revenue_avg4)) money.push(l);
  money.push("");
  money.push(`*Прибыль* ${rub(e.profit)}${flag(e.profit, e.profit_prev)}`);
  for (const l of compare(e.profit, e.profit_prev, e.profit_avg4)) money.push(l);
  money.push(`Маржа ${dec(e.margin_pct)}%`);
  money.push("");
  money.push(`Продано ${num(s.units)} шт${delta(s.units, s.units_prev, "к прошлой")}`);
  money.push(`Средний чек ${rub(s.avg_check)}`);
  money.push(`Торговали ${num(s.skus_sold)} ${plural(s.skus_sold, "товар", "товара", "товаров")}`);
  if (Number(s.returns_units) > 0) money.push(`Возвраты ${num(s.returns_units)} шт`);
  money.push("");
  money.push(`*Забрал ВБ*`);
  money.push(`· Комиссия ${rub(e.commission)}`);
  money.push(`· Логистика ${rub(e.logistics)}`);
  money.push(`· Хранение ${rub(e.storage)}`);
  if (Number(e.acquiring) > 0) money.push(`· Эквайринг ${rub(e.acquiring)}`);
  if (Number(e.penalty) > 0) money.push(`· Штрафы ${rub(e.penalty)} 🔴`);
  if (Number(e.deduction) > 0) money.push(`· Удержания ${rub(e.deduction)} 🔴`);
  if (Number(e.compensations) > 0) money.push(`· Возмещения ${rub(e.compensations)}`);
  money.push("");
  money.push(`Себестоимость проданного ${rub(e.cost)}`);
  money.push(`Начислено ВБ ${rub(fin.nachisleno)} · к выплате ${rub(fin.k_vyplate)}`);
  parts.push(money.join("\n"));

  // ── 2. Спрос и товары ──────────────────────────────────────────────
  const demand: string[] = [];
  demand.push(`👀 *Спрос*`);
  demand.push(`Переходов в карточки ${num(f.opens)}${delta(f.opens, f.opens_prev, "к прошлой")}`);
  demand.push(`В корзину ${num(f.carts)} · заказов ${num(f.orders)}${delta(f.orders, f.orders_prev, "к прошлой")}`);
  if (f.conv_cart != null) demand.push(`Карточка → корзина ${dec(f.conv_cart)}%`);
  if (f.conv_order != null) demand.push(`Корзина → заказ ${dec(f.conv_order)}%`);
  if (f.conv_buyout != null) demand.push(`Заказ → выкуп ${dec(f.conv_buyout)}%`);
  if (Number(f.cancels) > 0) demand.push(`Отмен ${num(f.cancels)}`);
  if (Number(f.returns) > 0) demand.push(`Возвратов от покупателей ${num(f.returns)}`);

  demand.push("");
  demand.push(`🏆 *Заработали больше всех*`);
  // deno-lint-ignore no-explicit-any
  for (const t of (a.top_profit ?? []) as any[]) {
    demand.push(`· ${strip(t.title)} - ${rub(t.profit)}, маржа ${dec(t.margin)}%`);
  }

  // deno-lint-ignore no-explicit-any
  const losers = (a.losers ?? []) as any[];
  if (losers.length > 0) {
    demand.push("");
    demand.push(`🔴 *Сработали в минус*`);
    for (const t of losers) {
      demand.push(`· ${strip(t.title)} - ${rub(t.profit)}, маржа ${dec(t.margin)}%`);
    }
  }
  if (Number(a.no_sales) > 0) {
    demand.push("");
    demand.push(`За неделю не продались ни разу: ${num(a.no_sales)} ${plural(a.no_sales, "товар", "товара", "товаров")}`);
  }
  parts.push(demand.join("\n"));

  // ── 3. Склад, цены, карточки ───────────────────────────────────────
  const rest: string[] = [];
  rest.push(`📦 *Склад ВБ*`);
  rest.push(`${num(st.units)} шт на ${num(st.skus_with)} ${plural(st.skus_with, "товаре", "товарах", "товарах")}`);
  if (Number(st.in_transit) > 0) rest.push(`В пути к покупателям ${num(st.in_transit)} шт`);
  if (Number(st.skus_zero) > 0) rest.push(`Без остатка ${num(st.skus_zero)} ${plural(st.skus_zero, "товар", "товара", "товаров")} 🟡`);
  if (Number(st.skus_over) > 0) rest.push(`Залежалось (хватит больше чем на 90 дней): ${num(st.skus_over)} ${plural(st.skus_over, "товар", "товара", "товаров")}`);
  // deno-lint-ignore no-explicit-any
  const out = (st.running_out ?? []) as any[];
  if (out.length > 0) {
    rest.push("");
    rest.push(`⏳ *Кончается товар*`);
    for (const t of out) {
      rest.push(`· ${strip(t.title)} - ${num(t.stock)} шт, на ${dec(t.days, 0)} ${plural(t.days, "день", "дня", "дней")} 🔴`);
    }
  }

  rest.push("");
  rest.push(`💰 *Цены и акции*`);
  rest.push(`Цена менялась у ${num(pp.price_changes)} ${plural(pp.price_changes, "товара", "товаров", "товаров")}`);
  rest.push(`Акций идёт ${num(pp.promos_active)} · участвует ${num(pp.skus_in_promo)} ${plural(pp.skus_in_promo, "карточка", "карточки", "карточек")}, в среднем ${dec(pp.participation_pct, 0)}%`);

  rest.push("");
  rest.push(`⭐ *Карточки*`);
  rest.push(`Рейтинг ${dec(c.rating_all, 2)} по ${num(c.reviews_all)} ${plural(c.reviews_all, "отзыву", "отзывам", "отзывам")}`);
  rest.push(`За неделю новых отзывов ${num(c.reviews_week)}${Number(c.negative_week) > 0 ? `, из них плохих ${num(c.negative_week)} 🔴` : ""}`);

  rest.push("");
  rest.push(`→ Подробно: ${BASE_URL}/pnl`);
  parts.push(rest.join("\n"));

  // Режем на куски по лимиту телеграма.
  const out2: string[] = [];
  for (const part of parts) {
    if (part.length <= TG_LIMIT) {
      out2.push(part);
      continue;
    }
    let buf = "";
    for (const line of part.split("\n")) {
      if ((buf + "\n" + line).length > TG_LIMIT) {
        out2.push(buf);
        buf = line;
      } else {
        buf = buf ? buf + "\n" + line : line;
      }
    }
    if (buf) out2.push(buf);
  }
  return out2;
}

async function sendTelegram(token: string, chatId: string, text: string): Promise<boolean> {
  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });
  return resp.ok;
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
  const week = url.searchParams.get("week");
  const dryRun = url.searchParams.get("dry") === "1";

  const { data: logRow } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: { week } })
    .select("id")
    .single();
  const jobId: number | null = (logRow as { id: number } | null)?.id ?? null;

  try {
    const { data, error } = await supabase.rpc("get_weekly_owner_report", {
      p_week_start: week,
    });
    if (error) throw new Error(`get_weekly_owner_report: ${error.message}`);

    const messages = buildMessages(data);

    if (dryRun) {
      if (jobId) {
        await supabase.from("ingestion_log").update({
          status: "ok", finished_at: new Date().toISOString(),
          rows_out: 0, meta: { week, dry_run: true },
        }).eq("id", jobId);
      }
      return json({ ok: true, dry_run: true, messages });
    }

    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

    const allow = (
      Deno.env.get("TELEGRAM_CHAT_ID") ??
      Deno.env.get("TELEGRAM_ALLOWED_CHAT_IDS") ??
      Deno.env.get("TELEGRAM_ALLOWED_CHAT_ID") ??
      ""
    ).split(",").map((s) => s.trim()).filter(Boolean);

    const { data: subsRaw } = await supabase
      .from("notification_subscribers")
      .select("telegram_chat_id")
      .eq("channel", "telegram")
      .eq("is_active", true);
    const subs = ((subsRaw ?? []) as { telegram_chat_id: string }[]).filter(
      (s) => allow.length === 0 || allow.includes(s.telegram_chat_id),
    );

    let sent = 0;
    for (const s of subs) {
      for (const m of messages) {
        const ok = await sendTelegram(token, s.telegram_chat_id, m);
        if (ok) sent += 1;
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    if (jobId) {
      await supabase.from("ingestion_log").update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_out: sent,
        meta: { week, subscribers: subs.length, messages: messages.length, sent },
      }).eq("id", jobId);
    }
    return json({ ok: true, subscribers: subs.length, messages: messages.length, sent });
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
