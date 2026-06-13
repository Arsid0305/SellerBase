// sync-sheets v0.4 — создаёт/обновляет Google Spreadsheet под структуру владелицы.
// 1) Первый запуск: создаёт новую таблицу, добавляет листы Дашборд / PL WB / PL WB (нед),
//    шапки, формулы, голубую заливку ячеек ручного ввода.
//    ID сохраняется в pricing_settings.description под ключом 'google_sheet_id_<YEAR>'.
// 2) Последующие запуски: заливают в PL WB (нед) данные за указанный год.
//    Формулы и Дашборд НЕ трогаются — пересчитаются сами.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const JOB_NAME = "sync-sheets";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("env SUPABASE_URL/SERVICE_ROLE_KEY missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

function parseSa(): { client_email: string; private_key: string } {
  const b64 = Deno.env.get("GOOGLE_SA_JSON_B64");
  const raw = Deno.env.get("GOOGLE_SA_JSON");
  if (!b64 && !raw) throw new Error("GOOGLE_SA_JSON_B64 (or GOOGLE_SA_JSON) not set");
  return JSON.parse(b64 ? atob(b64) : (raw as string));
}

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function getAccessToken(sa: { client_email: string; private_key: string }, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: sa.client_email, scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const signingInput = `${header}.${payload}`;
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${b64url(new Uint8Array(sig))}`;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data).slice(0, 300)}`);
  return data.access_token;
}

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function weekLabel(weekStartISO: string): string {
  const d = new Date(weekStartISO + "T00:00:00Z");
  const end = new Date(d.getTime() + 6 * 86400 * 1000);
  const fmt = (x: Date) => `${String(x.getUTCDate()).padStart(2, "0")}.${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${fmt(d)}-${fmt(end)}`;
}

async function ga(token: string, url: string, method = "GET", body?: unknown): Promise<unknown> {
  const resp = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Google ${method}: ${resp.status} ${txt.slice(0, 400)}`);
  }
  return resp.json();
}

async function createSpreadsheet(token: string, title: string, year: number): Promise<{ id: string; sheetIds: Record<string, number> }> {
  const r = await ga(token, "https://sheets.googleapis.com/v4/spreadsheets", "POST", {
    properties: { title, locale: "ru_RU", timeZone: "Europe/Moscow" },
    sheets: [
      { properties: { title: "Дашборд", gridProperties: { rowCount: 50, columnCount: 14 } } },
      { properties: { title: "PL WB", gridProperties: { rowCount: 70, columnCount: 16 } } },
      { properties: { title: "PL WB (нед)", gridProperties: { rowCount: 80, columnCount: 60 } } },
    ],
  }) as { spreadsheetId: string; sheets: Array<{ properties: { sheetId: number; title: string } }> };
  const sheetIds: Record<string, number> = {};
  r.sheets.forEach((s) => { sheetIds[s.properties.title] = s.properties.sheetId; });

  // Build PL WB (нед) headers
  const monStart = new Date(Date.UTC(year, 0, 1));
  const dow = monStart.getUTCDay() || 7;
  monStart.setUTCDate(monStart.getUTCDate() - (dow - 1));
  const weeks: string[] = [];
  for (let i = 0; i < 53; i++) {
    const ws = new Date(monStart.getTime() + i * 7 * 86400 * 1000);
    weeks.push(weekLabel(ws.toISOString().slice(0, 10)));
  }
  const totalCol = colLetter(2 + 53 + 1);

  const writes: Array<{ range: string; values: unknown[][] }> = [];
  writes.push({ range: "PL WB (нед)!A1", values: [[`Прибыли и убытки, еженедельно — ${year}`]] });
  writes.push({ range: "PL WB (нед)!A3", values: [["Метрика", "", ...weeks, "ИТОГО"]] });
  const labels: Array<[number, string]> = [
    [7, "Продажи шт"], [14, "Продано по карточке"],
    [15, "Выручка ВБ реализовал"], [17, "Комиссия ВБ"], [18, "% комиссии"],
    [20, "К перечислению"], [22, "Возвраты, руб"], [23, "Возвраты, шт"],
  ];
  for (const [row, label] of labels) writes.push({ range: `PL WB (нед)!A${row}`, values: [[label]] });

  // Year-total formulas
  for (const r of [7, 14, 15, 20, 22, 23]) {
    writes.push({ range: `PL WB (нед)!${totalCol}${r}`, values: [[`=SUM(C${r}:${colLetter(2 + 53)}${r})`]] });
  }
  // R17 commission and R18 percent formulas
  for (let c = 3; c <= 2 + 53; c++) {
    const L = colLetter(c);
    writes.push({ range: `PL WB (нед)!${L}17`, values: [[`=IFERROR(${L}14-${L}20,0)`]] });
    writes.push({ range: `PL WB (нед)!${L}18`, values: [[`=IFERROR(${L}17/${L}14,0)`]] });
  }
  writes.push({ range: `PL WB (нед)!${totalCol}17`, values: [[`=IFERROR(${totalCol}14-${totalCol}20,0)`]] });
  writes.push({ range: `PL WB (нед)!${totalCol}18`, values: [[`=IFERROR(${totalCol}17/${totalCol}14,0)`]] });

  // Дашборд
  const dashWrites: Array<[string, unknown]> = [
    ["A1", `ФИНАНСОВЫЙ ДАШБОРД ${year}`],
    ["A5", "Показатель"], ["C5", "Значение"],
    ["A6", "Продажи, шт"], ["C6", `='PL WB (нед)'!${totalCol}7`],
    ["A7", "Выручка"], ["C7", `='PL WB (нед)'!${totalCol}15`],
    ["A8", "Цена карточки"], ["C8", `='PL WB (нед)'!${totalCol}14`],
    ["A9", "К перечислению"], ["C9", `='PL WB (нед)'!${totalCol}20`],
    ["A10", "Возвраты руб"], ["C10", `='PL WB (нед)'!${totalCol}22`],
    ["A11", "% комиссии (общий)"], ["C11", `=IFERROR(('PL WB (нед)'!${totalCol}14-'PL WB (нед)'!${totalCol}20)/'PL WB (нед)'!${totalCol}14,0)`],
  ];
  for (const [a, v] of dashWrites) writes.push({ range: `Дашборд!${a}`, values: [[v]] });

  // PL WB (помесячно) — пока labels
  const months = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  writes.push({ range: "PL WB!A2", values: [[`P&L по месяцам, WB — ${year}`]] });
  writes.push({ range: "PL WB!C3", values: [months] });
  writes.push({ range: "PL WB!A7", values: [["Продажи шт"]] });
  writes.push({ range: "PL WB!A14", values: [["По карточке"]] });
  writes.push({ range: "PL WB!A15", values: [["Выручка"]] });
  writes.push({ range: "PL WB!A20", values: [["К перечислению"]] });

  await ga(token, `https://sheets.googleapis.com/v4/spreadsheets/${r.spreadsheetId}/values:batchUpdate`, "POST", {
    valueInputOption: "USER_ENTERED",
    data: writes,
  });

  // Format
  await ga(token, `https://sheets.googleapis.com/v4/spreadsheets/${r.spreadsheetId}:batchUpdate`, "POST", {
    requests: [
      { updateSheetProperties: {
        properties: { sheetId: sheetIds["PL WB (нед)"], gridProperties: { frozenRowCount: 3, frozenColumnCount: 2 } },
        fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
      }},
      { repeatCell: {
        range: { sheetId: sheetIds["PL WB (нед)"], startRowIndex: 2, endRowIndex: 3 },
        cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.85, green: 0.95, blue: 1 }, horizontalAlignment: "CENTER" } },
        fields: "userEnteredFormat(textFormat.bold,backgroundColor,horizontalAlignment)",
      }},
      ...[7, 14, 15, 20, 22, 23].map((r) => ({
        repeatCell: {
          range: { sheetId: sheetIds["PL WB (нед)"], startRowIndex: r - 1, endRowIndex: r, startColumnIndex: 2, endColumnIndex: 2 + 53 },
          cell: { userEnteredFormat: { backgroundColor: { red: 0.78, green: 0.92, blue: 0.98 } } },
          fields: "userEnteredFormat.backgroundColor",
        },
      })),
      { repeatCell: {
        range: { sheetId: sheetIds["Дашборд"], startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 16, foregroundColor: { red: 1, green: 1, blue: 1 } }, backgroundColor: { red: 0.2, green: 0.4, blue: 0.6 }, horizontalAlignment: "CENTER" } },
        fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)",
      }},
    ],
  });

  return { id: r.spreadsheetId, sheetIds };
}

async function shareWith(token: string, fileId: string, email?: string) {
  if (!email) return;
  try {
    await ga(token, `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?sendNotificationEmail=true`, "POST", {
      role: "writer", type: "user", emailAddress: email,
    });
  } catch (e) {
    console.error(`Share with ${email}: ${e instanceof Error ? e.message : e}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = adminClient();
  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") || "2025", 10);
  const forceCreate = url.searchParams.get("create") === "1";

  const { data: logRow } = await supabase.from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: { year } }).select("id").single();
  const jobId: number = logRow?.id ?? 0;

  try {
    const sa = parseSa();
    const token = await getAccessToken(sa, "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive");

    const settingKey = `google_sheet_id_${year}`;
    const { data: sett } = await supabase.from("pricing_settings").select("description").eq("key", settingKey).maybeSingle();
    let spreadsheetId = sett?.description?.trim();
    let created = false;

    if (!spreadsheetId || forceCreate) {
      const title = `SellerBase: PL WB ${year}`;
      const r = await createSpreadsheet(token, title, year);
      spreadsheetId = r.id;
      const ownerEmail = url.searchParams.get("email") || Deno.env.get("OWNER_EMAIL");
      await shareWith(token, spreadsheetId, ownerEmail);
      await supabase.from("pricing_settings").upsert({
        key: settingKey, value: 0, description: spreadsheetId,
      }, { onConflict: "key" });
      created = true;
    }

    // Read weekly data
    const { data: weekly } = await supabase.from("v_wb_pl_weekly")
      .select("*").gte("week_from", `${year}-01-01`).lt("week_from", `${year + 1}-01-01`).order("week_from");

    // Read existing week headers row 3
    const hdr = await ga(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent("PL WB (нед)!3:3")}`) as { values?: string[][] };
    const headerRow: string[] = (hdr.values && hdr.values[0]) || [];

    const colByMonday: Record<string, number> = {};
    headerRow.forEach((label, idx) => {
      if (!label || !label.includes("-")) return;
      const left = String(label).split("-")[0].trim();
      const parts = left.split(".");
      if (parts.length !== 2) return;
      const day = parseInt(parts[0], 10), month = parseInt(parts[1], 10);
      if (!day || !month) return;
      const yr = (month === 12 && day >= 28) ? year - 1 : year;
      const iso = new Date(Date.UTC(yr, month - 1, day)).toISOString().slice(0, 10);
      colByMonday[iso] = idx + 1;
    });

    const data: Array<{ range: string; values: unknown[][] }> = [];
    let matched = 0, unmatched = 0;
    const rowMap = { "7": "sales_qty", "14": "by_card_rub", "15": "retail_net_rub", "20": "ppvz_for_pay_rub", "22": "returns_rub", "23": "returns_qty" } as const;

    for (const r of (weekly || []) as Array<Record<string, unknown>>) {
      const wf = r.week_from as string;
      let col = colByMonday[wf];
      if (!col) {
        const t0 = new Date(wf).getTime();
        const cand = Object.entries(colByMonday)
          .map(([d, c]) => ({ d, c, diff: Math.abs(new Date(d).getTime() - t0) }))
          .sort((a, b) => a.diff - b.diff);
        if (cand[0] && cand[0].diff <= 3 * 86400 * 1000) col = cand[0].c;
      }
      if (!col) { unmatched++; continue; }
      matched++;
      for (const [rowStr, key] of Object.entries(rowMap)) {
        const v = r[key];
        data.push({ range: `PL WB (нед)!${colLetter(col)}${rowStr}`, values: [[v == null ? "" : v]] });
      }
    }

    if (data.length > 0) {
      for (let i = 0; i < data.length; i += 200) {
        await ga(token, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, "POST", {
          valueInputOption: "USER_ENTERED",
          data: data.slice(i, i + 200),
        });
      }
    }

    await supabase.from("ingestion_log").update({
      status: "ok", finished_at: new Date().toISOString(),
      rows_in: weekly?.length || 0, rows_out: data.length,
      meta: { year, spreadsheet_id: spreadsheetId, matched, unmatched, created },
    }).eq("id", jobId);

    return new Response(JSON.stringify({
      ok: true, spreadsheet_id: spreadsheetId,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      matched, unmatched, writes: data.length, created,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("ingestion_log").update({
      status: "error", finished_at: new Date().toISOString(), error_text: msg,
    }).eq("id", jobId);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
