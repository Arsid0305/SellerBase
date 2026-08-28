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


def parse_generic(text):
    """Контракт «раздел на артикул»: ## ART · nm_id."""
    rows = []
    for head, body in split_sections(text):
        m = re.match(r"\s*(" + ART + r")\s*·\s*(\d+)", head)
        if not m:
            continue
        rows.append({
            "Артикул": m.group(1),
            "nm_id": m.group(2),
            "Наименование": field(body, "Наименование"),
            "Материал изделия": field(body, "Материал изделия"),
            "Цвет": field(body, "Цвет"),
            "Комплектация": field(body, "Комплектация"),
            "Описание": fenced(body),
        })
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
                for sku, val in zip(skus, cells[1:]):
                    v = val.replace("`", "").replace(" + ", "\n").replace(" · ", "\n").strip()
                    if v and not v.startswith(("то же", "стоит", "требует")):
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
            f = fields.get(sku[4:], {})
            rows.append({
                "Артикул": sku,
                "Наименование": mm.group(2).strip(),
                "Цвет": f.get("Цвет", ""),
                "Комплектация": f.get("Комплектация", ""),
                "Описание": fenced(sec),
            })
    return rows


INFO_GROUPS = [
    ("Мешки для стирки", "meshki-stirki.md"),
    ("Мячи 6-7-9 см", "myachi-106-107-109.md"),
    ("Массажёры 101", "massagers-roller-101.md"),
    ("Таблетницы", "tabletnitsy.md"),
]


def parse_order(text):
    """Нумерованный список из раздела «## Порядок» — что делать и в каком порядке."""
    m = re.search(r"(?m)^## Порядок\s*$(.*?)(?=^## |\Z)", text, re.S)
    if not m:
        return []
    items = re.findall(r"(?m)^\d+\.\s+(.+?)(?=\n\d+\.|\n\n|\Z)", m.group(1), re.S)
    return [re.sub(r"\s+", " ", i).replace("**", "").strip() for i in items]


def parse_per_article(text):
    """Таблица «## По артикулам»: артикул -> что сделать со слайдами."""
    m = re.search(r"(?m)^## По артикулам\s*$(.*?)(?=^## |\Z)", text, re.S)
    if not m:
        return {}
    out = {}
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

COLS = ["Артикул", "nm_id", "Наименование", "Зона массажа", "Действие",
        "Материал изделия", "Цвет", "Комплектация", "Описание", "Инфографика"]


def sheet(wb, name, rows):
    ws = wb.create_sheet(name)
    cols = [c for c in COLS if any(r.get(c) for r in rows)]
    ws.append(cols)
    for c in ws[1]:
        c.font = Font(bold=True)
    for r in rows:
        ws.append([r.get(c, "") for c in cols])
    widths = {"Артикул": 15, "nm_id": 12, "Наименование": 46, "Описание": 90,
              "Инфографика": 70}
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
        ["Пустые ячейки", "Значит «стоит верно, не трогать». Обоснования — "
                          "в docs/seo/descriptions/."],
        ["Мячи", "Заливать описания только после правки инфографики: "
                 "docs/seo/infographics/myachi-106-107-109.md."],
        ["Таблетницы", "Строку про крепления в трёх карточках 101* подтвердить перед заливкой."],
        ["Инфографика", "Отдельный лист: что переделать на слайдах, по группам. Мячи и массажёры — "
                        "срочно, там медицинские заявления. Таблетницы — не срочно."],
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
