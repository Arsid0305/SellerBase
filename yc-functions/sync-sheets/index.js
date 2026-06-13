if (!globalThis.WebSocket) globalThis.WebSocket = require('ws');
// sync-sheets v0.3 — заливает PL WB (нед) в Google Sheet по структуре владелицы.

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const JOB_NAME = 'sync-sheets';

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  return createClient(url, key, { auth: { persistSession: false } });
}

function parseSa() {
  const b64 = process.env.GOOGLE_SA_JSON_B64;
  const raw = process.env.GOOGLE_SA_JSON;
  if (!b64 && !raw) throw new Error('GOOGLE_SA_JSON_B64 (or GOOGLE_SA_JSON) not set');
  return JSON.parse(b64 ? Buffer.from(b64, 'base64').toString('utf8') : raw);
}

function b64url(buf) {
  return (typeof buf === 'string' ? Buffer.from(buf) : buf)
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function makeJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(sa.private_key, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${header}.${payload}.${sig}`;
}

async function getAccessToken(sa) {
  const jwt = makeJwt(sa);
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function gsGet(token, spreadsheetId, range) {
  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!resp.ok) throw new Error(`Sheets GET ${range}: ${resp.status} ${(await resp.text()).slice(0, 300)}`);
  return resp.json();
}

async function gsBatchUpdate(token, spreadsheetId, valueRanges) {
  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: valueRanges }),
    },
  );
  if (!resp.ok) throw new Error(`Sheets batchUpdate: ${resp.status} ${(await resp.text()).slice(0, 300)}`);
  return resp.json();
}

// Parse week header like "01.12-07.12" or "1-7.09" or "30.12-05.01" → ISO start date.
// year is needed because Excel labels don't include year.
function parseWeekStart(label, year) {
  if (!label) return null;
  const s = String(label).trim();
  // First part of "-": "01.12" or "1" or "30.12"
  const left = s.split('-')[0].trim();
  let day, month;
  if (left.includes('.')) {
    [day, month] = left.split('.').map((x) => parseInt(x, 10));
  } else {
    // "1-7.09" → left="1", we need month from second part
    day = parseInt(left, 10);
    const right = s.split('-')[1] || '';
    const mt = right.match(/\.(\d{1,2})/);
    if (!mt) return null;
    month = parseInt(mt[1], 10);
  }
  if (!day || !month) return null;
  // Edge case: "30.12-05.01" — week pre-spans year boundary, start belongs to prev year
  const yr = (month === 12 && day >= 28) ? year - 1 : year;
  return new Date(Date.UTC(yr, month - 1, day)).toISOString().slice(0, 10);
}

// Column number (1-based) → letter (A, B, ..., Z, AA, AB...)
function colLetter(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

module.exports.handler = async () => {
  const supabase = adminClient();
  const { data: logRow, error: logErr } = await supabase
    .from('ingestion_log').insert({ job_name: JOB_NAME, meta: {} }).select('id').single();
  if (logErr || !logRow) {
    throw new Error(`Failed to init ingestion_log: ${logErr?.message ?? 'no row returned'}`);
  }
  const jobId = logRow.id;

  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error('GOOGLE_SHEET_ID not set');
    const year = parseInt(process.env.SYNC_YEAR || '2025', 10);

    const sa = parseSa();
    const token = await getAccessToken(sa);

    // 1) Read week headers from "PL WB (нед)" row 3
    const TAB = 'PL WB (нед)';
    const headers = await gsGet(token, sheetId, `${TAB}!3:3`);
    const headerRow = (headers.values && headers.values[0]) || [];
    if (headerRow.length === 0) throw new Error(`Tab "${TAB}" not found or row 3 empty`);

    // 2) Map column index (1-based) → week start date
    const colByDate = {};
    headerRow.forEach((label, idx) => {
      const dt = parseWeekStart(label, year);
      if (dt) colByDate[dt] = idx + 1; // 1-based
    });

    // 3) Get weekly data from DB
    const { data: weekly, error } = await supabase
      .from('v_wb_pl_weekly')
      .select('*')
      .gte('week_from', `${year}-01-01`)
      .lt('week_from', `${year + 1}-01-01`)
      .order('week_from');
    if (error) throw new Error(`v_wb_pl_weekly: ${error.message}`);

    // 4) For each weekly row find matching column by week_from
    // Excel "30.12-05.01" labels include weeks from prev year — try exact match first,
    // then fuzzy: find a column whose start is within ±3 days of week_from.
    const writes = []; // {row, col, value}
    const colDates = Object.keys(colByDate).sort();
    let matched = 0;
    let unmatched = 0;
    for (const r of (weekly || [])) {
      const wf = r.week_from;
      let col = colByDate[wf];
      if (!col) {
        // fuzzy match within 3 days
        const t0 = new Date(wf).getTime();
        const candidate = colDates
          .map((d) => ({ d, diff: Math.abs(new Date(d).getTime() - t0) }))
          .sort((a, b) => a.diff - b.diff)[0];
        if (candidate && candidate.diff <= 3 * 86400 * 1000) col = colByDate[candidate.d];
      }
      if (!col) { unmatched++; continue; }
      matched++;
      writes.push({ row: 7, col, value: r.sales_qty });        // R7  Продажи шт
      writes.push({ row: 14, col, value: r.by_card_rub });     // R14 Продано по карточке
      writes.push({ row: 15, col, value: r.retail_net_rub });  // R15 Выручка
      writes.push({ row: 20, col, value: r.ppvz_for_pay_rub }); // R20 К перечислению
      writes.push({ row: 22, col, value: r.returns_rub });     // R22 Возвраты руб
      writes.push({ row: 23, col, value: r.returns_qty });     // R23 Возвраты шт
    }

    if (writes.length === 0) throw new Error('Nothing to write — check week headers in your sheet');

    // 5) Build value ranges and batch update
    const valueRanges = writes.map((w) => ({
      range: `${TAB}!${colLetter(w.col)}${w.row}`,
      values: [[w.value == null ? '' : w.value]],
    }));

    // batch in chunks of 100
    for (let i = 0; i < valueRanges.length; i += 100) {
      await gsBatchUpdate(token, sheetId, valueRanges.slice(i, i + 100));
    }

    if (jobId) {
      await supabase.from('ingestion_log').update({
        status: 'ok',
        finished_at: new Date().toISOString(),
        rows_in: weekly?.length || 0,
        rows_out: writes.length,
        meta: { year, matched, unmatched, weeks_in_db: weekly?.length || 0 },
      }).eq('id', jobId);
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, matched, unmatched, writes: writes.length }) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (jobId) await supabase.from('ingestion_log').update({
      status: 'error', finished_at: new Date().toISOString(), error_text: message,
    }).eq('id', jobId);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: message }) };
  }
};
