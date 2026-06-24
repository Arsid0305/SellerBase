'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { DataTable } from '@/shared/ui/domain/data-table';
import { Button } from '@/shared/ui/button';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import { TooltipIcon } from '@/shared/ui/tooltip-icon';
import { cn } from '@/shared/lib/utils';
import type { CostRow, CostHistoryEntry, CargoTariff, FulfillmentTariff } from '@/entities/costs';
import type { CostBreakdown } from '@/entities/cost-breakdown';

type Props = {
  rows: CostRow[];
  cargoTariff?: CargoTariff | null;
  ffTariff?: FulfillmentTariff | null;
  breakdown?: CostBreakdown[];
};

const SOURCE_LABEL: Record<CostBreakdown['source'], string> = {
  unit_import: 'unit_import',
  cogs_calc: 'cogs_calc',
  sku_catalog_legacy: 'legacy',
  none: 'нет данных',
};

function breakdownTooltip(b: CostBreakdown): string | undefined {
  if (b.source !== 'cogs_calc') return undefined;
  const parts: string[] = [];
  if (b.purchaseRubPerUnit != null) parts.push(`Закупка ${fmtRub(b.purchaseRubPerUnit)}₽`);
  if (b.cargoRubPerUnit != null) parts.push(`Карго ${fmtRub(b.cargoRubPerUnit)}₽`);
  if (b.customsRubPerUnit != null) parts.push(`Таможня ${fmtRub(b.customsRubPerUnit)}₽`);
  if (b.packagingRubPerUnit != null) parts.push(`Упаковка ${fmtRub(b.packagingRubPerUnit)}₽`);
  return parts.length > 0 ? parts.join(' + ') : undefined;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const costFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

function fmtRub(n: number): string {
  return costFormatter.format(n);
}

function fmtDateRu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function matchesSearch(row: CostRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    row.title.toLowerCase().includes(needle) ||
    row.barcode.toLowerCase().includes(needle) ||
    (row.myArticle ?? '').toLowerCase().includes(needle) ||
    (row.wbArticle != null ? String(row.wbArticle) : '').includes(needle)
  );
}

type EditCellProps = {
  row: CostRow;
  onSaved: () => void;
};

function EditCell({ row, onSaved }: EditCellProps) {
  const [value, setValue] = useState('');
  const [date, setDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const raw = value.replace(',', '.').trim();
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/costs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sku_id: row.sku_id,
          cost_rub: num,
          valid_from: date,
          source: 'manual',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('Ошибка: ' + (err.error ?? res.statusText));
      } else {
        setValue('');
        setDate(todayIso());
        onSaved();
      }
    } catch {
      alert('Ошибка сети');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="decimal"
        placeholder="0,00"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-8 w-36 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <Button size="sm" onClick={save} disabled={!value || saving}>
        {saving ? '...' : 'Сохранить'}
      </Button>
    </div>
  );
}

export function CostsExplorer({ rows, cargoTariff = null, ffTariff = null, breakdown = [] }: Props) {
  const router = useRouter();
  const breakdownBySku = useMemo(() => {
    const map = new Map<number, CostBreakdown>();
    for (const b of breakdown) map.set(b.skuId, b);
    return map;
  }, [breakdown]);
  const [, startTransition] = useTransition();
  const [historyFor, setHistoryFor] = useState<CostRow | null>(null);
  const [history, setHistory] = useState<CostHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [chinaOpen, setChinaOpen] = useState(false);
  const [chinaFile, setChinaFile] = useState<File | null>(null);
  const [chinaOrderDate, setChinaOrderDate] = useState(todayIso());
  const [chinaCnyRate, setChinaCnyRate] = useState('');
  const [chinaSupplier, setChinaSupplier] = useState('');
  const [chinaComment, setChinaComment] = useState('');
  const [chinaSubmitting, setChinaSubmitting] = useState(false);
  const [chinaResult, setChinaResult] = useState<{
    order_id: number;
    inserted_count: number;
    warnings: string[];
    unmatched_sku_count: number;
  } | null>(null);
  const [chinaError, setChinaError] = useState<string | null>(null);

  const [unitOpen, setUnitOpen] = useState(false);
  const [unitFile, setUnitFile] = useState<File | null>(null);
  const [unitSheetName, setUnitSheetName] = useState('Себес');
  const [unitSource, setUnitSource] = useState('unit-excel');
  const [unitEffectiveFrom, setUnitEffectiveFrom] = useState(todayIso());
  const [unitSubmitting, setUnitSubmitting] = useState(false);
  const [unitResult, setUnitResult] = useState<{
    updated_sku_count: number;
    inserted_history_count: number;
    warnings: string[];
    unmatched_count: number;
  } | null>(null);
  const [unitError, setUnitError] = useState<string | null>(null);

  const [cargoOpen, setCargoOpen] = useState(false);
  const [cargoCnyRate, setCargoCnyRate] = useState('');
  const [cargoUsdRate, setCargoUsdRate] = useState('');
  const [cargoDeliveryPerKg, setCargoDeliveryPerKg] = useState('');
  const [cargoEffectiveFrom, setCargoEffectiveFrom] = useState(todayIso());
  const [cargoComment, setCargoComment] = useState('');
  const [cargoSubmitting, setCargoSubmitting] = useState(false);
  const [cargoError, setCargoError] = useState<string | null>(null);
  const [currentCargoTariff, setCurrentCargoTariff] = useState<CargoTariff | null>(cargoTariff);

  const [ffOpen, setFfOpen] = useState(false);
  const [ffRubPerUnit, setFfRubPerUnit] = useState('');
  const [ffEffectiveFrom, setFfEffectiveFrom] = useState(todayIso());
  const [ffComment, setFfComment] = useState('');
  const [ffSubmitting, setFfSubmitting] = useState(false);
  const [ffError, setFfError] = useState<string | null>(null);
  const [currentFfTariff, setCurrentFfTariff] = useState<FulfillmentTariff | null>(ffTariff);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(
    () => rows.filter((r) => matchesSearch(r, debouncedSearch)),
    [rows, debouncedSearch],
  );

  const onSaved = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  const openHistory = useCallback(async (row: CostRow) => {
    setHistoryFor(row);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/costs/history?sku_id=${row.sku_id}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.entries ?? []);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const isXlsx = /\.xlsx$/i.test(file.name);
      let entries: { barcode: string; cost_rub: number; valid_from: string; source: string }[] = [];

      if (isXlsx) {
        const form = new FormData();
        form.append('file', file);
        const parseRes = await fetch('/api/costs/parse-xlsx', { method: 'POST', body: form });
        if (!parseRes.ok) {
          const err = await parseRes.json().catch(() => ({}));
          setImportResult('Ошибка чтения XLSX: ' + (err.error ?? parseRes.statusText));
          return;
        }
        const parsed = await parseRes.json();
        entries = parsed.entries ?? [];
      } else {
        let text = await file.text();
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length === 0) {
          setImportResult('Пустой файл');
          return;
        }
        const header = (lines[0] ?? '').split(';').map((s) => s.trim().toLowerCase());
        const bcIdx = header.indexOf('barcode');
        const costIdx = header.indexOf('cost');
        const dateIdx = header.indexOf('valid_from');
        if (bcIdx < 0 || costIdx < 0 || dateIdx < 0) {
          setImportResult('Ожидаемые колонки: barcode;cost;valid_from');
          return;
        }
        for (let i = 1; i < lines.length; i++) {
          const parts = (lines[i] ?? '').split(';');
          const barcode = (parts[bcIdx] ?? '').trim();
          const cost = Number((parts[costIdx] ?? '').replace(',', '.').trim());
          const date = (parts[dateIdx] ?? '').trim();
          if (!barcode || !Number.isFinite(cost) || !date) continue;
          entries.push({ barcode, cost_rub: cost, valid_from: date, source: 'csv' });
        }
      }

      if (entries.length === 0) {
        setImportResult('Не нашёл валидных строк');
        return;
      }
      const res = await fetch('/api/costs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportResult('Ошибка: ' + (data.error ?? res.statusText));
      } else {
        setImportResult(`Импортировано: ${data.inserted}, пропущено: ${(data.skipped ?? []).length}`);
        startTransition(() => router.refresh());
      }
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const resetChinaForm = useCallback(() => {
    setChinaFile(null);
    setChinaOrderDate(todayIso());
    setChinaCnyRate('');
    setChinaSupplier('');
    setChinaComment('');
    setChinaResult(null);
    setChinaError(null);
  }, []);

  const submitChinaImport = useCallback(async () => {
    if (!chinaFile) {
      setChinaError('Выберите файл XLSX');
      return;
    }
    if (!chinaOrderDate) {
      setChinaError('Укажите дату заказа');
      return;
    }
    setChinaSubmitting(true);
    setChinaError(null);
    setChinaResult(null);
    try {
      const formData = new FormData();
      formData.append('file', chinaFile);
      formData.append('order_date', chinaOrderDate);
      if (chinaCnyRate.trim()) formData.append('cny_rate', chinaCnyRate.trim());
      if (chinaSupplier.trim()) formData.append('supplier_name', chinaSupplier.trim());
      if (chinaComment.trim()) formData.append('comment', chinaComment.trim());

      const res = await fetch('/api/import/china-order', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChinaError(String(data.error ?? res.statusText));
        return;
      }
      setChinaResult(data);
      startTransition(() => router.refresh());
    } catch {
      setChinaError('Ошибка сети');
    } finally {
      setChinaSubmitting(false);
    }
  }, [chinaFile, chinaOrderDate, chinaCnyRate, chinaSupplier, chinaComment, router]);

  const resetUnitForm = useCallback(() => {
    setUnitFile(null);
    setUnitSheetName('Себес');
    setUnitSource('unit-excel');
    setUnitEffectiveFrom(todayIso());
    setUnitResult(null);
    setUnitError(null);
  }, []);

  const submitUnitImport = useCallback(async () => {
    if (!unitFile) {
      setUnitError('Выберите файл XLSX');
      return;
    }
    setUnitSubmitting(true);
    setUnitError(null);
    setUnitResult(null);
    try {
      const formData = new FormData();
      formData.append('file', unitFile);
      if (unitSheetName.trim()) formData.append('sheet_name', unitSheetName.trim());
      if (unitSource.trim()) formData.append('source', unitSource.trim());
      if (unitEffectiveFrom.trim()) formData.append('effective_from', unitEffectiveFrom.trim());

      const res = await fetch('/api/import/unit-cogs', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUnitError(String(data.error ?? res.statusText));
        return;
      }
      setUnitResult(data);
      startTransition(() => router.refresh());
    } catch {
      setUnitError('Ошибка сети');
    } finally {
      setUnitSubmitting(false);
    }
  }, [unitFile, unitSheetName, unitSource, unitEffectiveFrom, router]);

  const resetCargoForm = useCallback(() => {
    setCargoCnyRate('');
    setCargoUsdRate('');
    setCargoDeliveryPerKg('');
    setCargoEffectiveFrom(todayIso());
    setCargoComment('');
    setCargoError(null);
  }, []);

  const submitCargoTariff = useCallback(async () => {
    const cnyRate = Number(cargoCnyRate.replace(',', '.').trim());
    if (!Number.isFinite(cnyRate) || cnyRate <= 0) {
      setCargoError('Укажите корректный курс юаня');
      return;
    }
    const deliveryPerKg = Number(cargoDeliveryPerKg.replace(',', '.').trim());
    if (!Number.isFinite(deliveryPerKg) || deliveryPerKg <= 0) {
      setCargoError('Укажите корректную стоимость доставки 1 кг');
      return;
    }
    let usdRate: number | null = null;
    if (cargoUsdRate.trim()) {
      const v = Number(cargoUsdRate.replace(',', '.').trim());
      if (!Number.isFinite(v) || v <= 0) {
        setCargoError('Укажите корректный курс доллара или оставьте пустым');
        return;
      }
      usdRate = v;
    }
    setCargoSubmitting(true);
    setCargoError(null);
    try {
      const res = await fetch('/api/cargo-tariffs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cny_rate_rub: cnyRate,
          usd_rate_rub: usdRate,
          cny_delivery_per_kg: deliveryPerKg,
          effective_from: cargoEffectiveFrom || todayIso(),
          comment: cargoComment.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCargoError(String(data.error ?? res.statusText));
        return;
      }
      setCurrentCargoTariff({
        cny_rate_rub: cnyRate,
        usd_rate_rub: usdRate,
        cny_delivery_per_kg: deliveryPerKg,
        effective_from: data.effective_from ?? (cargoEffectiveFrom || todayIso()),
        comment: cargoComment.trim() || null,
      });
      setCargoOpen(false);
      startTransition(() => router.refresh());
    } catch {
      setCargoError('Ошибка сети');
    } finally {
      setCargoSubmitting(false);
    }
  }, [cargoCnyRate, cargoUsdRate, cargoDeliveryPerKg, cargoEffectiveFrom, cargoComment, router]);

  const resetFfForm = useCallback(() => {
    setFfRubPerUnit('');
    setFfEffectiveFrom(todayIso());
    setFfComment('');
    setFfError(null);
  }, []);

  const submitFfTariff = useCallback(async () => {
    const rub = Number(ffRubPerUnit.replace(',', '.').trim());
    if (!Number.isFinite(rub) || rub < 0) {
      setFfError('Укажите корректную стоимость ₽/единицу');
      return;
    }
    setFfSubmitting(true);
    setFfError(null);
    try {
      const res = await fetch('/api/fulfillment-tariffs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rub_per_unit: rub,
          effective_from: ffEffectiveFrom || todayIso(),
          comment: ffComment.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFfError(String(data.error ?? res.statusText));
        return;
      }
      setCurrentFfTariff({
        rub_per_unit: rub,
        effective_from: data.effective_from ?? (ffEffectiveFrom || todayIso()),
        comment: ffComment.trim() || null,
      });
      setFfOpen(false);
      startTransition(() => router.refresh());
    } catch {
      setFfError('Ошибка сети');
    } finally {
      setFfSubmitting(false);
    }
  }, [ffRubPerUnit, ffEffectiveFrom, ffComment, router]);

  const columns = useMemo<ColumnDef<CostRow>[]>(
    () => [
      { accessorKey: 'barcode', header: 'Штрихкод', cell: (info) => <span className="font-mono text-xs">{info.getValue<string>() || '—'}</span> },
      {
        accessorKey: 'title',
        header: 'Товар',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <SkuThumb src={row.original.photo_url} alt={row.original.title} />
            <div className="flex flex-col">
              <span className="line-clamp-2">{row.original.title}</span>
              <span className="text-xs text-muted-foreground">
                {row.original.myArticle ?? (row.original.wbArticle != null ? String(row.original.wbArticle) : '—')}
              </span>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'current_cost',
        header: () => (
          <span className="inline-flex items-center gap-1">
            Текущая cost (₽)
            <TooltipIcon text="Себестоимость товара, действующая на сегодняшний день. Берётся из последней актуальной записи истории, либо из карточки SKU, если истории ещё нет." />
          </span>
        ),
        cell: ({ row, getValue }) => {
          const value = getValue<number>();
          if (!value) {
            return <span className="text-xs text-muted-foreground">нет данных</span>;
          }
          const b = breakdownBySku.get(row.original.sku_id);
          const tooltip = b ? breakdownTooltip(b) : undefined;
          return (
            <div className="flex flex-col gap-0.5">
              <span className="tabular-nums" title={tooltip}>
                {fmtRub(value)}
              </span>
              {b && (
                <span className="text-[10px] text-muted-foreground" title={tooltip}>
                  источник: {SOURCE_LABEL[b.source]}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'valid_from',
        header: 'Действует с',
        cell: (info) => <span className="text-muted-foreground tabular-nums">{info.getValue<string | null>() ?? '—'}</span>,
      },
      {
        id: 'history',
        header: 'История',
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => openHistory(row.original)}>
            История
          </Button>
        ),
      },
      {
        id: 'edit',
        header: 'Новое значение',
        cell: ({ row }) => <EditCell row={row.original} onSaved={onSaved} />,
      },
    ],
    [openHistory, onSaved, breakdownBySku],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative w-full min-w-[220px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по артикулу, штрихкоду, названию…"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Показано: <span className="font-medium text-foreground tabular-nums">{filtered.length}</span> из{' '}
            <span className="font-medium text-foreground tabular-nums">{rows.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {importResult && <span className="text-xs text-muted-foreground">{importResult}</span>}
          <Button variant="ghost" size="sm" asChild>
            <a href="/api/costs/template-xlsx" download>
              Шаблон Excel
            </a>
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Импорт...' : 'Импорт Excel/CSV'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetChinaForm();
              setChinaOpen(true);
            }}
          >
            Импортировать заказ Китай (XLSX)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetUnitForm();
              setUnitOpen(true);
            }}
          >
            Импортировать себестоимость UNIT (XLSX)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetCargoForm();
              setCargoOpen(true);
            }}
          >
            Тарифы Карго
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetFfForm();
              setFfOpen(true);
            }}
          >
            Тариф ФФ
          </Button>
        </div>
      </div>

      {currentCargoTariff && (
        <p className="text-xs text-muted-foreground">
          Текущий курс юаня: <span className="font-medium text-foreground tabular-nums">{fmtRub(currentCargoTariff.cny_rate_rub)}₽</span>
          {' · '}Доставка: <span className="font-medium text-foreground tabular-nums">{fmtRub(currentCargoTariff.cny_delivery_per_kg)}¥/кг</span>
          {' · '}Действует с <span className="font-medium text-foreground tabular-nums">{fmtDateRu(currentCargoTariff.effective_from)}</span>
        </p>
      )}

      {currentFfTariff && (
        <p className="text-xs text-muted-foreground">
          Тариф ФФ: <span className="font-medium text-foreground tabular-nums">{fmtRub(currentFfTariff.rub_per_unit)}₽/ед</span>
          {' · '}Действует с <span className="font-medium text-foreground tabular-nums">{fmtDateRu(currentFfTariff.effective_from)}</span>
          {currentFfTariff.comment && <> {' · '}<span className="italic">{currentFfTariff.comment}</span></>}
        </p>
      )}

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(r) => String(r.sku_id)}
        rowClassName={(r) => (!r.current_cost ? 'bg-muted/20' : undefined)}
        className="max-h-[70vh] overflow-auto"
        empty="Нет данных"
      />

      <p className="text-xs text-muted-foreground">
        Шаблон Excel — со столбцами <code>barcode</code>, <code>cost</code>, <code>valid_from</code>.
        Заполни и загрузи через «Импорт Excel/CSV». Принимаются и .xlsx, и .csv (с разделителем «;»).
      </p>

      {historyFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setHistoryFor(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold">История себестоимости</h3>
                <p className="text-xs text-muted-foreground line-clamp-1">{historyFor.title}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setHistoryFor(null)}>
                ✕
              </Button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {historyLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Загрузка...</div>
              ) : history.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Нет данных</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Cost (₽)</th>
                      <th className="px-4 py-2 text-left">С</th>
                      <th className="px-4 py-2 text-left">По</th>
                      <th className="px-4 py-2 text-left">Источник</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-2 tabular-nums">{fmtRub(Number(h.cost_rub))}</td>
                        <td className={cn('px-4 py-2 tabular-nums', !h.valid_to && 'font-medium text-foreground')}>{h.valid_from}</td>
                        <td className="px-4 py-2 text-muted-foreground tabular-nums">{h.valid_to ?? 'актуальна'}</td>
                        <td className="px-4 py-2 text-muted-foreground">{h.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {chinaOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setChinaOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Импорт заказа Китай (1688) из XLSX</h3>
              <Button variant="ghost" size="sm" onClick={() => setChinaOpen(false)}>
                ✕
              </Button>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Файл XLSX</span>
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => setChinaFile(e.target.files?.[0] ?? null)}
                  className="text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Дата заказа</span>
                <input
                  type="date"
                  value={chinaOrderDate}
                  onChange={(e) => setChinaOrderDate(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Курс юаня (₽ за CNY)</span>
                <input
                  type="number"
                  step="0.01"
                  value={chinaCnyRate}
                  onChange={(e) => setChinaCnyRate(e.target.value)}
                  placeholder="напр. 12.50"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Поставщик (опционально)</span>
                <input
                  type="text"
                  value={chinaSupplier}
                  onChange={(e) => setChinaSupplier(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Комментарий (опционально)</span>
                <input
                  type="text"
                  value={chinaComment}
                  onChange={(e) => setChinaComment(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>

              {chinaError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {chinaError}
                </div>
              )}

              {chinaResult && (
                <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                  <span>
                    Заказ <span className="font-medium tabular-nums">#{chinaResult.order_id}</span> создан,
                    добавлено позиций: <span className="font-medium tabular-nums">{chinaResult.inserted_count}</span>
                  </span>
                  {chinaResult.unmatched_sku_count > 0 && (
                    <span className="text-amber-600">
                      Не найден SKU для {chinaResult.unmatched_sku_count} позиций
                    </span>
                  )}
                  {chinaResult.warnings.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-muted-foreground">
                        Предупреждения ({chinaResult.warnings.length})
                      </summary>
                      <ul className="mt-1 list-inside list-disc text-muted-foreground">
                        {chinaResult.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setChinaOpen(false)}>
                  Закрыть
                </Button>
                <Button size="sm" onClick={submitChinaImport} disabled={chinaSubmitting || !chinaFile}>
                  {chinaSubmitting ? 'Загрузка...' : 'Загрузить'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {unitOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setUnitOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Импорт себестоимости «до ВБ» (UNIT) из XLSX</h3>
              <Button variant="ghost" size="sm" onClick={() => setUnitOpen(false)}>
                ✕
              </Button>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Файл XLSX</span>
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => setUnitFile(e.target.files?.[0] ?? null)}
                  className="text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Имя листа</span>
                <input
                  type="text"
                  value={unitSheetName}
                  onChange={(e) => setUnitSheetName(e.target.value)}
                  placeholder="Себес"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Источник</span>
                <input
                  type="text"
                  value={unitSource}
                  onChange={(e) => setUnitSource(e.target.value)}
                  placeholder="unit-excel"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Дата вступления в силу</span>
                <input
                  type="date"
                  value={unitEffectiveFrom}
                  onChange={(e) => setUnitEffectiveFrom(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>

              {unitError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {unitError}
                </div>
              )}

              {unitResult && (
                <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                  <span>
                    Обновлено SKU: <span className="font-medium tabular-nums">{unitResult.updated_sku_count}</span>,
                    добавлено записей истории:{' '}
                    <span className="font-medium tabular-nums">{unitResult.inserted_history_count}</span>
                  </span>
                  {unitResult.unmatched_count > 0 && (
                    <span className="text-amber-600">Не найден SKU для {unitResult.unmatched_count} позиций</span>
                  )}
                  {unitResult.warnings.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-muted-foreground">
                        Предупреждения ({unitResult.warnings.length})
                      </summary>
                      <ul className="mt-1 list-inside list-disc text-muted-foreground">
                        {unitResult.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setUnitOpen(false)}>
                  Закрыть
                </Button>
                <Button size="sm" onClick={submitUnitImport} disabled={unitSubmitting || !unitFile}>
                  {unitSubmitting ? 'Загрузка...' : 'Загрузить'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cargoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCargoOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Тарифы Карго</h3>
              <Button variant="ghost" size="sm" onClick={() => setCargoOpen(false)}>
                ✕
              </Button>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Курс юаня (₽ за 1 ¥)</span>
                <input
                  type="number"
                  step="0.01"
                  value={cargoCnyRate}
                  onChange={(e) => setCargoCnyRate(e.target.value)}
                  placeholder="напр. 12.50"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Курс доллара (₽ за 1 $) — опционально</span>
                <input
                  type="number"
                  step="0.01"
                  value={cargoUsdRate}
                  onChange={(e) => setCargoUsdRate(e.target.value)}
                  placeholder="напр. 95.00"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Стоимость доставки 1 кг (юаней)</span>
                <input
                  type="number"
                  step="0.01"
                  value={cargoDeliveryPerKg}
                  onChange={(e) => setCargoDeliveryPerKg(e.target.value)}
                  placeholder="напр. 45.00"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Дата действия</span>
                <input
                  type="date"
                  value={cargoEffectiveFrom}
                  onChange={(e) => setCargoEffectiveFrom(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Комментарий (опционально)</span>
                <input
                  type="text"
                  value={cargoComment}
                  onChange={(e) => setCargoComment(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>

              {cargoError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {cargoError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setCargoOpen(false)}>
                  Закрыть
                </Button>
                <Button
                  size="sm"
                  onClick={submitCargoTariff}
                  disabled={cargoSubmitting || !cargoCnyRate || !cargoDeliveryPerKg}
                >
                  {cargoSubmitting ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {ffOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setFfOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Тариф ФФ (фулфилмент, ₽/единицу)</h3>
              <Button variant="ghost" size="sm" onClick={() => setFfOpen(false)}>
                ✕
              </Button>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Стоимость услуг ФФ на единицу (₽)</span>
                <input
                  type="number"
                  step="0.01"
                  value={ffRubPerUnit}
                  onChange={(e) => setFfRubPerUnit(e.target.value)}
                  placeholder="напр. 14.00"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <span className="text-[10px] text-muted-foreground">
                  Сумма всех услуг (приёмка + сортировка + упаковка + маркировка + ...) из колонки BG листа «ТЗ_ФФ»
                </span>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Дата действия</span>
                <input
                  type="date"
                  value={ffEffectiveFrom}
                  onChange={(e) => setFfEffectiveFrom(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">Комментарий (опционально)</span>
                <input
                  type="text"
                  value={ffComment}
                  onChange={(e) => setFfComment(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>

              {ffError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {ffError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setFfOpen(false)}>
                  Закрыть
                </Button>
                <Button size="sm" onClick={submitFfTariff} disabled={ffSubmitting || !ffRubPerUnit}>
                  {ffSubmitting ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
