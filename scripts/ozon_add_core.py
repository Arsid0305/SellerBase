#!/usr/bin/env python3
"""Добавляет в книгу Ozon лист «Ядро (черновик с WB)».

Зачем черновик, а не ядро. Своих данных по Ozon нет: магазин простаивал
три-четыре месяца, поэтому отчёт «Запросы моего товара» пуст — он считает
только запросы, по которым покупатели видели или покупали товар.

Ядро с WB берётся как гипотеза: товар тот же, покупатель ищет его теми же
словами. Но частоты переносить нельзя, и это не мелочь:

    частота WB   — сколько РАЗ вводили запрос за 30 дней
    частота Ozon — сколько УНИКАЛЬНЫХ ЛЮДЕЙ вводили за 7 дней

Разные единицы и разные окна. Поэтому колонка с частотой WB подписана как
«для приоритета», а не как частота: она говорит, с какого запроса начинать
проверку, и ничего не говорит о спросе на Ozon.

Проверяются запросы по отчёту «Аналитика → Поисковые запросы» — он про
площадку, а не про магазин, и простой ему не мешает.

Запуск:
    python3 scripts/ozon_add_core.py <ядро.tsv> <книга.xlsx>
"""

import sys

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill

# Предмет WB → категория Ozon. То же сопоставление, что в ozon_fill_book.py.
SUBJECT_TO_CATEGORY = {
    "Бандажи косметические": "Маска-бандаж",
    "Мешки для стирки": "Мешок для стирки",
    "Таблетницы": "Таблетница",
    "Игрушки для животных": "Игрушка для животных",
    "Пробки для бутылок": "Пробка",
    "Шпатели кондитерские": "Шпатель-скребок кондитерский",
    "Ножи для пиццы": "Кухонный нож",
    "Консервные ножи": "Кухонный нож",
    "Скакалки": "Фитнес и йога",
    "Эспандеры": "Фитнес и йога",
}

# «Массажеры механические» на Ozon делятся надвое. Для товара мы различали по
# его названию, а здесь товара нет — есть запрос. Различаем по самому запросу:
# «мяч», «шарик» → категория мячей, всё остальное → аксессуары.
BALL_WORDS = ("мяч", "мячик", "шарик", "шар", "мфр")

HEAD = PatternFill("solid", fgColor="1F3864")
ASK = PatternFill("solid", fgColor="C55A11")
RISK = PatternFill("solid", fgColor="FCE4D6")

# Запросы, которые уводят карточку в чужую категорию или в обязанность
# маркировки. Разбирались на WB (docs/seo/stop-words.md) — на Ozon те же
# грабли: «массажер для рук» и «тренажер для спины» у мячей тянут товар
# в позицию 9019 «аппаратура для механотерапии».
RISKY = {
    "массажер для рук", "тренажер для спины", "тренажер для шеи",
    "массажный аппарат", "реабилитация после инсульта", "лимфодренажный тренажер",
    "массажер от отеков", "от отеков тела", "механический массажер",
    "массажер для коленей", "от плоскостопия массажер", "тренажер для стоп",
    "тренажер для лица", "тренажер для челюсти",
}


def category_for(subject, query):
    if subject == "Массажеры механические":
        low = query.lower()
        if any(w in low for w in BALL_WORDS):
            return "Спортивный массажный мяч"
        return "Аксессуар для массажа"
    return SUBJECT_TO_CATEGORY.get(subject, "")


def add_core(core_path, book_path):
    rows = []
    for line in open(core_path, encoding="utf-8"):
        parts = line.rstrip("\n").split("|")
        if len(parts) != 4:
            continue
        subject, query, freq, skus = parts
        rows.append({
            "cat": category_for(subject, query),
            "subject": subject,
            "query": query,
            "freq": int(freq),
            "skus": int(skus),
            "risky": query.lower() in RISKY,
        })

    rows.sort(key=lambda r: (r["cat"], -r["freq"]))

    wb = openpyxl.load_workbook(book_path)
    if "Ядро (черновик с WB)" in wb.sheetnames:
        del wb["Ядро (черновик с WB)"]
    ws = wb.create_sheet("Ядро (черновик с WB)")

    headers = [
        ("Категория Ozon", 28, ""),
        ("Запрос", 46, ""),
        ("Приоритет (частота WB)", 16,
         "НЕ частота Ozon. WB считает показы за 30 дней, Ozon — уникальных людей за 7. Числа несопоставимы, это только порядок проверки."),
        ("SKU на WB", 10, "Сколько наших карточек ранжировалось по запросу на WB."),
        ("Есть на Ozon?", 14, "ЗАПОЛНЯЕТЕ ВЫ. да / нет — по отчёту «Аналитика → Поисковые запросы»."),
        ("Частота Ozon", 14, "ЗАПОЛНЯЕТЕ ВЫ. Число из отчёта Ozon."),
        ("В корзину, %", 12, "ЗАПОЛНЯЕТЕ ВЫ. Доля добавлений в корзину из отчёта Ozon."),
        ("Риск", 10, "Запрос уводит товар в чужую категорию или под маркировку. Не вносить без разбора."),
        ("Куда кладём", 18, "Название / характеристики / хештег. Заполняется после сверки."),
    ]
    for i, (title, width, hint) in enumerate(headers, start=1):
        c = ws.cell(row=1, column=i, value=title)
        c.font = Font(bold=True, color="FFFFFF", size=10)
        c.fill = ASK if "ЗАПОЛНЯЕТЕ ВЫ" in hint else HEAD
        c.alignment = Alignment(vertical="center", wrap_text=True)
        h = ws.cell(row=2, column=i, value=hint)
        h.font = Font(size=8, color="595959", italic=True)
        h.alignment = Alignment(vertical="top", wrap_text=True)
        ws.column_dimensions[chr(64 + i)].width = width

    ws.row_dimensions[1].height = 32
    ws.row_dimensions[2].height = 54

    for r, item in enumerate(rows, start=3):
        ws.cell(row=r, column=1, value=item["cat"] or "— не сопоставлено —")
        ws.cell(row=r, column=2, value=item["query"])
        ws.cell(row=r, column=3, value=item["freq"])
        ws.cell(row=r, column=4, value=item["skus"])
        if item["risky"]:
            ws.cell(row=r, column=8, value="да").fill = RISK
            ws.cell(row=r, column=2).fill = RISK

    ws.freeze_panes = "C3"
    ws.auto_filter.ref = f"A1:I{len(rows) + 2}"
    wb.save(book_path)
    return rows


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    rows = add_core(*sys.argv[1:])
    by_cat = {}
    for r in rows:
        by_cat.setdefault(r["cat"] or "не сопоставлено", []).append(r)
    print(f"запросов в ядре: {len(rows)}")
    print(f"помечено риском: {sum(1 for r in rows if r['risky'])}")
    for cat, items in sorted(by_cat.items()):
        top = max(items, key=lambda x: x["freq"])
        print(f"  {cat:<30} {len(items):>3}   самый частый: {top['query']} ({top['freq']})")
