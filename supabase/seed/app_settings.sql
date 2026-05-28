-- Первоначальные ключи app_settings.
-- Меняй значение в Studio — пересчитается во всех VIEW автоматически.

insert into app_settings (key, value, value_type, comment) values
  ('tax_rate',                '0.06',    'number', 'Ставка налога (УСН 6% по умолчанию)'),
  ('safety_stock_days',       '14',      'number', 'Страховой запас в днях для расчёта поставки'),
  ('sales_velocity_window',   '28',      'number', 'Окно расчёта скорости продаж в днях (7/14/28)'),
  ('china_lead_time_days',    '60',      'number', 'Срок производства+доставки из Китая в днях'),
  ('target_margin',           '0.25',    'number', 'Целевая маржа (25%); ниже — красная подсветка'),
  ('cogs_allocation_method',  'weight',  'string', 'Метод аллокации карго: weight | volume | value | units'),
  ('cny_default_rate',        '12.5',    'number', 'Курс юаня по умолчанию для прогнозных расчётов')
on conflict (key) do nothing;
