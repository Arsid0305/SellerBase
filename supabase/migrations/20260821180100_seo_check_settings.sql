-- Пороги и веса проверки карточек — в app_settings (принцип №7).
-- Крутятся первые месяцы, схему ради этого мигрировать незачем.

INSERT INTO public.app_settings (key, value, value_type, comment) VALUES
  ('seo_desc_len_min',      '1000', 'int', 'Описание короче — недогруз по SEO'),
  ('seo_desc_len_target',   '1500', 'int', 'Нижняя граница ориентира длины описания'),
  ('seo_desc_len_max',      '2000', 'int', 'Верхняя граница ориентира длины описания'),
  ('seo_kw_max_repeats',    '3',    'int', 'Максимум вхождений одной фразы в описание'),
  ('seo_lead_chars',        '150',  'int', 'Сколько знаков видно до «Читать далее»'),
  ('seo_chars_min_filled',  '6',    'int', 'Минимум заполненных характеристик на карточку'),
  ('seo_weight_risk_r',     '25',   'int', 'Штраф за находку риска R'),
  ('seo_weight_risk_a',     '8',    'int', 'Штраф за находку риска A'),
  ('seo_weight_missing_g',  '10',   'int', 'Штраф за отсутствие рабочего ключа группы'),
  ('seo_weight_len',        '10',   'int', 'Штраф за длину вне ориентира'),
  ('seo_weight_repeats',    '8',    'int', 'Штраф за превышение вхождений'),
  ('seo_weight_lead',       '6',    'int', 'Штраф за вступление в первых знаках'),
  ('seo_weight_chars',      '12',   'int', 'Штраф за недозаполненные характеристики'),
  ('seo_weight_glue',       '6',    'int', 'Штраф за склейку значений в одном поле характеристики')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, comment = EXCLUDED.comment;
