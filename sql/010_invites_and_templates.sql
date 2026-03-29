-- ============================================================================
-- 010: Инвайт-ссылки + шаблоны проектов + подписки
-- Выполнить вручную в SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. Инвайт-ссылки для приглашения сотрудников
-- ============================================================================

CREATE TABLE IF NOT EXISTS invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id  uuid        REFERENCES projects(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'member',      -- project_role для назначения
  code        text        NOT NULL UNIQUE,                 -- короткий код (8 символов)
  max_uses    int         NOT NULL DEFAULT 1,              -- 0 = безлимитная
  used_count  int         NOT NULL DEFAULT 0,
  created_by  uuid        NOT NULL REFERENCES users(id),
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invites_code ON invites (code);
CREATE INDEX IF NOT EXISTS idx_invites_company ON invites (company_id);

-- ============================================================================
-- 2. Шаблоны проектов (портальный админ создаёт типовые конфигурации)
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,                        -- "Жилой дом", "Коммерция"
  description text,
  -- Конфигурация: массивы справочников с именами и sort_order
  -- { buildings: [{name, sort_order}], floors: [...], work_types: [...],
  --   constructions: [...], sets: [...], organizations: [...] }
  config      jsonb       NOT NULL DEFAULT '{}',
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. Подписки компаний (для будущей монетизации)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text    NOT NULL,                         -- "Пробный", "Стартовый", "Бизнес"
  max_users      int     NOT NULL DEFAULT 5,
  max_projects   int     NOT NULL DEFAULT 1,
  storage_gb     int     NOT NULL DEFAULT 5,
  price_monthly  numeric NOT NULL DEFAULT 0,
  is_trial       boolean NOT NULL DEFAULT false,
  is_active      boolean NOT NULL DEFAULT true,
  sort_order     int     NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS company_subscriptions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id     uuid        NOT NULL REFERENCES subscription_plans(id),
  status      text        NOT NULL DEFAULT 'trial',        -- trial, active, expired, cancelled
  starts_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company ON company_subscriptions (company_id);

-- ============================================================================
-- 4. Начальные данные: пробный тариф
-- ============================================================================

INSERT INTO subscription_plans (name, max_users, max_projects, storage_gb, price_monthly, is_trial, sort_order)
VALUES
  ('1 объект',    20,  1, 50,  50000, false, 1),
  ('5 объектов', 100,  5, 200, 200000, false, 2),
  ('10 объектов', 300, 10, 500, 300000, false, 3)
ON CONFLICT DO NOTHING;

-- Доп. опции (для будущей реализации):
-- +10 пользователей на объект: +10 000 руб/мес
-- +1 объект: +40 000 руб/мес
