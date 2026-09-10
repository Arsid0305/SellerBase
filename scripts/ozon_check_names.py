#!/usr/bin/env python3
"""Проверяет наименования Ozon по его же правилам и кладёт их в книгу.

Правила — docs/ozon/ozon-ranking-2026.md §4, взяты из подсказок Ozon в
шаблонах и его требований к модерации:

  - до 200 знаков, оптимально 40–80;
  - одно слово не длиннее 27 знаков;
  - одно слово не более двух раз (иначе фильтр за переспам);
  - запрещены ® © [ ] = \\ « » ™;
  - начинается с заглавной буквы;
  - не полностью на английском.

Отдельно проверяем то, что правилами Ozon не ловится, но стоило нам
разбора на WB: формулировки, которые уводят товар в чужую товарную
позицию и в обязанность маркировки (docs/seo/stop-words.md).

Запуск:
    python3 scripts/ozon_check_names.py <названия.tsv> [книга.xlsx]

Без второго аргумента только проверяет и печатает отчёт.
"""

import re
import sys

MAX_LEN = 200
MAX_WORD = 27
GOOD_MIN, GOOD_MAX = 40, 80
FORBIDDEN = "®©[]=\\«»™"

# Формулировки, из-за которых карточка уезжает в позицию 9019 «аппаратура
# для механотерапии» или заявляет свойства без подтверждения. На WB это
# раздел A чеклиста, здесь — то же самое.
RISKY_PHRASES = [
    "медицинск", "лечебн", "реабилитац", "терапевтическ", "ортопедическ",
    "массажер для рук", "тренажер для спины", "массажный аппарат",
    "зубная щетка", "от целлюлита", "лимфодренаж",
]

WORD_RE = re.compile(r"[А-Яа-яЁёA-Za-z0-9]+")


def check(article, name):
    problems, warnings = [], []

    if len(name) > MAX_LEN:
        problems.append(f"длина {len(name)} > {MAX_LEN}")
    elif not (GOOD_MIN <= len(name) <= GOOD_MAX):
        warnings.append(f"длина {len(name)}, вне 40–80")

    bad = [c for c in FORBIDDEN if c in name]
    if bad:
        problems.append("запрещённые знаки: " + " ".join(bad))

    words = WORD_RE.findall(name)
    long_words = [w for w in words if len(w) > MAX_WORD]
    if long_words:
        problems.append("слово длиннее 27: " + ", ".join(long_words))

    counts = {}
    for w in words:
        low = w.lower()
        counts[low] = counts.get(low, 0) + 1
    repeated = [f"{w}×{n}" for w, n in counts.items() if n > 2]
    if repeated:
        problems.append("слово чаще двух раз: " + ", ".join(repeated))

    if name[:1] != name[:1].upper():
        problems.append("начинается не с заглавной")

    low = name.lower()
    hits = [p for p in RISKY_PHRASES if p in low]
    if hits:
        problems.append("рискованная формулировка: " + ", ".join(hits))

    return problems, warnings


def load(path):
    out = []
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "|" not in line:
            continue
        article, name = (p.strip() for p in line.split("|", 1))
        out.append((article, name))
    return out


def put_in_book(pairs, book_path):
    import openpyxl
    from openpyxl.styles import PatternFill

    wb = openpyxl.load_workbook(book_path)
    ws = wb["Товары"]
    col_art = col_name = None
    for c in ws[1]:
        if c.value == "Артикул *":
            col_art = c.column
        elif c.value == "Название товара":
            col_name = c.column
    if not col_art or not col_name:
        sys.exit("в книге не нашлись колонки «Артикул» и «Название товара»")

    by_article = dict(pairs)
    filled = 0
    green = PatternFill("solid", fgColor="E2EFDA")
    for r in range(3, ws.max_row + 1):
        art = ws.cell(row=r, column=col_art).value
        if art in by_article:
            cell = ws.cell(row=r, column=col_name, value=by_article[art])
            cell.fill = green
            filled += 1
    wb.save(book_path)
    return filled


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    pairs = load(sys.argv[1])

    bad = 0
    print(f"{'артикул':<15} {'зн':>3}  наименование")
    for article, name in pairs:
        problems, warnings = check(article, name)
        mark = "ОШИБКА" if problems else ("  ~   " if warnings else "  ok  ")
        if problems:
            bad += 1
        print(f"{mark} {article:<14} {len(name):>3}  {name}")
        for p in problems:
            print(f"         └─ {p}")
        for w in warnings:
            print(f"         └─ {w}")

    print(f"\nвсего {len(pairs)}, с ошибками {bad}")
    if bad:
        sys.exit(1)

    if len(sys.argv) > 2:
        n = put_in_book(pairs, sys.argv[2])
        print(f"внесено в книгу: {n}")
