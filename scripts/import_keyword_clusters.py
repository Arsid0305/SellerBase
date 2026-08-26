#!/usr/bin/env python3
"""Разбор выгрузки кабинета WB «Кластеры: сравнение позиций» (xlsx) → SQL для wb_keyword_clusters.

Кабинет отдаёт лист без нормальной таблицы: один товар = блок строк, где колонка A
несёт то название, то ссылку, то «Цена: 928 ₽», а колонки B/C — пары кластер/частотность.
Якорь блока — строка `/catalog/<nmId>/detail.aspx`; название товара лежит строкой выше.

Использование:
    python3 scripts/import_keyword_clusters.py <файл.xlsx> --date 2026-08-23 > /tmp/clusters.sql

Дальше SQL применяется через MCP `mcp__Supabase__execute_sql` (Supabase CLI в проекте нет).
Повторный запуск с той же датой безопасен: ON CONFLICT DO UPDATE по (snapshot_date, nm_id, cluster).
"""

from __future__ import annotations

import argparse
import re
import sys

try:
    import openpyxl
except ImportError:
    sys.exit("нужен openpyxl: pip install openpyxl")

ANCHOR_RE = re.compile(r"/catalog/(\d+)/detail\.aspx")
TOP100_RE = re.compile(r"В ТОП-100:\s*([\d.,]+)\s*%")


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def parse(path: str) -> list[dict]:
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = [
        [("" if cell is None else str(cell)).replace("\xa0", " ").strip() for cell in row]
        for row in ws.iter_rows(values_only=True)
    ]

    anchors = [i for i, row in enumerate(rows) if ANCHOR_RE.match(row[0])]
    products = []
    for k, start in enumerate(anchors):
        # Блок начинается со строки названия (на ней же лежит самый частотный кластер),
        # заканчивается перед названием следующего товара.
        head = start - 1
        end = anchors[k + 1] - 1 if k + 1 < len(anchors) else len(rows)
        product = {
            "nm_id": int(ANCHOR_RE.match(rows[start][0]).group(1)),
            "name": rows[head][0] if start else "",
            "clusters": [],
            "top100_share_pct": None,
        }
        for row in rows[head:end]:
            cluster, freq, position = row[1], row[2], row[3]
            if cluster and freq:
                try:
                    product["clusters"].append((cluster, int(float(freq)), parse_position(position)))
                except ValueError:
                    pass  # заголовки и подписи внутри блока — не число, пропускаем
            share = TOP100_RE.search(position)
            if share:
                product["top100_share_pct"] = float(share.group(1).replace(",", "."))
        products.append(product)
    return products


def parse_position(cell: str) -> int | None:
    """Позиция карточки по кластеру. В выгрузках, где товара нет в выдаче, колонка пуста."""
    match = re.match(r"^\d+$", cell.strip())
    return int(match.group(0)) if match else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx")
    ap.add_argument("--date", required=True, help="дата среза, YYYY-MM-DD (из шапки выгрузки)")
    args = ap.parse_args()

    products = parse(args.xlsx)
    pairs = sum(len(p["clusters"]) for p in products)
    print(f"-- {args.xlsx}: {len(products)} SKU, {pairs} связок SKU×кластер", file=sys.stderr)
    if not pairs:
        sys.exit("в файле не нашлось ни одной пары кластер/частотность — проверь формат выгрузки")

    # Дата и NULL-позиции повторялись бы в каждой из тысячи строк — выносим их
    # в SELECT, в VALUES остаётся только то, что меняется от строки к строке.
    values = []
    for product in products:
        for cluster, freq, position in product["clusters"]:
            values.append(
                "({nm},{cl},{fr},{pos},{share})".format(
                    nm=product["nm_id"],
                    cl=sql_quote(cluster),
                    fr=freq,
                    pos=position if position is not None else "NULL",
                    share=product["top100_share_pct"]
                    if product["top100_share_pct"] is not None
                    else "NULL",
                )
            )

    print("INSERT INTO public.wb_keyword_clusters")
    print("  (snapshot_date, nm_id, cluster, frequency, position_current, top100_share_pct)")
    # Явные касты: колонки позиции и доли бывают сплошь NULL, тип из VALUES не выводится.
    print(
        f"SELECT {sql_quote(args.date)}::date, v.nm, v.cl, v.fr, "
        "v.pos::int, v.sh::numeric FROM (VALUES"
    )
    print(",\n".join(values))
    print(") AS v(nm, cl, fr, pos, sh)")
    print("ON CONFLICT (snapshot_date, nm_id, cluster) DO UPDATE SET")
    print("  frequency        = EXCLUDED.frequency,")
    print("  position_current = EXCLUDED.position_current,")
    print("  top100_share_pct = EXCLUDED.top100_share_pct;")


if __name__ == "__main__":
    main()
