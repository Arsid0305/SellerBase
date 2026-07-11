'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, Check, Download } from 'lucide-react';

type Props = {
  planId: number;
  status: string;
};

export function SendToWbButton({ planId, status }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={`/api/supplies/plan/${planId}/tz-ff.xlsx`}
        download
        className="inline-flex items-center gap-1.5 rounded border border-border px-4 py-2 text-sm hover:bg-accent"
      >
        <Download className="h-4 w-4" />
        Скачать ТЗ-ФФ (xlsx)
      </a>
      <SendCore planId={planId} status={status} />
    </div>
  );
}

function SendCore({ planId, status }: Props) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ wb_supply_id?: string; items_sent?: number; goods_warning?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const disabled = sending || status === 'sent_to_ff' || status === 'received';

  async function send() {
    if (!confirm('Отправить поставку в WB? Это создаст FBW-поставку в кабинете WB через API.')) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/supplies/plan/${planId}/send-to-wb`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok || j.ok === false) throw new Error(j.error ?? `HTTP ${res.status}`);
      setResult(j);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ошибка');
    } finally {
      setSending(false);
    }
  }

  if (result?.wb_supply_id) {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4" />
          <span>Поставка создана в WB: <b>{result.wb_supply_id}</b> ({result.items_sent} позиций)</span>
        </div>
        {result.goods_warning && <div className="text-xs text-amber-700">⚠ {result.goods_warning}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={send}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Отправить в WB
      </button>
      {status === 'sent_to_ff' && <span className="text-xs text-muted-foreground">Уже отправлена</span>}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
