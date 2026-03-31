-- 017: Добавляем колонки для управления видимостью вкладок сайдбара
-- Все по умолчанию TRUE, чтобы не сломать текущее поведение

ALTER TABLE portal_role_permissions
  ADD COLUMN IF NOT EXISTS can_view_installation BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_view_materials    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_view_registry     BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_view_gro          BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_view_fileshare    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_view_explorer     BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_view_construction BOOLEAN NOT NULL DEFAULT TRUE;

-- Также добавляем в user_permissions (если используется per-user override)
ALTER TABLE user_permissions
  ADD COLUMN IF NOT EXISTS can_view_installation BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_view_materials    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_view_registry     BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_view_gro          BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_view_fileshare    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_view_explorer     BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_view_construction BOOLEAN NOT NULL DEFAULT TRUE;
