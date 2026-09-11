#!/usr/bin/env python3
"""Проверяет описания Ozon и кладёт их в книгу, в колонку «Аннотация».

Правила — docs/ozon/правила-текста.md. Проверяется то, что проверяется машинно:

  - лимит 6000 знаков, целевой коридор 1200-1800 (предупреждение);
  - первый абзац до 200 знаков;
  - длинных тире нет вовсе (tasks/rules.md §21);
  - нет призывов к действию, доставки, возврата, скидок и акций;
  - нет телефонов и ссылок;
  - нет «аналог», «реплика», «по мотивам», «1:1», «оригинал»;
  - нет формулировок, уводящих товар в чужую позицию ТН ВЭД;
  - нет капслока кириллицей.

Как и ozon_check_names.py, скрипт ОТКАЗЫВАЕТСЯ писать в книгу, если хоть
одно описание не прошло.

Источник — markdown из docs/ozon/описания/: заголовок «## <АРТИКУЛ>», следом
текст в тройных обратных кавычках.

Запуск:
    python3 scripts/ozon_check_descriptions.py docs/ozon/описания/*.md [книга.xlsx]
"""

import re
import sys

MAX_LEN = 6000
SOFT_MIN, SOFT_MAX = 1200, 1800
FIRST_PARA_MAX = 200

# Причины отклонения на модерации Ozon.
CALLS_TO_ACTION = [
    "купите", "купить сейчас", "закажите", "заказывайте", "покупайте",
    "перейдите", "переходите", "жмите", "нажмите", "добавьте в корзину",
    "оформите заказ", "успейте", "не упустите", "сравните",
]
COMMERCE = ["доставк", "возврат товара", "скидк", "акци", "распродаж",
            "бесплатная доставка", "промокод", "кэшбэк"]
COPYCAT = ["аналог", "реплика", "по мотивам", "1:1", "оригинал"]

# Своё, не Ozon: уводит карточку в чужую товарную позицию (docs/seo/stop-words.md).
RISKY = ["медицинск", "лечебн", "реабилитац", "терапевтическ", "ортопедическ",
         "лимфодренаж", "от целлюлита", "зубная щетка", "зубная щётка"]

PHONE_RE = re.compile(r"(?<!\d)(?:\+7|8)[\s(-]?\d{3}[\s)-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}")
LINK_RE = re.compile(r"(https?://|www\.|\b[a-z0-9-]+\.(ru|com|рф)\b)", re.I)
CAPS_RE = re.compile(r"[А-ЯЁ]{4,}")
# В артикулах владелицы встречается кириллическая «С» (ACRB1MS106BС) — она
# выглядит как латинская, но это другой символ. Пропускать такую строку
# молча нельзя, поэтому заголовок ловим широко, а несовпадения печатаем.
HEAD_RE = re.compile(r"^## (\S+)\s*$(.*?)(?=^## |\Z)", re.M | re.S)
ARTICLE_RE = re.compile(r"^[A-Za-zА-ЯЁа-яё0-9]{6,}$")


def check(text):
    problems, warnings = [], []
    low = text.lower()

    n = len(text)
    if n > MAX_LEN:
        problems.append(f"{n} знаков > {MAX_LEN}")
    elif not SOFT_MIN <= n <= SOFT_MAX:
        warnings.append(f"{n} знаков, коридор {SOFT_MIN}-{SOFT_MAX}")

    first = text.split("\n\n", 1)[0].strip()
    if len(first) > FIRST_PARA_MAX:
        problems.append(f"первый абзац {len(first)} знаков > {FIRST_PARA_MAX}")

    for dash, name in (("—", "длинное тире"), ("–", "среднее тире")):
        if dash in text:
            problems.append(f"{name} в тексте (§21)")

    for phrase in CALLS_TO_ACTION:
        if phrase in low:
            problems.append(f"призыв к действию: «{phrase}»")
    for phrase in COMMERCE:
        if phrase in low:
            problems.append(f"Ozon запрещает в описании: «{phrase}»")
    for phrase in COPYCAT:
        if phrase in low:
            problems.append(f"Ozon запрещает в описании: «{phrase}»")
    for phrase in RISKY:
        if phrase in low:
            problems.append(f"уводит в чужую позицию ТН ВЭД: «{phrase}»")

    if PHONE_RE.search(text):
        problems.append("похоже на телефон")
    if LINK_RE.search(text):
        problems.append("похоже на ссылку")
    for caps in set(CAPS_RE.findall(text)):
        problems.append(f"капслок: {caps}")

    return problems, warnings


def load(paths):
    out, skipped = [], []
    for path in paths:
        src = open(path, encoding="utf-8").read()
        for article, section in HEAD_RE.findall(src):
            block = re.search(r"```\n(.*?)```", section, re.S)
            if not ARTICLE_RE.match(article):
                continue
            if not block:
                skipped.append(f"{article}: заголовок есть, текста в кавычках нет")
                continue
            out.append((article, block.group(1).strip()))
    return out, skipped


def put_in_book(rows, book_path):
    import openpyxl
    from openpyxl.styles import Alignment, PatternFill

    wb = openpyxl.load_workbook(book_path)
    ws = wb["Товары"]
    col_art = col_ann = None
    for c in ws[1]:
        if c.value == "Артикул *":
            col_art = c.column
        elif c.value == "Аннотация":
            col_ann = c.column
    if not col_art or not col_ann:
        sys.exit("в книге не нашлись колонки «Артикул» и «Аннотация»")

    by_article = dict(rows)
    green = PatternFill("solid", fgColor="E2EFDA")
    filled, missing = 0, set(by_article)
    for r in range(3, ws.max_row + 1):
        art = ws.cell(row=r, column=col_art).value
        if art in by_article:
            cell = ws.cell(row=r, column=col_ann, value=by_article[art])
            cell.fill = green
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            filled += 1
            missing.discard(art)
    wb.save(book_path)
    return filled, sorted(missing)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)

    paths = [a for a in sys.argv[1:] if a.endswith(".md")]
    book = next((a for a in sys.argv[1:] if a.endswith(".xlsx")), None)
    rows, skipped = load(paths)
    for s_ in skipped:
        print(f"ПРОПУЩЕН {s_}")

    bad = 0
    for article, text in rows:
        problems, warnings = check(text)
        mark = "ОШИБКА" if problems else ("  ~   " if warnings else "  ok  ")
        if problems:
            bad += 1
        first = len(text.split("\n\n", 1)[0].strip())
        print(f"{mark} {article:<14} {len(text):>5} знаков, первый абзац {first}")
        for p in problems:
            print(f"         └─ {p}")
        for w in warnings:
            print(f"         └─ {w}")

    print(f"\nописаний {len(rows)}, с ошибками {bad}")
    if bad or skipped:
        sys.exit(1)

    if book:
        filled, missing = put_in_book(rows, book)
        print(f"строк книги заполнено: {filled}")
        if missing:
            print("нет в книге: " + ", ".join(missing))
