#!/usr/bin/env python3
"""Выгрузка выдачи WB (xlsx) -> SQL для public.wb_serp_snapshots.

Имя файла = поисковый запрос: «мяч массажный с шипами.xlsx».
Дата среза берётся из --date или сегодняшняя.

    python3 scripts/import_serp_xlsx.py "мяч массажный.xlsx" --date 2026-08-27 > serp.sql

Полученный SQL применяется через MCP execute_sql. Прямого доступа к базе
у скрипта нет намеренно: ключи в контейнер не кладём.
"""
import argparse, datetime, os, sys

try:
    import openpyxl
except ImportError:
    sys.exit("нужен openpyxl: pip install openpyxl")

COLS = {
    "Артикул": "nm_id", "Бренд": "brand", "Название": "title",
    "Рекл": "is_ad", "Позиция орг.": "position_organic", "Позиция": "position",
    "Акция": "promo", "Цена": "price_rub", "Склад": "warehouse",
    "Доставка, ч.": "delivery_hours", "Рейтинг": "rating",
    "Оценок": "reviews_count", "Кол-во слайдов": "slides_count",
}
NUM = {"nm_id", "position", "position_organic", "price_rub",
       "delivery_hours", "rating", "reviews_count", "slides_count"}


def q(v):
    if v is None or v == "":
        return "null"
    return "'" + str(v).replace("'", "''").strip() + "'"


def num(v):
    if v is None or str(v).strip() == "":
        return "null"
    s = str(v).replace(",", ".").replace(" ", "")
    try:
        f = float(s)
    except ValueError:
        return "null"
    return str(int(f)) if f == int(f) else str(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--date", default=str(datetime.date.today()))
    ap.add_argument("--query", help="если имя файла не совпадает с запросом")
    args = ap.parse_args()

    query = args.query or os.path.splitext(os.path.basename(args.file))[0]
    wb = openpyxl.load_workbook(args.file, read_only=True, data_only=True)
    rows = list(wb.worksheets[0].iter_rows(values_only=True))
    wb.close()
    hdr = [str(h).strip() if h else "" for h in rows[0]]
    idx = {COLS[h]: i for i, h in enumerate(hdr) if h in COLS}
    missing = set(COLS.values()) - set(idx)
    if "position" in missing or "nm_id" in missing:
        sys.exit(f"нет обязательных колонок: {missing}")

    fields = ["snapshot_date", "query"] + [f for f in COLS.values() if f in idx]
    out = []
    for r in rows[1:]:
        if not r or r[idx["nm_id"]] in (None, ""):
            continue
        vals = [q(args.date), q(query)]
        for f in fields[2:]:
            v = r[idx[f]]
            if f == "is_ad":
                vals.append("true" if str(v).strip().lower() == "true" else "false")
            elif f in NUM:
                vals.append(num(v))
            else:
                vals.append(q(v))
        out.append("(" + ", ".join(vals) + ")")

    print(f"-- {query} · {args.date} · строк: {len(out)}")
    print("insert into public.wb_serp_snapshots (" + ", ".join(fields) + ") values")
    print(",\n".join(out))
    print("on conflict (snapshot_date, query, position) do nothing;")


if __name__ == "__main__":
    main()
