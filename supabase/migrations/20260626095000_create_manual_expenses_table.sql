-- Ручной ввод доп. расходов (реклама вне WB, упаковка, зарплата, прочее).
-- Закрывает #18: страница /expenses была placeholder, теперь даёт CRUD.
-- Интеграция в get_full_pnl_by_period — отдельной задачей 18a.

CREATE TABLE IF NOT EXISTS public.manual_expenses (
  id          BIGSERIAL PRIMARY KEY,
  dt          DATE NOT NULL,
  category    TEXT NOT NULL,
  amount_rub  NUMERIC(12,2) NOT NULL CHECK (amount_rub >= 0),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_manual_expenses_dt ON public.manual_expenses (dt DESC);
COMMENT ON TABLE public.manual_expenses IS 'Ручной ввод доп. расходов (реклама вне WB, упаковка, зарплата, прочее). Не из API.';
