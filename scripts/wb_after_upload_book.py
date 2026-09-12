#!/usr/bin/env python3
"""Собирает книгу «состояние карточек WB после заливки» и сверяет её с прежней.

Владелица залила новые описания на WB, внеся по ходу свои правки. Этот
скрипт строит новый рабочий файл: что реально стоит на витрине сейчас,
чем это отличается от того, что мы отдавали, и что требует внимания.

Источники:
  - `kartochki_arols.xlsx` — книга, которую отдавали перед заливкой;
  - выгрузка карточек WB (Content API) через `fetch-wb-content` в
    `sku_catalog`: наименование, описание, характеристики.

Живые тексты восстановлены построчно по хешам (совпавшие строки берутся
из книги, изменённые — из выгрузки), точность проверена по md5 каждого
описания: все 38 изменённых карточек сошлись с базой.

Запуск:
    python3 scripts/wb_after_upload_book.py <папка_с_данными> <куда.xlsx>
"""

import json
import re
import sys
from pathlib import Path

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

GREEN = PatternFill("solid", fgColor="E2EFDA")
YELLOW = PatternFill("solid", fgColor="FFF2CC")
RED = PatternFill("solid", fgColor="F8CBAD")
GREY = PatternFill("solid", fgColor="EDEDED")
HEAD = PatternFill("solid", fgColor="D9E1F2")
THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

# ── Находки сверки ──────────────────────────────────────────────────────
# Ключ — артикул, значение — список замечаний. Ничего не придумано:
# каждое замечание либо видно в живом тексте, либо следует из правила
# владелицы (§21, §21.1, §25 в tasks/rules.md).

NEGATIVE = ("Вернулась фраза «не подходит». Правило §25 от 03.09: "
            "недостатки не называем, переводим в выгоду")
RISK_TNVED = ("Наименование содержит «ортопедический» или «лимфодренажный» — "
              "тянет товар в позицию 9019 (аппаратура для механотерапии) "
              "и под маркировку")

FINDINGS = {
    "ACRB1MS101BL": [NEGATIVE], "ACRB1MS101PN": [NEGATIVE], "ACRB1MS101RJ": [NEGATIVE],
    "ACRB1MS106BL": [NEGATIVE], "ACRB1MS106BС": [NEGATIVE], "ACRB1MS106RJ": [NEGATIVE],
    "ACRB1MS106WH": [NEGATIVE], "ACRB1MS107BL": [NEGATIVE], "ACRB1MS107BС": [NEGATIVE],
    "ACRB1MS107PN": [NEGATIVE], "ACRB1MS107WH": [NEGATIVE], "ACRB1MS109BL": [NEGATIVE],
    "ACRB1MS109LI": [NEGATIVE], "ACRB1MS109PN": [NEGATIVE],
    "ACRB1MS106PN": [NEGATIVE, RISK_TNVED],
    "ACRB1MS107RJ": [NEGATIVE, RISK_TNVED],
    "ACRB1MS109BС": [NEGATIVE, RISK_TNVED],
    "ACRB1MS109RJ": [NEGATIVE, RISK_TNVED],
    "AAND1BL101RD": ["Опечатка «Аппортировка» — правильно «Апортировка»"],
    "AAND1RP301BG": ["Опечатка «аппортировка» — правильно «апортировка»",
                     "Вес 550 г против 580 г в прежнем разборе. В поле карточки "
                     "тоже 550 — расхождение с разбором, не внутри карточки"],
    "AAND1RP301YL": ["Опечатка «аппортировка» — правильно «апортировка»",
                     "Вес 350 г против 380 г в прежнем разборе. В поле карточки тоже 350"],
    "AHMA3BW202WH": ["Опечатка «стоппор» — правильно «стопор», два раза"],
    "ACRB1SK101RD": ["В конце описания обрубок «зни!» — хвост от прежнего текста. "
                     "Видно покупателю"],
    "ACRA7TB201CL": ["Длинное тире в тексте — правило §21 требует только короткий дефис"],
    "ACRA7TB201LI": ["Длинное тире в тексте — правило §21"],
    "AKTA2KN102YL": ["Лезвие названо 15 см, по размерному слайду у жёлтого 15,5 см. "
                     "У зелёного 15 см — теперь карточки неразличимы по размеру"],
    "ACRB1MS103BL": ["На витрине прежний текст 3365 знаков, новый не залит",
                     "Текст дословно совпадает с ACRB1MS103PN и ACRB1MS103RJ"],
    "ACRB1MS103PN": ["На витрине прежний текст, новый не залит", "Дубль текста с 103BL и 103RJ"],
    "ACRB1MS103RJ": ["На витрине прежний текст, новый не залит", "Дубль текста с 103BL и 103PN"],
    "ACRB1MS103LI": ["На витрине прежний текст 4973 знака, новый не залит",
                     "В тексте «медицинский», длинное и среднее тире, капслок"],
    "AKTA2KN101YL": ["На витрине прежний текст 688 знаков с «идеальный помощник» "
                     "и «высококачественного», новый не залит"],
    "AHMA2BW202WH": ["На витрине прежний текст-полотно 1844 знака, капслок "
                     "«УДОБНО И ЛЕГКО!», новый не залит"],
    "ACRB4FR300CL": ["На витрине прежний текст, новый не залит",
                     "В тексте «реабилитации» — заявление о свойствах, "
                     "и «премиальных», «Идеально подходят»"],
    "ACRB5FR200CL": ["На витрине прежний текст 1141 знак, новый не залит"],
    "ACRB3FR101CL": ["Текст свой, не из книги: маркированный список с (60 lbs), "
                     "«Рабочая резинка, на которой…»"],
    "ACRA7TB101BC": ["Вес в тексте 160 г. В книге у этой подгруппы 165 г, "
                     "в поле карточки 160 — текст и поле согласованы"],
    "ACRA7TB101CL": ["Вес в тексте 160 г, в книге 165 г. Поле карточки 160"],
    "ACRA7TB201BC": ["Вес в тексте 160 г, в книге 170 г. Поле карточки 160"],
    "ACRA7TB201CL": ["Вес в тексте 160 г, в книге 170 г. Поле карточки 160"],
    "ACRA7TB201LI": ["Вес в тексте 160 г, в книге 170 г. Поле карточки 160"],
    "ACRA7TB201WH": ["Вес в тексте 160 г, в книге 170 г. Поле карточки 160"],
    "ACRA7TB301CL": ["Вес в тексте 160 г, в книге 150 г. Поле карточки 160"],
    "ACRA7TB301GR": ["Вес в тексте 160 г, в книге 150 г. Поле карточки 160"],
}

# Артикулы, которых владелица не касалась: сняты с продажи либо ещё не
# готовились. Её слова 11.09: «то, что не обновлено, мне пока не надо».
NOT_IN_WORK = {
    "ACRF1KP101BC": "Капа. Не продаётся", "ACRF1KP101BL": "Капа. Не продаётся",
    "ACRF1KP101GN": "Капа. Не продаётся", "ACRF1KP101RD": "Капа. Не продаётся",
    "ACRF1KP102BC": "Капа. Не продаётся", "ACRF1KP102GN": "Капа. Не продаётся",
    "ACRF1KP102RD": "Капа. Не продаётся", "ACRF1KP103BC": "Капа. Не продаётся",
    "AAND1ST202BL": "Палочка-кость. Снята с производства 02.09",
    "ACRB1SK201BC": "Скакалка со счётчиком. Снята с производства 02.09",
    "ACRB5FR400CL": "Резинки латексные 5 шт. Не продавались, карточка почти пустая",
    "AKTA1KN101GR": "Консервный нож. Разбора не было",
    "AKTA1PR101GR": "Чеснокодавка. Снята с продажи 03.09",
    "AKTA2KN101BL": "Шпатель голубой. Разбора не было",
    "AKTA4ST102CL": "Пробки. Выведены из ассортимента 03.09",
    "ACRA7TB401BC": "Таблетница 401. Остаток 0, в закупке отсутствует",
}

# Карточки, где на витрине осталась прежняя редакция: восстановить их текст
# построчно нельзя (он другой целиком), а считать «залито как есть» нельзя тем
# более — в книге лежит новый текст, которого на витрине нет.
OLD_TEXT = {
    "ACRB1MS103BL": 3365, "ACRB1MS103LI": 4973, "ACRB1MS103PN": 3365,
    "ACRB1MS103RJ": 3366, "AKTA2KN101YL": 688, "AHMA2BW202WH": 1844,
    "ACRB4FR300CL": 1267, "ACRB5FR200CL": 1141,
}

GROUPS = {
    "Таблетницы": "Таблетницы", "Мешки для стирки": "Мешки для стирки",
    "Массажеры механические": "Массажеры и мячи", "Игрушки для животных": "Игрушки для собак",
    "Скакалки": "Скакалки", "Эспандеры": "Резинки фитнес", "Бандажи косметические": "Бандажи",
    "Ножи для пиццы": "Ножи для пиццы", "Пробки для бутылок": "Пробки",
    "Шпатели кондитерские": "Шпатели",
}


def load(data_dir):
    d = Path(data_dir)
    return (json.loads((d / "book.json").read_text(encoding="utf-8")),
            json.loads((d / "live.json").read_text(encoding="utf-8")),
            json.loads((d / "titles.json").read_text(encoding="utf-8")))


def verdict(article, book_text, live_text):
    """Что стало с описанием карточки при заливке."""
    if article in NOT_IN_WORK:
        return "не в работе"
    if article in OLD_TEXT:
        return "на витрине прежний текст"
    if live_text is None:
        return "нет на витрине"
    norm = lambda t: re.sub(r"\s+", " ", t or "").strip().lower()
    if norm(book_text) == norm(live_text):
        return "залито как есть"
    return "залито с правками"


def write_group(out, title, rows):
    ws = out.create_sheet(title[:31])
    columns = [("Артикул", 15), ("Наименование на WB", 44), ("Описание на витрине", 95),
               ("Знаков", 8), ("Статус", 18), ("Что проверить", 52)]
    for i, (label, width) in enumerate(columns, 1):
        c = ws.cell(row=1, column=i, value=label)
        c.font = Font(bold=True, size=10)
        c.fill = HEAD
        c.alignment = Alignment(wrap_text=True, vertical="center")
        c.border = BORDER
        ws.column_dimensions[get_column_letter(i)].width = width
    ws.freeze_panes = "B2"

    for r, row in enumerate(rows, 2):
        for i, value in enumerate(row, 1):
            c = ws.cell(row=r, column=i, value=value)
            c.alignment = Alignment(wrap_text=True, vertical="top")
            c.border = BORDER
        status, note = row[4], row[5]
        fill = GREEN if status == "залито как есть" else YELLOW
        if note:
            fill = RED
        if status in ("не в работе", "нет на витрине"):
            fill = GREY
        ws.cell(row=r, column=5).fill = fill
        if note:
            ws.cell(row=r, column=6).fill = RED
        ws.row_dimensions[r].height = 120
    return ws


def main(data_dir, dst):
    book, live, titles = load(data_dir)
    out = openpyxl.Workbook()
    out.remove(out.active)

    by_group, stats = {}, {"залито как есть": 0, "залито с правками": 0,
                           "на витрине прежний текст": 0, "не в работе": 0,
                           "нет на витрине": 0}
    fixes = []

    for article, rec in sorted(book.items()):
        group = GROUPS.get(rec["_group"], rec["_group"])
        book_text = rec.get("Описание") or ""
        live_text = live.get(article)
        if article not in live and article in titles and article not in NOT_IN_WORK:
            live_text = book_text          # совпало дословно
        if article not in titles:
            live_text = None               # карточки нет на витрине
        state = verdict(article, book_text, live_text)
        stats[state] += 1
        notes = FINDINGS.get(article, [])
        if article in NOT_IN_WORK:
            notes = [NOT_IN_WORK[article]]
        note = "; ".join(notes)
        if article in OLD_TEXT:
            shown = (f"(на витрине прежний текст, {OLD_TEXT[article]} знаков; "
                     f"ниже — новый, который остался незалитым)\n\n{book_text}")
        else:
            shown = live_text if live_text else "(на витрине карточки нет)"
        by_group.setdefault(group, []).append(
            [article, titles.get(article, ""), shown, len(shown), state, note])
        for n in notes:
            if article not in NOT_IN_WORK:
                fixes.append([article, titles.get(article, ""), n])

    for article, reason in sorted(NOT_IN_WORK.items()):
        if article in book:
            continue
        by_group.setdefault("Не в работе", []).append(
            [article, titles.get(article, ""), "", 0, "не в работе", reason])
        stats["не в работе"] += 1

    for group in sorted(by_group, key=lambda g: (g == "Не в работе", -len(by_group[g]))):
        write_group(out, group, by_group[group])

    # ── лист «Что чинить» ───────────────────────────────────────────────
    ws = out.create_sheet("Что чинить", 0)
    for i, (label, width) in enumerate((("Артикул", 15), ("Наименование", 44),
                                        ("Что не так", 80)), 1):
        c = ws.cell(row=1, column=i, value=label)
        c.font = Font(bold=True)
        c.fill = HEAD
        ws.column_dimensions[get_column_letter(i)].width = width
    for r, row in enumerate(sorted(fixes), 2):
        for i, value in enumerate(row, 1):
            c = ws.cell(row=r, column=i, value=value)
            c.alignment = Alignment(wrap_text=True, vertical="top")
        ws.row_dimensions[r].height = 30
    ws.freeze_panes = "A2"

    # ── лист «Итог» ─────────────────────────────────────────────────────
    ws = out.create_sheet("Итог", 0)
    ws.column_dimensions["A"].width = 44
    ws.column_dimensions["B"].width = 12
    ws.column_dimensions["C"].width = 74
    rows = [
        ("Сверка карточек WB после заливки", "", ""),
        ("", "", ""),
        ("Что сделано", "", "Свежая выгрузка карточек с WB 11.09, сверка с книгой, "
                            "которую отдавали перед заливкой"),
        ("", "", ""),
        ("Состояние", "Карточек", "Что это значит"),
        ("Залито как есть", stats["залито как есть"], "Текст на витрине дословно совпал с книгой"),
        ("Залито с правками", stats["залито с правками"], "Текст отличается от книги: "
                                                          "правки владелицы"),
        ("На витрине прежний текст", stats["на витрине прежний текст"],
         "Новый текст не залит, работает старый"),
        ("Не в работе", stats["не в работе"], "Снято с продажи или не готовилось"),
        ("Нет на витрине", stats["нет на витрине"], "Карточки нет в каталоге кабинета"),
        ("", "", ""),
        ("Замечаний к живым карточкам", len(fixes), "Полный список — лист «Что чинить»"),
    ]
    for r, row in enumerate(rows, 1):
        for i, value in enumerate(row, 1):
            c = ws.cell(row=r, column=i, value=value)
            c.alignment = Alignment(wrap_text=True, vertical="top")
            if r == 1:
                c.font = Font(bold=True, size=14)
            if r == 5:
                c.font = Font(bold=True)
                c.fill = HEAD
        ws.row_dimensions[r].height = 28

    out.save(dst)
    print(f"групп {len(by_group)}, замечаний {len(fixes)}  →  {dst}")
    for k, v in stats.items():
        print(f"  {k:<20} {v:>3}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
