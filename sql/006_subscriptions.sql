-- ============================================================================
-- DocStroy — Миграция 006: Подписки компаний
-- Дата: 2026-03-28
--
-- Подписки ограничивают функционал компании:
--   - количество проектов
--   - количество участников
--   - объём хранилища
--   - доступные модули (ГРО, рассылки, и т.д.)
-- ============================================================================

-- ============================
-- 1. ENUM: тарифный план
-- ============================

CREATE TYPE subscription_plan AS ENUM (
  'free',        -- бесплатный (ограниченный)
  'standard',    -- стандартный
  'pro',         -- расширенный
  'enterprise'   -- корпоративный (без ограничений)
);

-- ============================
-- 2. ТАБЛИЦА ПОДПИСОК
-- ============================

CREATE TABLE subscriptions (
  id                    uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid              NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan                  subscription_plan NOT NULL DEFAULT 'free',

  -- Лимиты
  max_projects          int4              NOT NULL DEFAULT 1,
  max_members           int4              NOT NULL DEFAULT 5,
  max_storage_gb        int4              NOT NULL DEFAULT 1,

  -- Доступные модули (расширяемый jsonb)
  -- Пример: {"gro": true, "fileshare": true, "support_chat": true, "requests": false}
  features              jsonb             NOT NULL DEFAULT '{}'::jsonb,

  -- Сроки
  started_at            timestamptz       NOT NULL DEFAULT now(),
  expires_at            timestamptz,       -- NULL = бессрочная
  is_active             boolean           NOT NULL DEFAULT true,

  created_at            timestamptz       DEFAULT now(),
  updated_at            timestamptz       DEFAULT now()
);

CREATE INDEX idx_subscriptions_company ON subscriptions (company_id);
CREATE INDEX idx_subscriptions_active  ON subscriptions (company_id, is_active)
  WHERE is_active = true;

-- Триггер updated_at
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================
-- 3. ДЕФОЛТЫ ПО ТАРИФАМ (справочная таблица)
-- ============================

CREATE TABLE subscription_plan_defaults (
  plan                  subscription_plan PRIMARY KEY,
  max_projects          int4              NOT NULL,
  max_members           int4              NOT NULL,
  max_storage_gb        int4              NOT NULL,
  features              jsonb             NOT NULL DEFAULT '{}'::jsonb,
  price_monthly_rub     numeric(10,2)     DEFAULT 0
);

INSERT INTO subscription_plan_defaults (plan, max_projects, max_members, max_storage_gb, features, price_monthly_rub) VALUES
  ('free',       1,   5,    1, '{"gro": false, "fileshare": false, "support_chat": true,  "requests": false}'::jsonb, 0),
  ('standard',   5,   25,   10, '{"gro": true,  "fileshare": true,  "support_chat": true,  "requests": true}'::jsonb,  4990),
  ('pro',        20,  100,  50, '{"gro": true,  "fileshare": true,  "support_chat": true,  "requests": true}'::jsonb,  14990),
  ('enterprise', 999, 9999, 999, '{"gro": true,  "fileshare": true,  "support_chat": true,  "requests": true}'::jsonb,  0);

-- ============================
-- 4. НАЗНАЧИТЬ ПОДПИСКУ «ООО "СУ-10"» — enterprise (бессрочно)
-- ============================

INSERT INTO subscriptions (company_id, plan, max_projects, max_members, max_storage_gb, features, expires_at)
SELECT
  id,
  'enterprise',
  999,
  9999,
  999,
  '{"gro": true, "fileshare": true, "support_chat": true, "requests": true}'::jsonb,
  NULL  -- бессрочно
FROM companies
WHERE name = 'ООО "СУ-10"';

-- ============================
-- 5. ФУНКЦИИ ПРОВЕРКИ ЛИМИТОВ
-- ============================

-- Проверить: можно ли создать ещё один проект в компании
CREATE OR REPLACE FUNCTION check_company_project_limit(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT (
    SELECT count(*) FROM projects WHERE company_id = p_company_id
  ) < (
    SELECT COALESCE(max_projects, 999)
    FROM subscriptions
    WHERE company_id = p_company_id AND is_active = true
    ORDER BY created_at DESC LIMIT 1
  );
$$;

-- Проверить: можно ли добавить ещё одного участника в компанию
CREATE OR REPLACE FUNCTION check_company_member_limit(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT (
    SELECT count(*) FROM company_members WHERE company_id = p_company_id
  ) < (
    SELECT COALESCE(max_members, 9999)
    FROM subscriptions
    WHERE company_id = p_company_id AND is_active = true
    ORDER BY created_at DESC LIMIT 1
  );
$$;

-- Получить активную подписку компании
CREATE OR REPLACE FUNCTION get_company_subscription(p_company_id uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT to_jsonb(s.*)
  FROM subscriptions s
  WHERE s.company_id = p_company_id
    AND s.is_active = true
    AND (s.expires_at IS NULL OR s.expires_at > now())
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;

-- Проверить доступность модуля для компании
CREATE OR REPLACE FUNCTION check_company_feature(p_company_id uuid, p_feature text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT (s.features ->> p_feature)::boolean
     FROM subscriptions s
     WHERE s.company_id = p_company_id
       AND s.is_active = true
       AND (s.expires_at IS NULL OR s.expires_at > now())
     ORDER BY s.created_at DESC
     LIMIT 1),
    false
  );
$$;
