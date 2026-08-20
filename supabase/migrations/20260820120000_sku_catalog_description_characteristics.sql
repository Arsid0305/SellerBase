-- description и characteristics карточек WB — для аудита формулировок,
-- кодов ТН ВЭД / ОКПД 2 и рисков «Честного знака». Полный текст карточки
-- и её характеристики приходят из WB Content API в том же ответе, что и
-- title/brand/subjectName, но раньше отбрасывались.

alter table public.sku_catalog
  add column if not exists description text,
  add column if not exists characteristics jsonb,
  add column if not exists dimensions jsonb;

create index if not exists sku_catalog_characteristics_gin
  on public.sku_catalog using gin (characteristics);
