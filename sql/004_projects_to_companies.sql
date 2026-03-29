-- ============================================================================
-- DocStroy — Миграция 004: Привязка проектов к компаниям
-- Дата: 2026-03-28
--
-- 1. Добавляет company_id в projects (владелец проекта)
-- 2. Создаёт project_companies — связь проекта с несколькими компаниями
--    (заказчик + подрядчик могут работать в одном проекте)
-- 3. Миграция существующих данных → компания «ООО "СУ-10"»
-- 4. Обновляет функцию создания проекта
-- ============================================================================

-- ============================
-- 1. ENUM: роль компании в проекте
-- ============================

CREATE TYPE project_company_role AS ENUM (
  'owner',          -- компания-владелец проекта
  'contractor',     -- подрядчик
  'general_contractor', -- генподрядчик
  'customer',       -- заказчик
  'supervisor'      -- строительный контроль / авторский надзор
);

-- ============================
-- 2. ALTER projects — добавить company_id
-- ============================

ALTER TABLE projects
  ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE RESTRICT;

-- ============================
-- 3. Миграция текущих данных
-- Создаём компанию для существующих проектов
-- ============================

-- Создать компанию «ООО "СУ-10"» (created_by = NULL, т.к. создаёт система)
INSERT INTO companies (id, name, inn)
VALUES (
  gen_random_uuid(),
  'ООО "СУ-10"',
  NULL
);

-- Привязать ВСЕ существующие проекты к этой компании
UPDATE projects
SET company_id = (SELECT id FROM companies WHERE name = 'ООО "СУ-10"' LIMIT 1)
WHERE company_id IS NULL;

-- Добавить created_by проектов как owner компании (если ещё не добавлен)
INSERT INTO company_members (company_id, user_id, role)
SELECT DISTINCT
  (SELECT id FROM companies WHERE name = 'ООО "СУ-10"' LIMIT 1),
  p.created_by,
  'member'
FROM projects p
WHERE p.created_by IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;

-- Теперь делаем company_id NOT NULL
ALTER TABLE projects
  ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX idx_projects_company ON projects (company_id);

-- Уникальность имени проекта внутри компании
ALTER TABLE projects
  ADD CONSTRAINT projects_company_name_unique UNIQUE (company_id, name);

-- ============================
-- 4. project_companies — связь проектов с несколькими компаниями
-- Один проект может принадлежать нескольким компаниям
-- (заказчик-подрядчик — две компании, один документооборот)
-- ============================

CREATE TABLE project_companies (
  id          uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid                 NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id  uuid                 NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role        project_company_role NOT NULL DEFAULT 'owner',
  joined_at   timestamptz          DEFAULT now(),

  UNIQUE (project_id, company_id)
);

CREATE INDEX idx_project_companies_project ON project_companies (project_id);
CREATE INDEX idx_project_companies_company ON project_companies (company_id);

-- Автоматически добавить компанию-владельца в project_companies
INSERT INTO project_companies (project_id, company_id, role)
SELECT id, company_id, 'owner'
FROM projects
ON CONFLICT (project_id, company_id) DO NOTHING;

-- ============================
-- 5. Обновить функцию создания проекта
-- Теперь требует company_id
-- ============================

CREATE OR REPLACE FUNCTION create_project_with_owner(
  p_user_id    uuid,
  p_project_id uuid,
  p_name       text,
  p_description text,
  p_company_id uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project_id uuid;
BEGIN
  -- Проверяем что пользователь — участник компании
  IF NOT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_company_id AND user_id = p_user_id
  ) AND NOT (SELECT is_portal_admin FROM users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User is not a member of this company';
  END IF;

  INSERT INTO projects (id, name, description, created_by, company_id)
  VALUES (p_project_id, p_name, p_description, p_user_id, p_company_id)
  RETURNING id INTO v_project_id;

  -- Добавить создателя как admin проекта
  INSERT INTO project_members (project_id, user_id, role, project_role)
  VALUES (v_project_id, p_user_id, 'admin', 'Администратор проекта');

  -- Добавить компанию-владельца в project_companies
  INSERT INTO project_companies (project_id, company_id, role)
  VALUES (v_project_id, p_company_id, 'owner');

  RETURN v_project_id;
END;
$$;

-- ============================
-- 6. Обновить get_user_project_ids — учитывать доступ через компанию
-- Пользователь видит проекты:
--   a) где он project_member
--   b) где его компания — участник проекта (project_companies)
-- ============================

CREATE OR REPLACE FUNCTION get_user_project_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE AS $$
  -- Прямое членство в проекте
  SELECT project_id FROM project_members WHERE user_id = p_user_id
  UNION
  -- Через компанию-участника проекта (если пользователь — admin/owner компании)
  SELECT pc.project_id
  FROM project_companies pc
  JOIN company_members cm ON cm.company_id = pc.company_id
  WHERE cm.user_id = p_user_id
    AND cm.role IN ('owner', 'admin');
$$;
