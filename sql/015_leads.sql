-- 015: Таблица заявок на подключение (лиды)
-- После интеграции оплаты — добавятся поля payment_status, paid_at

CREATE TABLE IF NOT EXISTS leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key      TEXT NOT NULL,               -- 'start' | 'standard' | 'business' | 'corporation'
  company_name  TEXT NOT NULL,
  inn           TEXT,
  contact_name  TEXT NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL DEFAULT 'new'  -- 'new' | 'processing' | 'done'
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
