#!/usr/bin/env python3
"""Собирает рабочую книгу Ozon из официальных шаблонов категорий.

Зачем. Ozon принимает файл по одной категории: у одиннадцати наших категорий
93 разных колонки, из них общих всего 31. Плюс в каждом шаблоне шесть скрытых
страниц со списками значений и 26 проверок ввода — склеить книги нельзя, всё
это умрёт. Поэтому работа идёт в одной книге, а файлы загрузки собираются из
неё обратно (scripts/ozon_split_book.py), причём поверх родного шаблона, а не
с нуля — тогда проверки и выпадающие списки остаются живыми.

Запуск:
    python3 scripts/ozon_build_book.py <папка_с_шаблонами> <куда_положить.xlsx>

Читает только листы «Шаблон» и «info» (в info лежит base64 с описанием
категории и допустимыми значениями). Ничего никуда не отправляет.
"""

import base64
import glob
import json
import os
import re
import sys

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

# Строка данных в шаблоне Ozon начинается с пятой: 1 — группа колонок,
# 2 — название, 3 — «Обязательное поле», 4 — подсказка.
TEMPLATE_HEADER_ROWS = 4

# Ключевые колонки рабочей книги. «Артикул» связывает общий лист с листами
# категорий, «Категория» говорит, в какой шаблон уйдёт строка.
KEY_COLUMNS = ["Артикул*", "Категория*"]

# Служебные колонки Ozon — их заполняет сам Ozon при проверке, нам не нужны.
SERVICE_COLUMNS = {"№", "Ошибка", "Недочёты"}

# Списки длиннее этого в выпадающий список Excel не помещаем: ограничение
# формата на длину формулы. Такие поля берутся с листа «Справочники» вручную.
MAX_INLINE_LOOKUP = 900

HEAD = PatternFill("solid", fgColor="1F3864")
HEAD_REQ = PatternFill("solid", fgColor="922B21")
HINT = PatternFill("solid", fgColor="EDEDED")
KEY = PatternFill("solid", fgColor="FFF2CC")
THIN = Side(style="thin", color="BFBFBF")


def read_templates(folder):
    """Достаёт из шаблонов колонки, признак обязательности и справочники."""
    cats = {}
    for path in sorted(glob.glob(os.path.join(folder, "*.xlsx"))):
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        if "info" not in wb.sheetnames or "Шаблон" not in wb.sheetnames:
            wb.close()
            continue

        blob = "".join(
            str(c) for r in wb["info"].iter_rows(values_only=True) for c in r if c
        )
        try:
            meta = json.loads(base64.b64decode(blob + "=" * (-len(blob) % 4)))
        except Exception:
            wb.close()
            continue

        name = meta.get("name")
        if not name or name in cats:
            wb.close()
            continue

        rows = list(
            wb["Шаблон"].iter_rows(min_row=1, max_row=TEMPLATE_HEADER_ROWS, values_only=True)
        )
        header, required, hints = rows[1], rows[2], rows[3]

        columns = []
        for i, title in enumerate(header):
            if not title or title in SERVICE_COLUMNS:
                continue
            # Обязательность Ozon помечает двумя способами и непоследовательно:
            # строкой «Обязательное поле» под шапкой и звёздочкой в самом
            # названии. У «Бренд*» есть только звёздочка. Учитываем оба.
            is_req = (
                isinstance(required[i], str) and required[i].strip() == "Обязательное поле"
            ) or str(title).rstrip().endswith("*")
            columns.append({
                "name": title,
                "required": is_req,
                "hint": clean_hint(hints[i]),
            })

        lookups = {}
        for attr in meta.get("attributes", {}).values():
            values = [
                v["Value"]
                for v in (attr.get("LookupData") or {}).get("Values", {}).values()
                if v.get("Value")
            ]
            if values:
                lookups[attr["Name"]] = values

        cats[name] = {"file": os.path.basename(path), "columns": columns, "lookups": lookups}
        wb.close()
    return cats


def clean_hint(text):
    """Подсказки Ozon — простыни на пол-экрана. Оставляем первую мысль."""
    if not text:
        return ""
    text = re.sub(r"\s+", " ", str(text)).strip()
    text = re.split(r"(?<=[.!?])\s", text)[0]
    return text[:160]


def base_name(column_title):
    """«Артикул*» и «Артикул» — одна колонка. Звёздочку в имени не учитываем."""
    return column_title.rstrip("*").strip()


def split_columns(cats):
    """Делит колонки на общие для всех категорий и особые.

    Колонка считается общей, только если она есть везде И список допустимых
    значений у неё везде одинаковый. «ТН ВЭД коды ЕАЭС» и «Тип» есть во всех
    категориях, но список у каждой свой (у ТН ВЭД от 34 до 426 значений) —
    на общем листе к ним не привязать выпадающий список, и владелице пришлось
    бы набирать код руками. Такие колонки уходят на листы категорий.
    """
    per_cat = {n: {base_name(c["name"]) for c in d["columns"]} for n, d in cats.items()}
    everywhere = set.intersection(*per_cat.values()) if per_cat else set()

    common = set()
    for col in everywhere:
        variants = {
            frozenset(d["lookups"][col])
            for d in cats.values()
            if col in d["lookups"]
        }
        if len(variants) <= 1:
            common.add(col)

    # Порядок общих колонок берём у первой категории — он у Ozon осмысленный.
    first = next(iter(cats.values()))
    common_cols = [c for c in first["columns"] if base_name(c["name"]) in common]
    return common_cols, common


def style_header(ws, columns, key_names=()):
    """Две строки шапки: название и подсказка. Данные с третьей."""
    for i, col in enumerate(columns, start=1):
        # Звёздочку Ozon ставит и в названии, и отдельной строкой «Обязательное
        # поле». Приводим к одному виду: «Бренд *», а не «Бренд*».
        title = base_name(col["name"]) + (" *" if col["required"] else "")
        cell = ws.cell(row=1, column=i, value=title)
        cell.font = Font(bold=True, color="FFFFFF", size=10)
        cell.fill = HEAD_REQ if col["required"] else HEAD
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        cell.border = Border(bottom=THIN)
        if base_name(title) in {base_name(k) for k in key_names}:
            cell.fill = KEY
            cell.font = Font(bold=True, color="7D6608", size=10)

        hint = ws.cell(row=2, column=i, value=col["hint"])
        hint.font = Font(size=8, color="595959", italic=True)
        hint.alignment = Alignment(vertical="top", wrap_text=True)
        hint.fill = HINT
        hint.border = Border(bottom=THIN)

        width = 16 if not col["hint"] else 26
        ws.column_dimensions[get_column_letter(i)].width = min(max(len(title) + 4, width), 40)

    ws.row_dimensions[1].height = 34
    ws.row_dimensions[2].height = 46
    ws.freeze_panes = "C3"


def write_reference_sheet(ws, cats):
    """Каждый справочник — своя колонка. К ним привязываются выпадающие списки."""
    ranges = {}
    col = 1

    # Справочники, одинаковые во всех категориях (цвет, страна), кладём один
    # раз под ключом ("", поле) — на них ссылается общий лист «Товары».
    shared = {}
    for data in cats.values():
        for field, values in data["lookups"].items():
            shared.setdefault(field, set()).add(frozenset(values))
    shared = {f: sorted(next(iter(v))) for f, v in shared.items() if len(v) == 1 and len(next(iter(v))) > 1}

    for field, values in sorted(shared.items()):
        head = ws.cell(row=1, column=col, value=f"Общий — {field}")
        head.font = Font(bold=True, size=9, color="FFFFFF")
        head.fill = HEAD
        head.alignment = Alignment(wrap_text=True, vertical="center")
        for r, v in enumerate(values, start=2):
            ws.cell(row=r, column=col, value=str(v))
        letter = get_column_letter(col)
        ranges[("", field)] = (f"'Справочники'!${letter}$2:${letter}${len(values) + 1}", len(values))
        ws.column_dimensions[letter].width = 30
        col += 1

    for cat_name, data in sorted(cats.items()):
        for field, values in sorted(data["lookups"].items()):
            if len(values) < 2 or field in shared:
                continue  # единственное значение подставим сами, общее уже выше
            head = ws.cell(row=1, column=col, value=f"{cat_name} — {field}")
            head.font = Font(bold=True, size=9, color="FFFFFF")
            head.fill = HEAD
            head.alignment = Alignment(wrap_text=True, vertical="center")
            for r, v in enumerate(values, start=2):
                ws.cell(row=r, column=col, value=str(v))
            letter = get_column_letter(col)
            ranges[(cat_name, field)] = (
                f"'Справочники'!${letter}$2:${letter}${len(values) + 1}",
                len(values),
            )
            ws.column_dimensions[letter].width = 30
            col += 1
    ws.row_dimensions[1].height = 40
    ws.freeze_panes = "A2"
    return ranges


def attach_dropdowns(ws, columns, cat_name, ranges, rows=500):
    """Вешает выпадающие списки на колонки, у которых Ozon даёт закрытый список."""
    attached = 0
    for i, col in enumerate(columns, start=1):
        field = base_name(col["name"])
        # Сначала общий справочник (цвет, страна), потом свой у категории.
        key = ("", field) if ("", field) in ranges else (cat_name, field)
        if key not in ranges:
            continue
        formula, size = ranges[key]
        if size > MAX_INLINE_LOOKUP:
            continue
        dv = DataValidation(type="list", formula1=formula, allow_blank=True)
        # showErrorMessage=False: список подсказывает, но не запрещает — Ozon
        # иногда принимает значения, которых в выгруженном списке нет.
        dv.showErrorMessage = False
        letter = get_column_letter(i)
        dv.add(f"{letter}3:{letter}{rows + 2}")
        ws.add_data_validation(dv)
        attached += 1
    return attached


def build(folder, out_path):
    cats = read_templates(folder)
    if not cats:
        sys.exit(f"в {folder} не нашлось шаблонов Ozon")

    common_cols, common_names = split_columns(cats)

    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # 1. Справочники — первыми, чтобы на них можно было ссылаться.
    ref_ws = wb.create_sheet("Справочники")
    ranges = write_reference_sheet(ref_ws, cats)

    # 2. Товары — общий список. Категория решает, в какой шаблон уйдёт строка.
    goods = wb.create_sheet("Товары", 0)
    goods_cols = [
        {"name": "Артикул*", "required": True,
         "hint": "Ваш код товара. По нему строка связывается с листом категории."},
        {"name": "Категория*", "required": True,
         "hint": "Из списка. Определяет, в какой шаблон Ozon уйдёт строка."},
    ] + [c for c in common_cols if base_name(c["name"]) != "Артикул"]
    style_header(goods, goods_cols, KEY_COLUMNS)

    cat_list = sorted(cats)
    dv_cat = DataValidation(type="list", formula1='"' + ",".join(cat_list) + '"', allow_blank=True)
    dv_cat.showErrorMessage = True
    dv_cat.error = "Выберите категорию из списка"
    dv_cat.add("B3:B502")
    goods.add_data_validation(dv_cat)
    # Цвет и страна-изготовитель одинаковы во всех категориях — списки вешаем
    # прямо здесь. Категорийные (ТН ВЭД, Тип) сюда не попадают по построению.
    attach_dropdowns(goods, goods_cols, "", ranges)

    # 3. Лист на каждую категорию — только её особые колонки.
    per_cat_counts = {}
    for name in cat_list:
        own = [c for c in cats[name]["columns"] if base_name(c["name"]) not in common_names]
        sheet_title = name[:28]
        ws = wb.create_sheet(sheet_title)
        cols = [{"name": "Артикул*", "required": True,
                 "hint": "Тот же артикул, что на листе «Товары»."}] + own
        style_header(ws, cols, ["Артикул*"])
        attach_dropdowns(ws, cols, name, ranges)
        per_cat_counts[name] = len(own)

    # 4. Памятка.
    info = wb.create_sheet("Как заполнять")
    lines = [
        ("Рабочая книга Ozon", True),
        ("", False),
        ("Одна книга на все категории. Файлы для загрузки собираются из неё отдельно —", False),
        ("склеить шаблоны Ozon в один нельзя: он принимает файл по одной категории.", False),
        ("", False),
        ("Порядок", True),
        ("1. Лист «Товары» — по строке на товар. Артикул и категория обязательны.", False),
        ("2. Лист своей категории — те же артикулы, особые характеристики.", False),
        ("3. Красная шапка — без этого поля Ozon карточку не примет.", False),
        ("4. Жёлтая шапка — артикул и категория, по ним всё связывается.", False),
        ("", False),
        ("Про выпадающие списки", True),
        ("Где Ozon даёт закрытый список, он подставлен. Список подсказывает, но не", False),
        ("запрещает: Ozon иногда принимает и то, чего в выгрузке нет.", False),
        ("Полные списки — на листе «Справочники».", False),
        ("", False),
        ("ТН ВЭД", True),
        ("Обязателен в 10 категориях из 11 (кроме кухонного ножа). Список закрытый.", False),
        ("Ozon пишет прямо: при сомнениях — к таможенному представителю.", False),
        ("Ответственность за код на продавце, поэтому выбирает его владелица.", False),
        ("", False),
        ("Фото", True),
        ("Только прямые ссылки на картинку (заканчиваются на .jpg / .png) или Яндекс.Диск.", False),
        ("Главное фото — одна ссылка. Дополнительных — до 14, через пробел.", False),
        ("Фон белый или светлый. Без надписей, цен, логотипов и водяных знаков.", False),
        ("", False),
        ("Что в книге", True),
        (f"Категорий: {len(cats)}. Общих колонок: {len(common_cols)}. Справочников: {len(ranges)}.", False),
    ]
    for r, (text, bold) in enumerate(lines, start=1):
        c = info.cell(row=r, column=1, value=text)
        c.font = Font(bold=bold, size=12 if bold else 10)
    info.column_dimensions["A"].width = 95

    for r, name in enumerate(cat_list, start=len(lines) + 2):
        info.cell(row=r, column=1, value=f"   {name} — своих колонок: {per_cat_counts[name]}")

    wb.move_sheet("Как заполнять", offset=-len(wb.sheetnames) + 1)
    wb.save(out_path)
    return cats, common_cols, ranges, per_cat_counts


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    cats, common, ranges, counts = build(sys.argv[1], sys.argv[2])
    print(f"категорий: {len(cats)}")
    print(f"общих колонок: {len(common)}")
    print(f"выпадающих списков: {len(ranges)}")
    print(f"книга: {sys.argv[2]}")
