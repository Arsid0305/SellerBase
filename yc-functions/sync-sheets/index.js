if (!globalThis.WebSocket) globalThis.WebSocket = require('ws');
// sync-sheets — выгружает ключевые view из Supabase в Google Sheets.
// Дёргается cron каждый час (настроить в pg_cron после деплоя).
//
// ENV:
//   SUPABASE_URL                  — https://hcebwgjgppwaguqittpi.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY     — сервис-ключ
//   GOOGLE_SA_JSON_B64            — base64-кодированный JSON service account (yc --environment не допускает запятые в значениях)
//   GOOGLE_SHEET_ID               — id Google-таблицы (из URL: docs.google.com/spreadsheets/d/<это>)

const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

const JOB_NAME = 'sync-sheets';

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env not set');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function sheetsClient() {
  const b64 = process.env.GOOGLE_SA_JSON_B64;
  const raw = process.env.GOOGLE_SA_JSON;
  let saRaw;
  if (b64) saRaw = Buffer.from(b64, 'base64').toString('utf8');
  else if (raw) saRaw = raw;
  else throw new Error('GOOGLE_SA_JSON_B64 (or GOOGLE_SA_JSON) env not set');

  const sa = JSON.parse(saRaw);
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  await auth.authorize();
  return google.sheets({ version: 'v4', auth });
}

async function writeTab(sheets, spreadsheetId, tabName, headerRow, dataRows) {
  const range = `${tabName}!A:Z`;
  await sheets.spreadsheets.values.clear({ spreadsheetId, range });

  const values = [headerRow, ...dataRows];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

module.exports.handler = async () => {
  const supabase = adminClient();
  const { data: logRow } = await supabase
    .from('ingestion_log')
    .insert({ job_name: JOB_NAME, meta: {} })
    .select('id').single();
  const jobId = logRow?.id;

  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error('GOOGLE_SHEET_ID not set');
    const sheets = await sheetsClient();

    let totalRows = 0;

    const today = new Date().toISOString().slice(0, 10);
    const from30 = new Date(Date.now() - 30 * 86400 * 1000).toISOString().slice(0, 10);
    const { data: pnl } = await supabase.rpc('get_full_pnl_by_period', { p_from: from30, p_to: today });
    if (pnl) {
      await writeTab(sheets, sheetId, 'P&L по SKU',
        ['SKU', 'Мой артикул', 'Арт WB', 'Выручка', 'Комиссия', 'Логистика', 'Шт', 'С/С', 'Маркетинг', 'Налог', 'Чистый', 'Маржа %'],
        pnl.map((r) => [r.sku_id, r.my_article, r.wb_article, r.revenue_rub, r.commission_rub, r.logistics_rub, r.units_sold, r.cogs_rub, r.marketing_rub, r.tax_rub, r.net_profit_rub, r.margin_pct]),
      );
      totalRows += pnl.length;
    }

    const { data: stocks } = await supabase
      .from('wb_stocks')
      .select('barcode, nm_id, warehouse_name, quantity, in_way_to_client, in_way_from_client')
      .order('warehouse_name')
      .order('nm_id');
    if (stocks) {
      await writeTab(sheets, sheetId, 'Остатки',
        ['Штрихкод', 'Арт WB', 'Склад', 'На складе', 'В пути к клиенту', 'В пути от клиента'],
        stocks.map((r) => [r.barcode, r.nm_id, r.warehouse_name, r.quantity, r.in_way_to_client, r.in_way_from_client]),
      );
      totalRows += stocks.length;
    }

    const { data: supply } = await supabase.from('v_supply_recommendation').select('*');
    if (supply) {
      const keys = supply[0] ? Object.keys(supply[0]) : [];
      await writeTab(sheets, sheetId, 'Поставка',
        keys,
        supply.map((r) => keys.map((k) => r[k])),
      );
      totalRows += supply.length;
    }

    const { data: cf } = await supabase.from('v_cash_flow_by_month').select('*');
    if (cf) {
      await writeTab(sheets, sheetId, 'Cash Flow',
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
