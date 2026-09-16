-- Партия из техзадания на фулфилмент, сентябрь 2026.
--
-- Загружены только каналы ФБО: ВБ 1 000 штук и Ozon 2 423.
-- ФБС (2 124) не загружен — ждёт разбивки по площадкам от владелицы.
--
-- Точка отгрузки МО_ЮРЛОВО_2, даты поставок Ozon 25.09–01.10.
-- Ozon не разносим по 26 направлениям: владелица отдаёт одно число.

insert into public.supply_plans (name, status, plan_date, source, notes)
select 'ТЗ ФФ, сентябрь 2026', 'план', date '2026-09-25', 'tz_ff',
       'Отгрузка через фулфилмент. Точка МО_ЮРЛОВО_2, даты поставок Ozon 25.09-01.10. ФБС 2 124 шт ждёт разбивки на ВБ и Ozon.'
where not exists (select 1 from public.supply_plans where name = 'ТЗ ФФ, сентябрь 2026');

create temporary table _p (my_article text, wb_article bigint, fbo_wb int, fbo_ozon int, fbs int);

insert into _p values
  ('ACRF1BN101BC', 169153168, 5, 38, 27),
  ('ACRF1BN201GR', 169395410, 5, 32, 33),
  ('ACRB1MS101PN', 275208801, 5, 21, 14),
  ('ACRB1MS101BL', 275208802, 5, 19, 16),
  ('ACRB1MS101RJ', 223420736, 5, 21, 14),
  ('ACRB1MS106WH', 236072835, 30, 136, 104),
  ('ACRB1MS106PN', 236072836, 20, 70, 40),
  ('ACRB1MS106BL', 236072834, 20, 80, 30),
  ('ACRB1MS106RJ', 223671295, 20, 69, 41),
  ('ACRB1MS106BС', 370591238, 20, 64, 46),
  ('ACRB1MS107WH', 419145391, 30, 160, 80),
  ('ACRB1MS107PN', 419145389, 10, 80, 40),
  ('ACRB1MS107BL', 419145748, 10, 80, 40),
  ('ACRB1MS107RJ', 419141548, 10, 80, 40),
  ('ACRB1MS107BС', 419145985, 10, 80, 40),
  ('ACRB1MS109PN', 419145390, 10, 76, 44),
  ('ACRB1MS109BL', 419145749, 10, 80, 40),
  ('ACRB1MS109RJ', 419141549, 10, 72, 48),
  ('ACRB1MS109LI', 419146579, 10, 60, 60),
  ('ACRB1MS109BС', 419145986, 10, 62, 58),
  ('ACRB3FR101CL', 820643010, 10, 21, 19),
  ('ACRB5FR200CL', 550539998, 10, 21, 19),
  ('ACRB4FR300CL', 550539999, 10, 21, 19),
  ('AHMA3BW201WH', 176721350, 20, 24, 46),
  ('AHMA3BW202WH', 176723275, 20, 37, 33),
  ('AHMA1BW111WH', 236929188, 20, 30, 40),
  ('AHMA1BW112WH', 236929187, 20, 29, 41),
  ('AHMA1BW101BG', 176500218, 20, 31, 39),
  ('AHMA3BW101BG', 177404837, 20, 31, 39),
  ('AHMA3BW102BG', 177405495, 20, 40, 30),
  ('AHMA7BW101BG', 172832355, 10, 16, 24),
  ('ACRA7TB201BC', 186826338, 80, 65, 143),
  ('ACRA7TB201CL', 419130077, 40, 30, 74),
  ('ACRA7TB201WH', 448248943, 40, 33, 71),
  ('ACRA7TB201LI', 448254852, 40, 32, 72),
  ('ACRA7TB301GR', 278515093, 40, 34, 46),
  ('ACRA7TB301CL', 345168494, 15, 32, 13),
  ('ACRA7TB301WH', 273516556, 15, 33, 12),
  ('ACRA7TB101BC', 186800214, 50, 0, 70),
  ('ACRA7TB101CL', 298193176, 30, 0, 30),
  ('ACRA7TB101WH', 1426871693, 30, 0, 30),
  ('AKTA4ST103CL', 370594147, 20, 40, 20),
  ('AKTA4ST101CL', 273556717, 20, 40, 20),
  ('AKTA2KN102YL', 273527791, 10, 21, 19),
  ('AKTA2KN102GN', 327442631, 10, 20, 20),
  ('AKTA2KN101YL', 273546535, 10, 19, 21),
  ('AAND1BL101BL', 251537413, 20, 80, 40),
  ('AAND1BL101RD', 251537223, 20, 80, 40),
  ('AAND1BL102BL', 251407392, 30, 60, 70),
  ('AAND1BL102RD', 251516159, 30, 76, 54),
  ('ACRB1SK101BC', 271440668, 5, 14, 26),
  ('ACRB1SK101RD', 271440669, 5, 16, 6),
  ('ACRB1SK101BL', 271440670, 5, 17, 23);

insert into public.supply_plan_items (plan_id, sku_id, channel, qty)
select pl.id, s.id, k.channel, k.qty
  from _p p
  join public.sku_catalog s on s.wb_article = p.wb_article
  cross join lateral (values ('fbo_wb', p.fbo_wb), ('fbo_ozon', p.fbo_ozon)) as k(channel, qty)
  cross join (select id from public.supply_plans where name = 'ТЗ ФФ, сентябрь 2026') pl
 where k.qty > 0
   and not exists (
     select 1 from public.supply_plan_items i
      where i.plan_id = pl.id and i.sku_id = s.id and i.channel = k.channel);

drop table _p;
