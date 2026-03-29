-- ============================================================================
-- DocStroy — Миграция 003: Компании и участники компаний
-- Дата: 2026-03-28
-- ============================================================================

-- ============================
-- 1. ENUM TYPES
-- ============================

CREATE TYPE company_role AS ENUM (
  'owner',        -- владелец компании (создатель)
  'admin',        -- администратор компании
  'member'        -- участник компании
);

-- ============================
-- 2. TABLES
-- ============================

-- -------------------------------------------------
-- companies — корневая сущность, объединяющая проекты
-- -------------------------------------------------
CREATE TABLE companies (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  inn         text,                         -- ИНН юрлица (опционально)
  logo_path   text,                         -- путь к логотипу в S3
  created_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),

  CONSTRAINT companies_name_unique UNIQUE (name)
);

CREATE INDEX idx_companies_created_by ON companies (created_by);

-- Триггер updated_at (используем существующий handle_updated_at)
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- -------------------------------------------------
-- company_members — участники компании
-- Пользователь может быть в нескольких компаниях.
-- Членство в компании НЕ равно членству в проекте —
-- это два независимых уровня доступа.
-- -------------------------------------------------
CREATE TABLE company_members (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        company_role NOT NULL DEFAULT 'member',
  joined_at   timestamptz  DEFAULT now(),

  UNIQUE (company_id, user_id)
);

CREATE INDEX idx_company_members_company ON company_members (company_id);
CREATE INDEX idx_company_members_user    ON company_members (user_id);

-- ============================
-- 3. HELPER FUNCTIONS
-- ============================

-- Проверка: является ли пользователь админом/владельцем компании
CREATE OR REPLACE FUNCTION is_company_admin(p_user_id uuid, p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_company_id
      AND user_id    = p_user_id
      AND role IN ('owner', 'admin')
  )
  OR (SELECT is_portal_admin FROM users WHERE id = p_user_id);
$$;

-- Получить все компании пользователя
CREATE OR REPLACE FUNCTION get_user_company_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE AS $$
  SELECT company_id FROM company_members WHERE user_id = p_user_id;
$$;

-- Автоматическое добавление создателя компании как owner
CREATE OR REPLACE FUNCTION on_company_created_add_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO company_members (company_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (company_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_company_add_owner
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION on_company_created_add_owner();
