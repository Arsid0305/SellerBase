import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { requireAuth } from '@/shared/lib/auth/require-auth';

export const dynamic = 'force-dynamic';

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('delivery_to_wb_invoices')
    .select('id, supply_id, invoice_number, invoice_date, amount_rub, ff_name, comment, file_url, created_at')
    .order('invoice_date', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const b = body as Partial<{
    supply_id: string;
    invoice_number: string;
    invoice_date: string;
    amount_rub: number;
    ff_name: string;
    comment: string;
    file_url: string;
  }>;

  const invoiceDate = (b.invoice_date ?? '').trim();
  if (!isIsoDate(invoiceDate)) return NextResponse.json({ error: 'invalid invoice_date' }, { status: 400 });

  const amount = Number(b.amount_rub);
  if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: 'invalid amount_rub' }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('delivery_to_wb_invoices')
    .insert({
      supply_id: typeof b.supply_id === 'string' && b.supply_id.trim() ? b.supply_id.trim() : null,
      invoice_number: typeof b.invoice_number === 'string' && b.invoice_number.trim() ? b.invoice_number.trim() : null,
      invoice_date: invoiceDate,
      amount_rub: amount,
      ff_name: typeof b.ff_name === 'string' && b.ff_name.trim() ? b.ff_name.trim() : null,
      comment: typeof b.comment === 'string' && b.comment.trim() ? b.comment.trim() : null,
      file_url: typeof b.file_url === 'string' && b.file_url.trim() ? b.file_url.trim() : null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const id = Number(url.searchParams.get('id'));
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  const supabase = createAdminClient();
  const { error } = await supabase.from('delivery_to_wb_invoices').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
