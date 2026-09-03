#!/usr/bin/env python3
"""Внести значения из свежей сборки в книгу владелицы, не трогая её оформление.

Книга у владелицы своя: она правит ширину колонок, высоту строк и красит
артикулы — зелёным обработанные, красным снятые с продажи. Пересобранная
с нуля книга это стирает, поэтому генератор в её файл не пишет: сюда приходят
только те колонки, которые названы явно.

По умолчанию переносится «Описание» — оно чинилось после того, как файл был
отдан. Всё остальное остаётся как есть, включая значения, которые в сборке
отличаются: расхождения показывает --dry-run, решение по ним за владелицей.

    python3 scripts/apply_to_book.py книга.xlsx --out книга-обновлённая.xlsx
    python3 scripts/apply_to_book.py книга.xlsx --dry-run
"""
import argparse
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
BUILT = ROOT / "kartochki_arols.xlsx"
KEY = "Артикул продавца"
# Листы без карточек: там нечего сопоставлять по артикулу.
SKIP = {"Как читать файл", "Порядок заливки", "Инфографика", "Размеры и вес"}


def rows_by_article(ws, key_col):
    return {str(ws.cell(r, key_col).value): r
            for r in range(3, ws.max_row + 1) if ws.cell(r, key_col).value}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("book", help="книга владелицы")
    ap.add_argument("--out", help="куда записать; без него — рядом, с суффиксом")
    ap.add_argument("--columns", default="Описание",
                    help="колонки через запятую")
    ap.add_argument("--dry-run", action="store_true",
                    help="только показать, что разошлось, и ничего не писать")
    args = ap.parse_args()

    columns = [c.strip() for c in args.columns.split(",") if c.strip()]
    book = openpyxl.load_workbook(args.book)
    built = openpyxl.load_workbook(BUILT)

    changed = 0
    other = {}
    for name in book.sheetnames:
        if name in SKIP or name not in built.sheetnames:
            continue
        theirs, ours = book[name], built[name]
        th = [str(c.value) for c in theirs[1]]
        oh = [str(c.value) for c in ours[1]]
        if th != oh or KEY not in th:
            print(f"  {name}: колонки разошлись, лист пропущен")
            continue
        ki = th.index(KEY) + 1
        trow = rows_by_article(theirs, ki)
        orow = rows_by_article(ours, ki)
        for art, r in trow.items():
            if art not in orow:
                continue
            for ci, col in enumerate(th, 1):
                a = theirs.cell(r, ci).value or ""
                b = ours.cell(orow[art], ci).value or ""
                if a == b:
                    continue
                if col in columns:
                    if not args.dry_run:
                        theirs.cell(r, ci).value = b
                    changed += 1
                    print(f"  {name} · {art} · {col}: {len(str(a))} → {len(str(b))} знаков")
                else:
                    other.setdefault(col, []).append(f"{name}/{art}")

    print(f"\nперенесено ячеек: {changed}" if not args.dry_run
          else f"\nбудет перенесено: {changed}")
    if other:
        print("\nразошлось ещё, но НЕ переносится — решение за владелицей:")
        for col, items in sorted(other.items(), key=lambda x: -len(x[1])):
            print(f"  {col:<34} {len(items):>3}  {', '.join(items[:2])}"
                  f"{'…' if len(items) > 2 else ''}")

    if not args.dry_run:
        out = args.out or str(Path(args.book).with_suffix("")) + "-обновлено.xlsx"
        book.save(out)
        print(f"\nзаписано → {out}")


if __name__ == "__main__":
    main()
