if (!globalThis.WebSocket) globalThis.WebSocket = require('ws');
// sync-sheets v0.4 — баркод EAN-13 из sku_catalog во всех листах.

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

async function writeTab(token, spreadsheetId, tabName, headerRow, dataRows) {
  const enc = encodeURIComponent;
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${enc(tabName + '!A:Z')}:clear`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
  );
  const values = [headerRow, ...dataRows];
  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${enc(tabName + '!A1')}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    },
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Sheets write error on "${tabName}": ${resp.status} ${text.slice(0, 300)}`);
  }
}

module.exports.handler = async () => {
  const supabase = adminClient();
  const { data: logRow } = await supabase
    .from('ingestion_log').insert({ job_name: JOB_NAME, meta: {} }).select('id').single();
  const jobId = logRow?.id;

  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error('GOOGLE_SHEET_ID not set');

    const sa = parseSa();
    const token = await getAccessToken(sa);

    let totalRows = 0;

    const today = new Date().toISOString().slice(0, 10);
    const from30 = new Date(Date.now() - 30 * 86400 * 1000).toISOString().slice(0, 10);

    // Справочник: wb_article → { my_article, barcode (EAN-13) }
    const { data: catalog } = await supabase
      .from('sku_catalog')
      .select('wb_article, my_article, barcode')
      .not('wb_article', 'is', null);
    const catalogByWb = {};
    (catalog || []).forEach((r) => { catalogByWb[r.wb_article] = r; });

    // P&L по SKU
    const { data: pnl, error: pnlErr } = await supabase.rpc('get_full_pnl_by_period', { p_from: from30, p_to: today });
    if (pnlErr) throw new Error(`get_full_pnl_by_period: ${pnlErr.message}`);
    if (pnl) {
      await writeTab(token, sheetId, 'P&L по SKU',
        ['SKU', 'Мой артикул', 'Арт WB', 'Баркод', 'Выручка', 'Комиссия', 'Логистика', 'Шт', 'С/С', 'Маркетинг', 'Налог', 'Чистый', 'Маржа %'],
        pnl.map((r) => [r.sku_id, r.my_article, r.wb_article, r.barcode, r.revenue_rub, r.commission_rub, r.logistics_rub, r.units_sold, r.cogs_rub, r.marketing_rub, r.tax_rub, r.net_profit_rub, r.margin_pct]),
      );
      totalRows += pnl.length;
    }

    // Остатки — баркод EAN-13 из sku_catalog (через nm_id)
    const { data: stocks } = await supabase
      .from('wb_stocks')
      .select('nm_id, warehouse_name, quantity, in_way_to_client, in_way_from_client')
      .order('warehouse_name').order('nm_id');
    if (stocks) {
      await writeTab(token, sheetId, 'Остатки',
        ['Баркод', 'Мой артикул', 'Арт WB', 'Склад', 'На складе', 'В пути к клиенту', 'В пути от клиента'],
        stocks.map((r) => {
          const cat = catalogByWb[r.nm_id] || {};
          return [cat.barcode ?? '', cat.my_article ?? '', r.nm_id, r.warehouse_name, r.quantity, r.in_way_to_client, r.in_way_from_client];
        }),
      );
      totalRows += stocks.length;
    }

    // Поставка
    const { data: supply } = await supabase.from('v_supply_recommendation').select('*');
    if (supply && supply.length > 0) {
      await writeTab(token, sheetId, 'Поставка',
        ['SKU', 'Мой артикул', 'Арт WB', 'Баркод', 'Продаж/день', 'Остаток', 'Срок поставки', 'Страховой запас', 'К заказу'],
        supply.map((r) => [r.sku_id, r.my_article, r.wb_article, r.barcode, r.units_per_day, r.total_stock, r.lead_time_days, r.safety_stock_days, r.units_to_order]),
      );
      totalRows += supply.length;
    }

    // Cash Flow — баркод не нужен
    const { data: cf } = await supabase.from('v_cash_flow_by_month').select('*');
    if (cf) {
      await writeTab(token, sheetId, 'Cash Flow',
        ['Месяц', 'Направление', 'Категория', 'Сумма', 'Операций'],
        cf.map((r) => [r.month, r.direction, r.category, r.total_rub, r.count]),
      );
      totalRows += cf.length;
    }

    if (jobId) await supabase.from('ingestion_log').update({
      status: 'ok', finished_at: new Date().toISOString(), rows_out: totalRows,
    }).eq('id', jobId);

    return { statusCode: 200, body: JSON.stringify({ ok: true, rows: totalRows }) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (jobId) await supabase.from('ingestion_log').update({
      status: 'error', finished_at: new Date().toISOString(), error_text: message,
    }).eq('id', jobId);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: message }) };
  }
};
