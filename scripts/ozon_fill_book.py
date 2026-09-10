#!/usr/bin/env python3
"""Заполняет рабочую книгу Ozon тем, что уже известно.

Источник артикулов — файл владелицы UNIT, лист «Себес»: там связка
«Код WB / Код OZON / Арт. Поставщика / Номенклатура / Штрихкод». Это SSOT
по товарам, база под него подстраивается, а не наоборот.

Из базы (sku_catalog, по коду WB) добираются предмет WB, код ТН ВЭД,
габариты, вес и бренд. Коды ТН ВЭД берутся с WB один в один — так требует
владелица: товар один и тот же, код у него один.

Что НЕ заполняется и почему:
  - цены, НДС — это решение владелицы, не данные;
  - фото — на Ozon нужны прямые ссылки, которых у нас пока нет;
  - аннотация, хештеги, Rich-контент — отдельная работа по SEO.

Запуск:
    python3 scripts/ozon_fill_book.py <UNIT.xlsx> <связки.tsv> <книга.xlsx>

Файл связок — три блока, разделённых строкой '---':
  1) wb_article|предмет|тнвэд
  2) wb_article|длина_см|ширина_см|высота_см|вес_кг|бренд
"""

import sys

import openpyxl
from openpyxl.styles import Font, PatternFill

# Предмет WB → категория Ozon. Взято по шаблонам, которые скачала владелица.
# Где сопоставление не однозначное, товар попадает в «на уточнение».
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

# «Массажеры механические» на Ozon распадаются на две категории: мяч — это
# «Спортивный массажный мяч», всё остальное (ленточные, роликовые) —
# «Аксессуар для массажа». Различаем по названию товара.
BALL_WORDS = ("мяч", "мячик", "шарик")

# Предметы WB, под которые владелица не скачивала шаблон. Строки остаются
# без категории — пусть будет видно, что товар не пристроен.
NO_TEMPLATE = {"Капы", "Прессы для чеснока", "Массажеры косметические", "Скребки"}

# Решения владелицы от 10.09.2026. Держим здесь, чтобы не спрашивать заново:
# это не открытые вопросы, а известные статусы.
KNOWN_STATUS = {
    "Капы": "Пока не продаются. Шаблон не нужен",
    "Прессы для чеснока": "Сняты с продажи",
}
# По артикулу — там, где статус не от предмета, а от конкретного товара.
KNOWN_STATUS_BY_ARTICLE = {
    "ACRA7TB101WH": "Артикул будет добавлен позже",
}

WARN = PatternFill("solid", fgColor="FCE4D6")
OK = PatternFill("solid", fgColor="E2EFDA")


def load_links(path):
    """Читает связки из tsv: два блока через '---'."""
    blocks = open(path, encoding="utf-8").read().split("---")
    subj, dims = {}, {}
    for line in blocks[0].strip().splitlines():
        p = line.split("|")
        if len(p) >= 3 and p[0].strip():
            subj[p[0].strip()] = (p[1].strip(), p[2].strip())
    if len(blocks) > 1:
        for line in blocks[1].strip().splitlines():
            p = line.split("|")
            if len(p) >= 6 and p[0].strip():
                dims[p[0].strip()] = tuple(x.strip() for x in p[1:6])
    return subj, dims


def pick_category(subject, title):
    if subject in NO_TEMPLATE:
        return None, "шаблон не скачан"
    if subject == "Массажеры механические":
        low = (title or "").lower()
        if any(w in low for w in BALL_WORDS):
            return "Спортивный массажный мяч", ""
        return "Аксессуар для массажа", ""
    cat = SUBJECT_TO_CATEGORY.get(subject)
    if not cat:
        return None, "предмет WB не сопоставлен"
    return cat, ""


def read_products(unit_path):
    """Лист «Себес» файла UNIT — список товаров владелицы."""
    wb = openpyxl.load_workbook(unit_path, read_only=True, data_only=True)
    ws = wb["Себес"]
    out = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        wb_code, oz_code, article, name, barcode = (row + (None,) * 5)[:5]
        if not article:
            continue
        out.append({
            "wb": str(wb_code).strip() if wb_code not in (None, "", 0, "0") else "",
            "ozon": str(oz_code).strip() if oz_code not in (None, "", 0, "0") else "",
            "article": str(article).strip(),
            "name": str(name).strip() if name else "",
            "barcode": str(barcode).strip() if barcode else "",
        })
    wb.close()
    return out


def col_index(ws, title_startswith):
    for c in ws[1]:
        if c.value and str(c.value).startswith(title_startswith):
            return c.column
    return None


def fill(unit_path, links_path, book_path):
    subj, dims = load_links(links_path)
    products = read_products(unit_path)
    wb = openpyxl.load_workbook(book_path)

    goods = wb["Товары"]
    ci = {
        "article": col_index(goods, "Артикул"),
        "cat": col_index(goods, "Категория"),
        "name": col_index(goods, "Название товара"),
        "sku": col_index(goods, "SKU"),
        "barcode": col_index(goods, "Штрихкод"),
        "brand": col_index(goods, "Бренд"),
        "w": col_index(goods, "Вес в упаковке"),
        "wd": col_index(goods, "Ширина упаковки"),
        "ht": col_index(goods, "Высота упаковки"),
        "ln": col_index(goods, "Длина упаковки"),
    }

    by_cat = {}
    unresolved = []
    row = 3
    for p in products:
        subject, tnved = subj.get(p["wb"], ("", ""))
        cat, why = pick_category(subject, p["name"])

        goods.cell(row=row, column=ci["article"], value=p["article"])
        goods.cell(row=row, column=ci["name"], value=p["name"])
        if p["ozon"]:
            goods.cell(row=row, column=ci["sku"], value=p["ozon"])
        if p["barcode"]:
            goods.cell(row=row, column=ci["barcode"], value=p["barcode"])

        if cat:
            goods.cell(row=row, column=ci["cat"], value=cat)
            by_cat.setdefault(cat, []).append((p["article"], tnved))
        else:
            c = goods.cell(row=row, column=ci["cat"], value="")
            c.fill = WARN
            unresolved.append((p["article"], p["name"], subject or "нет в базе", why or "нет предмета WB"))

        d = dims.get(p["wb"])
        if d:
            ln, wd, ht, kg, brand = d
            # Ozon хочет миллиметры и граммы, у нас сантиметры и килограммы.
            if ln: goods.cell(row=row, column=ci["ln"], value=round(float(ln) * 10))
            if wd: goods.cell(row=row, column=ci["wd"], value=round(float(wd) * 10))
            if ht: goods.cell(row=row, column=ci["ht"], value=round(float(ht) * 10))
            if kg: goods.cell(row=row, column=ci["w"], value=round(float(kg) * 1000))
            if brand: goods.cell(row=row, column=ci["brand"], value=brand)
        row += 1

    # Листы категорий: артикул, ТН ВЭД с WB и «Тип», если вариант один.
    from ozon_build_book import base_name  # noqa: E402

    filled_tnved = 0
    for cat, items in by_cat.items():
        title = cat[:28]
        if title not in wb.sheetnames:
            continue
        ws = wb[title]
        c_art = col_index(ws, "Артикул")
        c_tn = col_index(ws, "ТН ВЭД")
        r = 3
        for article, tnved in items:
            ws.cell(row=r, column=c_art, value=article)
            if c_tn and tnved:
                full = lookup_full_code(wb, cat, tnved)
                if full:
                    ws.cell(row=r, column=c_tn, value=full).fill = OK
                    filled_tnved += 1
                else:
                    ws.cell(row=r, column=c_tn, value="").fill = WARN
            r += 1

    # Лист с тем, что не сошлось.
    rep = wb.create_sheet("Без категории")
    head = ["Артикул", "Название", "Предмет на WB", "Почему без категории", "Решение владелицы"]
    for i, h in enumerate(head, start=1):
        c = rep.cell(row=1, column=i, value=h)
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="1F3864")
        rep.column_dimensions[chr(64 + i)].width = [22, 55, 26, 26, 40][i - 1]
    for r, item in enumerate(unresolved, start=2):
        for i, v in enumerate(item, start=1):
            rep.cell(row=r, column=i, value=v)
        status = KNOWN_STATUS_BY_ARTICLE.get(item[0]) or KNOWN_STATUS.get(item[2], "")
        c = rep.cell(row=r, column=5, value=status)
        c.fill = OK if status else WARN

    wb.save(book_path)
    return len(products), by_cat, filled_tnved, unresolved


def lookup_full_code(wb, cat, code):
    """Ozon хранит ТН ВЭД строкой «код - описание». Ищем её в справочниках."""
    ref = wb["Справочники"]
    target = f"{cat} — ТН ВЭД коды ЕАЭС"
    for c in ref[1]:
        if c.value == target:
            for r in range(2, ref.max_row + 1):
                v = ref.cell(row=r, column=c.column).value
                if v and str(v).startswith(code):
                    return v
            return None
    return None


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    total, by_cat, tn, unresolved = fill(*sys.argv[1:])
    print(f"товаров из файла UNIT: {total}")
    print(f"разложено по категориям: {sum(len(v) for v in by_cat.values())}")
    for c, v in sorted(by_cat.items()):
        print(f"    {c:<30} {len(v)}")
    print(f"проставлено кодов ТН ВЭД: {tn}")
    print(f"без категории: {len(unresolved)}")
