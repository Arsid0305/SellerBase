-- Справочник характеристик предмета WB + ревизия заполненности карточек.
--
-- Зачем: до сих пор мы тянули с WB только заполненные характеристики карточки
-- (content/v2/get/cards/list). Из-за этого было видно «заполнено 10 полей», но не
-- «10 из скольки». Незаполненное поле не с чем сравнить — ревизия невозможна.
-- Здесь появляется вторая сторона: какие поля у предмета есть вообще и какие
-- из них обязательны. Источник — content/v2/object/charcs/{subjectId}, то есть
-- сам WB; списки полей по категориям не выдумываем и руками не ведём.

CREATE TABLE IF NOT EXISTS public.wb_subject_charcs (
  subject_id   BIGINT  NOT NULL,
  charc_id     BIGINT  NOT NULL,
  name         TEXT    NOT NULL,
  required     BOOLEAN NOT NULL DEFAULT false,
  unit_name    TEXT,
  max_count    INTEGER,
  popular      BOOLEAN,
  charc_type   INTEGER,
  -- Часть характеристик WB показывает только продавцам других стран
  -- (ИКПУ — Узбекистан, NTIN — Казахстан и т. п.). Нам они не нужны, но и удалять
  -- их нельзя: список может измениться, а флаг переживает пересинхронизацию.
  is_foreign   BOOLEAN NOT NULL DEFAULT false,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id, charc_id)
);

COMMENT ON TABLE public.wb_subject_charcs IS
  'Какие характеристики WB ждёт у предмета. Заполняет fetch-wb-subject-charcs из content/v2/object/charcs.';
COMMENT ON COLUMN public.wb_subject_charcs.is_foreign IS
  'Поле для продавцов других стран (ИКПУ, NTIN и подобные) — в ревизии не считается пропуском.';

CREATE INDEX IF NOT EXISTS wb_subject_charcs_subject_idx
  ON public.wb_subject_charcs (subject_id);

ALTER TABLE public.wb_subject_charcs ENABLE ROW LEVEL SECURITY;

-- Справочник полей, которые заполняют только продавцы других стран.
-- Отдельной таблицей, а не списком в коде: пополнять его будет человек, увидев
-- незнакомое поле в ревизии, и для этого не должен ждать деплоя.
CREATE TABLE IF NOT EXISTS public.wb_foreign_charc_names (
  name_pattern TEXT PRIMARY KEY,
  note         TEXT
);

COMMENT ON TABLE public.wb_foreign_charc_names IS
  'Маски имён характеристик для продавцов других стран. Матчатся регистронезависимо по подстроке.';

INSERT INTO public.wb_foreign_charc_names (name_pattern, note) VALUES
  ('икпу',      'Идентификатор классификации продукции и услуг — Узбекистан'),
  ('ntin',      'Номер товарной номенклатуры — Казахстан'),
  ('мхик',      'Международный код — Узбекистан'),
  ('тн вэд кз', 'ТН ВЭД Казахстана'),
  ('для узбекистана', 'Явно страновое поле'),
  ('для казахстана',  'Явно страновое поле'),
  ('для киргизии',    'Явно страновое поле'),
  ('для армении',     'Явно страновое поле'),
  ('для беларуси',    'Явно страновое поле')
ON CONFLICT (name_pattern) DO NOTHING;

ALTER TABLE public.wb_foreign_charc_names ENABLE ROW LEVEL SECURITY;
