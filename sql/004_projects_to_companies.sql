-- ============================================================================
-- DocStroy — Миграция 004: Привязка проектов к компаниям
-- Дата: 2026-03-28
-- ИДЕМПОТЕНТНАЯ: безопасно перезапускать после частичного выполнения
-- ============================================================================

-- ============================
-- 1. ENUM: роль компании в проекте
-- ============================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_company_role') THEN
    CREATE TYPE project_company_role AS ENUM (
      'owner',
      'contractor',
      'general_contractor',
      'customer',
      'supervisor'
    );
  END IF;
END;
$$;

-- ============================
-- 2. ALTER projects — добавить company_id (если ещё нет)
-- ============================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE projects
      ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

-- ============================
-- 3. Миграция текущих данных
-- ============================

-- Создать компанию «ООО "СУ-10"» (если ещё нет)
INSERT INTO companies (name, inn)
VALUES ('ООО "СУ-10"', NULL)
ON CONFLICT (name) DO NOTHING;

-- Привязать ВСЕ существующие проекты к этой компании
UPDATE projects
SET company_id = (SELECT id FROM companies WHERE name = 'ООО "СУ-10"' LIMIT 1)
WHERE company_id IS NULL;

-- Добавить created_by проектов как member компании
INSERT INTO company_members (company_id, user_id, role)
SELECT DISTINCT
  (SELECT id FROM companies WHERE name = 'ООО "СУ-10"' LIMIT 1),
  p.created_by,
  'member'::company_role
FROM projects p
WHERE p.created_by IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;

-- Теперь делаем company_id NOT NULL (если ещё nullable)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'company_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE projects ALTER COLUMN company_id SET NOT NULL;
  END IF;
END;
$$;

-- Индекс (если ещё нет)
CREATE INDEX IF NOT EXISTS idx_projects_company ON projects (company_id);

-- Уникальность имени проекта внутри компании (если ещё нет)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_company_name_unique'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_company_name_unique UNIQUE (company_id, name);
  END IF;
END;
$$;

-- ============================
-- 4. project_companies
-- ============================

CREATE TABLE IF NOT EXISTS project_companies (
  id          uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid                 NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id  uuid                 NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role        project_company_role NOT NULL DEFAULT 'owner',
  joined_at   timestamptz          DEFAULT now(),

  UNIQUE (project_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_project_companies_project ON project_companies (project_id);
CREATE INDEX IF NOT EXISTS idx_project_companies_company ON project_companies (company_id);

-- Автоматически добавить компанию-владельца в project_companies
INSERT INTO project_companies (project_id, company_id, role)
SELECT id, company_id, 'owner'::project_company_role
FROM projects
ON CONFLICT (project_id, company_id) DO NOTHING;

-- ============================
-- 5. Обновить функцию создания проекта
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
  VALUES (v_project_id, p_company_id, 'owner'::project_company_role);

  RETURN v_project_id;
END;
$$;

-- ============================
-- 6. Обновить get_user_project_ids
-- ============================

CREATE OR REPLACE FUNCTION get_user_project_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE AS $$
  SELECT project_id FROM project_members WHERE user_id = p_user_id
  UNION
  SELECT pc.project_id
  FROM project_companies pc
  JOIN company_members cm ON cm.company_id = pc.company_id
  WHERE cm.user_id = p_user_id
    AND cm.role IN ('owner', 'admin');
$$;
