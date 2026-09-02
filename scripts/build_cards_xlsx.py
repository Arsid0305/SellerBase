#!/usr/bin/env python3
"""Сборка книги для заливки карточек в кабинет WB из docs/seo/descriptions/*.md.

Один лист на группу. Колонки — то, что вносится руками: наименование, значения
полей и текст описания. Значения полей разделены переводом строки внутри ячейки:
в кабинете каждое значение вносится отдельной строкой (склейка через запятую —
дефект заполнения, см. tasks/rules.md).

    python3 scripts/build_cards_xlsx.py [--out kartochki_arols.xlsx]

Файлы описаний написаны в разное время и в разной разметке, поэтому у каждого
свой разборщик. Общий контракт для новых файлов — раздел на артикул:

    ## ACRA7TB201BC · 186826338
    | поле | значение |
    | **Наименование** | `...` |
    ### Описание — N знаков
    ```
    текст
    ```
"""
import argparse, pathlib, re, sys

try:
    import openpyxl
    from openpyxl.styles import Alignment, Font
except ImportError:
    sys.exit("нужен openpyxl: pip install openpyxl")

ROOT = pathlib.Path(__file__).resolve().parent.parent
DESCR = ROOT / "docs" / "seo" / "descriptions"

ART = r"[A-Z]{4}\d[A-Z]{2}\d{3}[A-ZС]{2}"  # «С» в конце части артикулов кириллическая


def fenced(text):
    """Первый блок в тройных кавычках."""
    m = re.search(r"```\n(.*?)\n```", text, re.S)
    return m.group(1).strip() if m else ""


def field(section, name):
    """Значение из строки таблицы «| поле | значение |»."""
    m = re.search(r"^\|\s*\**" + re.escape(name) + r"\**\s*\|\s*(.+?)\s*\|\s*$",
                  section, re.M)
    if not m:
        return ""
    v = m.group(1).replace("`", "").strip()
    return "" if v.startswith("стоит") else v.replace(" · ", "\n")


def split_sections(text, level="## "):
    """Разбить на разделы по заголовку, вернуть [(заголовок, тело)]."""
    parts = re.split(r"(?m)^" + re.escape(level) + r"(.+)$", text)
    return list(zip(parts[1::2], parts[2::2]))


# Поля, которые в лист не выносим: они служебные либо дублируют другие колонки.
SKIP_FIELDS = {"поле", "Описание"}

# Три состояния поля, и в книге они должны различаться на глаз.
# Раньше «проверено, верно» и «до поля не дошли» выглядели одинаково — пустой
# ячейкой, и при заливке было не понять, это «не трогать» или «не заполнено».
OK = "верно, не трогать"
MEASURE = "нужен замер"


def status(value):
    """Значение поля для книги. Пусто — значит поле не разобрано.

    «30 — стоит верно» превращается в «30 — верно, не трогать»: видно и что стоит
    в карточке, и что менять не нужно. Голое «стоит верно» — только пометку.
    """
    v = value.replace("`", "").replace("**", "").strip()
    if not v or v.startswith("---"):
        return ""
    low = v.lower()
    if low.startswith("требует") or low.startswith("замерить"):
        return MEASURE
    if low.startswith(("стоит верно", "оставить", "стоит", "то же")):
        return OK
    for marker in (" — стоит верно", " - стоит верно", ", стоит верно"):
        if marker in v:
            return v.replace(marker, "").strip() + f" — {OK}"
    if "требует замера" in low:
        return MEASURE
    return v.replace(" · ", "\n")


def all_fields(section):
    """Все строки таблицы «| поле | значение |» раздела, как есть.

    Раньше здесь был список из четырёх имён, и любое разобранное поле сверх него
    молча терялось: «Упаковка» стояла во всех десяти таблетницах и ни разу
    не попала в книгу. Теперь колонки набираются из того, что реально разобрано.
    """
    out = {}
    for name, value in re.findall(r"^\|\s*\**([^|*]+?)\**\s*\|\s*(.+?)\s*\|\s*$",
                                  section, re.M):
        name = name.strip()
        if name in SKIP_FIELDS or name.startswith("-"):
            continue
        v = status(value)
        if v:
            out[name] = v
    return out


def parse_generic(text):
    """Контракт «раздел на артикул»: ## ART · nm_id."""
    rows = []
    for head, body in split_sections(text):
        m = re.match(r"\s*(" + ART + r")\s*·\s*(\d+)", head)
        if not m:
            continue
        row = {"Артикул": m.group(1), "nm_id": m.group(2), "Описание": fenced(body)}
        row.update(all_fields(body))
        rows.append(row)
    return rows


def parse_roller(text):
    """massagers-roller-101.md: ## RJ · оранжевый · 223420736 + общая таблица."""
    common = text.split("## Общее для всех трёх", 1)[-1].split("\n---", 1)[0]
    rows = []
    for head, body in split_sections(text):
        m = re.match(r"\s*([A-Z]{2})\s*·\s*([^·]+?)\s*·\s*(\d+)", head)
        if not m:
            continue
        rows.append({
            "Артикул": "ACRB1MS101" + m.group(1),
            "nm_id": m.group(3),
            "Наименование": field(body, "Наименование"),
            "Зона массажа": field(body, "Зона массажа"),
            "Действие": field(common, "Действие"),
            "Материал изделия": field(common, "Материал изделия"),
            "Цвет": field(body, "Цвет"),
            "Комплектация": field(common, "Комплектация"),
            "Описание": fenced(body),
        })
    return rows


def parse_balls(text):
    """myachi-106-107-109.md: наименования в общей таблице, описания в ### <код>."""
    titles, zones = {}, {}
    for code, title in re.findall(r"\|\s*`(" + ART + r")`\s*\|\s*`([^`]+)`", text):
        titles[code] = title
    for d, vals in re.findall(r"\|\s*(\d)\s*см\s*\|\s*((?:`[^`]+`\s*·?\s*)+)\|", text):
        zones["10" + d] = "\n".join(re.findall(r"`([^`]+)`", vals))
    action = "\n".join(["снятие мышечного напряжения", "снятие отечности",
                        "улучшение кровообращения"])

    # Цвет разобран одной таблицей «| SKU | стоит сейчас | ставим |» в разделе
    # «### Цвет». Ищем строго внутри него: снаружи есть другие таблицы с кодом
    # в первой колонке, и без границы раздела в «Цвет» попадали их числа.
    # «оставить» значит «текущее значение верно» — такие в книгу не выносим,
    # пустая ячейка по контракту листа и означает «не трогать».
    colors = {}
    csec = re.search(r"(?m)^### Цвет\b.*?(?=^#{2,3} |\Z)", text, re.S)
    if csec:
        for line in csec.group(0).split("\n"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) != 3 or not cells[0].startswith("`"):
                continue
            put = status(cells[2].replace(" + ", "\n"))
            if not put:
                continue
            for code in re.findall(r"`(\d{3}[A-ZС]{1,2})`", cells[0]):
                colors["ACRB1MS" + code] = put

    rows = []
    for head, body in split_sections(text, "### "):
        m = re.match(r"\s*(\d{3}[A-ZС]{1,2})\s*·", head)
        if not m:
            continue
        code = "ACRB1MS" + m.group(1)
        if code not in titles:
            continue
        rows.append({
            "Артикул": code,
            "nm_id": "",
            "Наименование": titles[code],
            "Зона массажа": zones.get(code[7:10], ""),
            "Действие": action,
            "Материал изделия": "ПВХ",
            "Цвет": colors.get(code, ""),
            # Одно значение на всю группу: в поставке только сам мяч.
            # Плёнка ОПП — материал упаковки, в значение поля не идёт:
            # покупатель так не ищет, а «Упаковка» отвечает на другой вопрос.
            "Комплектация": "массажный мяч",
            "Упаковка": "пакет",
            "Описание": fenced(body),
        })
    return rows


INFO = ROOT / "docs" / "seo" / "infographics"

def parse_bags(text):
    """meshki-dlya-stirki.md: поля таблицей «колонка на SKU», описания в «### ART · имя».

    Разбор идёт по подгруппам: внутри каждой одна таблица «Значения полей», где
    первая колонка — имя поля, остальные — артикулы. Готовы не все подгруппы,
    поэтому карточка попадает в лист только если у неё есть описание.
    """
    rows = []
    for _, body in split_sections(text):
        fields = {}
        m = re.search(r"^\| поле \|(.+?)\|\s*$", body, re.M)
        if m:
            skus = [re.sub(r"[`\s]|\(.*?\)", "", c) for c in m.group(1).split("|") if c.strip()]
            start = body.index(m.group(0))
            for line in body[start:].split("\n")[2:]:
                if not line.startswith("|"):
                    break
                cells = [c.strip() for c in line.strip("|").split("|")]
                # Имя поля бывает выделено жирным: «**Высота предмета**» и
                # «Высота предмета» — одно поле, но без чистки станут двумя колонками.
                cells[0] = cells[0].replace("*", "").replace("`", "").strip()
                for sku, val in zip(skus, cells[1:]):
                    v = status(val.replace(" + ", "\n"))
                    if v:
                        fields.setdefault(sku, {})[cells[0]] = v

        # «**`SKU`** — «Комплектация», N значений:» + блок в тройных кавычках
        for m2 in re.finditer(r"\*\*`(\d[A-Z]{2}\d{3}[A-ZС]{2})`\*\* — «Комплектация»"
                              r"(?:(?!\*\*`)[\s\S])*?```\n(.*?)\n```",
                              body, re.S):
            fields.setdefault(m2.group(1), {})["Комплектация"] = m2.group(2).strip()

        for head, sec in split_sections(body, "### "):
            mm = re.match(r"\s*`?(" + ART + r")`?\s*·\s*(.+)", head)
            if not mm:
                continue
            sku = mm.group(1)
            row = {
                "Артикул": sku,
                "Наименование": mm.group(2).strip(),
                "Описание": fenced(sec),
            }
            # Все разобранные поля подгруппы, а не два выбранных: у мешков
            # набор полей предмета свой, и что именно разобрано — решает файл.
            row.update({k: v for k, v in fields.get(sku[4:], {}).items()
                        if k not in SKIP_FIELDS})
            rows.append(row)
    return rows


INFO_GROUPS = [
    ("Мешки для стирки", "meshki-stirki.md"),
    ("Мячи 6-7-9 см", "myachi-106-107-109.md"),
    ("Массажёры 101", "massagers-roller-101.md"),
    ("Таблетницы", "tabletnitsy.md"),
]


def parse_order(text):
    """Нумерованные списки из разделов «Порядок».

    В файле их может быть несколько — по одному на подгруппу, и заголовок
    бывает как второго уровня, так и третьего. Берём все и склеиваем.
    """
    items = []
    for m in re.finditer(r"(?m)^#{2,3} Порядок\s*$(.*?)(?=^#{2,3} |\Z)", text, re.S):
        for i in re.findall(r"(?m)^\d+\.\s+(.+?)(?=\n\d+\.|\n\n|\Z)", m.group(1), re.S):
            items.append(re.sub(r"\s+", " ", i).replace("**", "").strip())
    return items


def parse_per_article(text):
    """Таблицы «По артикулам»: артикул -> что сделать со слайдами.

    Разделов может быть несколько (по подгруппам), уровень заголовка ## или ###.
    """
    out = {}
    for m in re.finditer(r"(?m)^#{2,3} По артикулам\s*$(.*?)(?=^#{2,3} |\Z)", text, re.S):
        for art, todo in re.findall(r"(?m)^\|\s*(" + ART + r")\s*\|\s*(.+?)\s*\|\s*$", m.group(1)):
            out[art] = todo.strip()
    return out


def all_per_article():
    """Задания по слайдам со всех групп разом."""
    out = {}
    for _, fname in INFO_GROUPS:
        path = INFO / fname
        if path.exists():
            out.update(parse_per_article(path.read_text(encoding="utf-8")))
    return out


def urgency(text):
    """Срочность — по наличию медицинских заявлений в задании."""
    return "не срочно" if "нет ни одного медицинского заявления" in text else "срочно"


def sheet_info(wb):
    rows = []
    for name, fname in INFO_GROUPS:
        path = INFO / fname
        if not path.exists():
            continue
        t = path.read_text(encoding="utf-8")
        for i, item in enumerate(parse_order(t), 1):
            rows.append([name if i == 1 else "", urgency(t) if i == 1 else "", i, item])
    if not rows:
        return 0
    ws = wb.create_sheet("Инфографика")
    ws.append(["Группа", "Срочность", "№", "Что сделать"])
    for c in ws[1]:
        c.font = Font(bold=True)
    for r in rows:
        ws.append(r)
    for col, w in zip("ABCD", (20, 14, 5, 105)):
        ws.column_dimensions[col].width = w
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")
    ws.freeze_panes = "A2"
    return len(rows)


GROUPS = [
    ("Таблетницы", "tabletnitsy.md", parse_generic),
    ("Мячи 6-7-9 см", "myachi-106-107-109.md", parse_balls),
    ("Массажёры 101", "massagers-roller-101.md", parse_roller),
    ("Мешки для стирки", "meshki-dlya-stirki.md", parse_bags),
]

# Порядок колонок в листе. Список задаёт только очерёдность известных полей —
# всё, что разобрано сверх него, дописывается в конец само (см. sheet()).
# Хардкод списка стоил «Упаковки» у десяти таблетниц: поле было разобрано,
# но в книгу не попало, потому что имени не было в этом перечне.
COLS = ["Артикул", "nm_id", "Наименование", "Полное наименование товара",
        "Зона массажа", "Действие", "Материал изделия", "Цвет", "Комплектация",
        "Упаковка", "Код ТН ВЭД", "Описание", "Рич-контент", "Инфографика"]

# Коды ТН ВЭД по префиксу артикула. Источник — docs/marking/codes-marking.md,
# который, в свою очередь, собран по матрице владелицы (выбор помечен зелёным).
# Ключ проверяется как префикс, длинные ключи имеют приоритет над короткими.
TNVED = {
    "ACRA7TB": "3926909709",      # таблетницы
    "AHMA": "6307909800",         # мешки для стирки
    "ACRB1MS": "9506919000",      # мячи массажные
    "ACRH1MS": "9506919000",      # массажёр для пальцев
    "ACRF1BN101": "6307909800",   # бандажи лайкра
    "ACRF1BN201": "3926909709",   # бандаж силиконовый
    "ACRB1SK": "9506919000",      # скакалки
    "ACRB3FR": "9506919000",      # эспандеры
    "ACRB4FR": "9506919000",
    "ACRB5FR": "9506919000",
    "AKTA4ST": "3923509000",      # пробки для бутылок
    "AKTA2KN101": "3926909709",   # шпатель кондитерский — см. вопрос 2 в codes-marking.md
    "AKTA2KN102": "8211920000",   # ножи для пиццы
    "AAND1BL": "4016999708",      # игрушки для собак, резина
    "AAND1ST": "4016999708",
    "AAND1RP": "5609000000",      # канаты, хлопковая нить
}


# Колонки, которые показываем даже пустыми: это места под работу, которая ещё
# не сделана. Рич-контент владелица собирает в кабинете, сценариев в репозитории
# пока нет — но столбец должен быть виден, иначе про него забудут.
FORCE_COLS = {"Рич-контент"}


def tnved(article):
    """Код ТН ВЭД по артикулу. Пусто, если группа кода ещё не получила."""
    match = [k for k in TNVED if article.startswith(k)]
    return TNVED[max(match, key=len)] if match else ""


def sheet(wb, name, rows):
    ws = wb.create_sheet(name)
    for r in rows:
        r.setdefault("Код ТН ВЭД", tnved(r.get("Артикул", "")))
    # Известные колонки в заданном порядке, затем всё остальное разобранное.
    extra = sorted({k for r in rows for k in r} - set(COLS))
    cols = [c for c in COLS + extra if any(r.get(c) for r in rows) or c in FORCE_COLS]
    ws.append(cols)
    for c in ws[1]:
        c.font = Font(bold=True)
    for r in rows:
        ws.append([r.get(c, "") for c in cols])
    widths = {"Артикул": 15, "nm_id": 12, "Наименование": 46,
              "Полное наименование товара": 46, "Описание": 90,
              "Рич-контент": 60, "Инфографика": 70, "Код ТН ВЭД": 14}
    for i, c in enumerate(cols, 1):
        ws.column_dimensions[ws.cell(1, i).column_letter].width = widths.get(c, 22)
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")
    ws.freeze_panes = "A2"
    return len(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="kartochki_arols.xlsx")
    a = ap.parse_args()

    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    intro = wb.create_sheet("Как заливать")
    for line in [
        ["Порядок", "Сначала характеристики, затем наименование, затем описание."],
        ["Значения полей", "Каждое значение — отдельной строкой. Склейка через запятую "
                           "с 01.05.2026 — основание для теневого бана."],
        ["Что значит ячейка", "Значение — вносим его. «верно, не трогать» — поле проверено "
                              "по данным, менять не нужно. «нужен замер» — ждём физический замер "
                              "или ответ поставщика. ПУСТО — поле ещё не разобрано, "
                              "решения по нему нет. Обоснования — в docs/seo/descriptions/."],
        ["Мячи", "Заливать описания только после правки инфографики: "
                 "docs/seo/infographics/myachi-106-107-109.md."],
        ["Таблетницы", "Строку про крепления в трёх карточках 101* подтвердить перед заливкой."],
        ["Наименования", "Пересобраны 28.08 по годовому отчёту кабинета: каждая карточка "
                         "получила запрос, по которому она реально продаёт, а не самый "
                         "частотный. Разборы — docs/seo/fill-plan/."],
        ["ACRA7TB101WH", "Карточки нет в каталоге кабинета, в годовом отчёте ноль строк. "
                         "Наименование в листе — предложение на случай, если карточку заводим. "
                         "Сначала подтвердите, что она существует."],
        ["Инфографика", "Отдельный лист: что переделать на слайдах, по группам. Мячи и массажёры — "
                        "срочно, там медицинские заявления. Таблетницы — не срочно."],
        ["Код ТН ВЭД", "Из вашей матрицы «ТН ВЭД × ОКПД 2» — тот код, что помечен зелёным. "
                       "Разбор и расхождения с прежними кодами — docs/marking/codes-marking.md."],
        ["Рич-контент", "Столбец пустой: сценариев ещё нет. Заполняется по мере разбора групп, "
                        "заливается в кабинете отдельно от карточки."],
        ["Колонки", "Набираются из того, что разобрано в docs/seo/descriptions/. "
                    "Если поле разобрано — оно появится в листе само, дописывать список не нужно."],
    ]:
        intro.append(line)
    intro.column_dimensions["A"].width = 18
    intro.column_dimensions["B"].width = 95
    for row in intro.iter_rows():
        row[0].font = Font(bold=True)
        row[1].alignment = Alignment(wrap_text=True, vertical="top")

    per_article = all_per_article()
    n_info = sheet_info(wb)
    if n_info:
        print(f"Инфографика: {n_info} пунктов")

    total = 0
    for name, fname, parser in GROUPS:
        path = DESCR / fname
        if not path.exists():
            print(f"пропуск: нет {fname}")
            continue
        rows = parser(path.read_text(encoding="utf-8"))
        for r in rows:
            todo = per_article.get(r["Артикул"])
            if todo:
                r["Инфографика"] = todo
        if not rows:
            print(f"пропуск: {fname} — ни одного артикула не разобрано")
            continue
        total += sheet(wb, name, rows)
        print(f"{name}: {len(rows)} карточек")

    wb.save(a.out)
    print(f"записано {total} карточек → {a.out}")


if __name__ == "__main__":
    main()
