-- ============================================================================
-- DocStroy — Схема БД для Yandex Managed PostgreSQL
-- Адаптация с Supabase: без RLS, без auth.users, без storage.buckets
-- Дата: 2026-03-28
-- ============================================================================

-- ============================
-- 1. EXTENSIONS
-- ============================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================
-- 2. ENUM TYPES
-- ============================

CREATE TYPE portal_group AS ENUM (
  'Геодезист',
  'Инженер ПТО',
  'Инженер',
  'Участник',
  'Руководитель',
  'Производитель работ'
);

CREATE TYPE portal_role AS ENUM (
  'Администратор',
  'Администратор проекта',
  'Подрядчик',
  'Генподрядчик',
  'Заказчик',
  'Строительный контроль',
  'Авторский надзор'
);

CREATE TYPE project_role_type AS ENUM (
  'Администратор проекта',
  'Комментатор проекта',
  'Читатель проекта',
  'Исполнитель проекта',
  'Проверяющий проекта',
  'Исполнитель и Проверяющий проекта',
  'Авторский надзор',
  'Производитель работ',
  'Администратор',
  'Без роли'
);

CREATE TYPE signature_status AS ENUM (
  'На согласовании',
  'Подписано',
  'Отклонено',
  'Подписано с замечанием',
  'Ознакомлен',
  'Согласовано'
);

-- ============================
-- 3. TABLES
-- ============================

-- -------------------------------------------------
-- users (бывший profiles + auth.users)
-- -------------------------------------------------
CREATE TABLE users (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                text        NOT NULL,
  password_hash        text        NOT NULL,
  last_name            text        NOT NULL,
  first_name           text        NOT NULL,
  middle_name          text,
  display_name         text        GENERATED ALWAYS AS (
    last_name || ' ' || first_name || COALESCE(' ' || middle_name, '')
  ) STORED,
  structure            text        NOT NULL DEFAULT 'Подрядчик',
  organization         text        NOT NULL DEFAULT '',
  position             text        NOT NULL DEFAULT 'Геодезист',
  phone                text,
  is_portal_admin      boolean     DEFAULT false,
  is_global_reader     boolean     DEFAULT false,
  must_change_password boolean     DEFAULT false,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),

  CONSTRAINT users_email_key         UNIQUE (email),
  CONSTRAINT users_structure_check   CHECK (structure IN ('Заказчик','Строительный контроль','Генподрядчик','Подрядчик')),
  CONSTRAINT users_position_check    CHECK (position IN ('Руководитель','Инженер ПТО','Геодезист','Строительный контроль'))
);

CREATE INDEX idx_users_email        ON users (email);
CREATE INDEX idx_users_phone        ON users (phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_users_display_name ON users USING gin (display_name gin_trgm_ops);

-- -------------------------------------------------
-- projects
-- -------------------------------------------------
CREATE TABLE projects (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  created_by  uuid        REFERENCES users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- -------------------------------------------------
-- project_organizations
-- -------------------------------------------------
CREATE TABLE project_organizations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order int4        DEFAULT 0,
  created_at timestamptz DEFAULT now(),

  UNIQUE (project_id, name)
);

-- -------------------------------------------------
-- project_members
-- -------------------------------------------------
CREATE TABLE project_members (
  id              uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid             NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            text             NOT NULL DEFAULT 'member',
  joined_at       timestamptz      DEFAULT now(),
  portal_role     portal_role,
  portal_group    portal_group,
  project_role    project_role_type,
  organization_id uuid             REFERENCES project_organizations(id) ON DELETE SET NULL,

  UNIQUE (project_id, user_id),
  CONSTRAINT project_members_role_check CHECK (role IN ('admin','member'))
);

CREATE INDEX idx_project_members_project_id    ON project_members (project_id);
CREATE INDEX idx_project_members_user_id       ON project_members (user_id);
CREATE INDEX idx_project_members_user_project  ON project_members (user_id, project_id);

-- -------------------------------------------------
-- project_statuses
-- -------------------------------------------------
CREATE TABLE project_statuses (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  color_key  text        NOT NULL DEFAULT 'blue',
  sort_order int4        DEFAULT 0,
  is_default boolean     DEFAULT false,
  created_at timestamptz DEFAULT now(),

  UNIQUE (project_id, name)
);

CREATE INDEX idx_project_statuses_project ON project_statuses (project_id);

-- -------------------------------------------------
-- status_role_assignments
-- -------------------------------------------------
CREATE TABLE status_role_assignments (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES project_statuses(id) ON DELETE CASCADE,
  role      text NOT NULL,

  UNIQUE (status_id, role)
);

CREATE INDEX idx_status_role_status ON status_role_assignments (status_id);

-- -------------------------------------------------
-- portal_role_permissions
-- -------------------------------------------------
CREATE TABLE portal_role_permissions (
  id                          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  role                        project_role_type NOT NULL,
  can_create_cells            boolean NOT NULL DEFAULT false,
  can_edit_cells              boolean NOT NULL DEFAULT false,
  can_delete_cells            boolean NOT NULL DEFAULT false,
  can_manage_users            boolean NOT NULL DEFAULT false,
  can_manage_dictionaries     boolean NOT NULL DEFAULT false,
  can_admin_project           boolean NOT NULL DEFAULT false,
  can_send_cells              boolean NOT NULL DEFAULT false,
  can_change_status           boolean NOT NULL DEFAULT false,
  can_sign                    boolean NOT NULL DEFAULT false,
  can_archive                 boolean NOT NULL DEFAULT false,
  can_comment                 boolean NOT NULL DEFAULT false,
  can_manage_statuses         boolean NOT NULL DEFAULT false,
  can_receive_cells           boolean NOT NULL DEFAULT false,
  can_remark                  boolean NOT NULL DEFAULT false,
  can_acknowledge             boolean NOT NULL DEFAULT false,
  can_supervise               boolean NOT NULL DEFAULT false,
  can_view_requests           boolean NOT NULL DEFAULT false,
  can_create_requests         boolean NOT NULL DEFAULT false,
  can_execute_requests        boolean NOT NULL DEFAULT false,
  can_create_gro              boolean NOT NULL DEFAULT false,
  can_edit_gro                boolean NOT NULL DEFAULT false,
  can_download_files          boolean NOT NULL DEFAULT true,
  can_view_overlays           boolean NOT NULL DEFAULT true,
  can_view_process            boolean NOT NULL DEFAULT true,
  can_print                   boolean NOT NULL DEFAULT true,
  can_view_tasks              boolean NOT NULL DEFAULT true,
  can_view_admin              boolean NOT NULL DEFAULT false,
  can_view_cell               boolean NOT NULL DEFAULT true,
  can_view_files_block        boolean NOT NULL DEFAULT true,
  can_view_remarks_block      boolean NOT NULL DEFAULT true,
  can_view_supervision_block  boolean NOT NULL DEFAULT true,
  can_view_scan_block         boolean NOT NULL DEFAULT true,
  can_view_process_block      boolean NOT NULL DEFAULT true,
  can_view_comments_block     boolean NOT NULL DEFAULT true,
  can_preview_files           boolean NOT NULL DEFAULT true,
  can_edit_cell               boolean NOT NULL DEFAULT false,
  can_delete_cell             boolean NOT NULL DEFAULT false,
  can_edit_mask               boolean NOT NULL DEFAULT false,
  can_add_update_files        boolean NOT NULL DEFAULT false,
  can_add_update_supervision  boolean NOT NULL DEFAULT false,
  can_add_update_scan         boolean NOT NULL DEFAULT false,
  can_add_comments            boolean NOT NULL DEFAULT false,
  can_delete_gro              boolean NOT NULL DEFAULT false,
  can_add_gro_files           boolean NOT NULL DEFAULT false,
  can_change_gro_status       boolean NOT NULL DEFAULT false,
  can_edit_requests           boolean NOT NULL DEFAULT false,
  can_add_request_files       boolean NOT NULL DEFAULT false,
  can_delete_requests         boolean NOT NULL DEFAULT false,
  can_change_request_status   boolean NOT NULL DEFAULT false,
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (role)
);

-- -------------------------------------------------
-- user_permissions
-- -------------------------------------------------
CREATE TABLE user_permissions (
  id                          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  uuid    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id                     uuid    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_create_cells            boolean,
  can_edit_cells              boolean,
  can_delete_cells            boolean,
  can_manage_users            boolean,
  can_manage_dictionaries     boolean,
  can_admin_project           boolean,
  can_send_cells              boolean,
  can_change_status           boolean,
  can_sign                    boolean,
  can_archive                 boolean,
  can_comment                 boolean,
  can_manage_statuses         boolean,
  can_receive_cells           boolean,
  can_remark                  boolean,
  can_acknowledge             boolean,
  can_supervise               boolean,
  can_create_gro              boolean,
  can_edit_gro                boolean,
  can_download_files          boolean NOT NULL DEFAULT true,
  can_view_overlays           boolean NOT NULL DEFAULT true,
  can_view_process            boolean NOT NULL DEFAULT true,
  can_print                   boolean NOT NULL DEFAULT true,
  can_view_tasks              boolean,
  can_view_admin              boolean,
  can_view_cell               boolean,
  can_view_files_block        boolean,
  can_view_remarks_block      boolean,
  can_view_supervision_block  boolean,
  can_view_scan_block         boolean,
  can_view_process_block      boolean,
  can_view_comments_block     boolean,
  can_preview_files           boolean,
  can_edit_cell               boolean,
  can_delete_cell             boolean,
  can_edit_mask               boolean,
  can_add_update_files        boolean,
  can_add_update_supervision  boolean,
  can_add_update_scan         boolean,
  can_add_comments            boolean,
  can_delete_gro              boolean,
  can_add_gro_files           boolean,
  can_change_gro_status       boolean,
  can_edit_requests           boolean,
  can_add_request_files       boolean,
  can_delete_requests         boolean,
  can_change_request_status   boolean,
  can_view_requests           boolean,
  can_create_requests         boolean,
  can_execute_requests        boolean,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (project_id, user_id)
);

CREATE INDEX idx_user_permissions_project_id   ON user_permissions (project_id);
CREATE INDEX idx_user_permissions_user_id      ON user_permissions (user_id);
CREATE INDEX idx_user_permissions_user_project ON user_permissions (user_id, project_id);

-- -------------------------------------------------
-- cell_action_permissions
-- -------------------------------------------------
CREATE TABLE cell_action_permissions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role_context         text        NOT NULL,
  status_name          text        NOT NULL,
  edit_info            boolean     NOT NULL DEFAULT false,
  edit_mask            boolean     NOT NULL DEFAULT false,
  edit_description     boolean     NOT NULL DEFAULT false,
  add_update_files     boolean     NOT NULL DEFAULT false,
  delete_files         boolean     NOT NULL DEFAULT false,
  sign_remark          boolean     NOT NULL DEFAULT false,
  supervise            boolean     NOT NULL DEFAULT false,
  attach_supervision   boolean     NOT NULL DEFAULT false,
  attach_scan_archive  boolean     NOT NULL DEFAULT false,
  delete_cell          boolean     NOT NULL DEFAULT false,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),

  UNIQUE (project_id, role_context, status_name)
);

CREATE INDEX idx_cap_project ON cell_action_permissions (project_id);

-- -------------------------------------------------
-- DICTIONARIES: base tables
-- -------------------------------------------------

CREATE TABLE dict_buildings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order int4        DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (project_id, name)
);
CREATE INDEX idx_dict_buildings_project ON dict_buildings (project_id);

CREATE TABLE dict_floors (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order int4        DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (project_id, name)
);
CREATE INDEX idx_dict_floors_project ON dict_floors (project_id);

CREATE TABLE dict_constructions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order int4        DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (project_id, name)
);
CREATE INDEX idx_dict_constructions_project ON dict_constructions (project_id);

CREATE TABLE dict_work_types (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order int4        DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (project_id, name)
);
CREATE INDEX idx_dict_work_types_project ON dict_work_types (project_id);

CREATE TABLE dict_work_stages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order int4        DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE TABLE dict_sets (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order int4        DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (project_id, name)
);
CREATE INDEX idx_dict_sets_project ON dict_sets (project_id);

CREATE TABLE dict_overlays (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  file_name    text        NOT NULL,
  storage_path text        NOT NULL,
  width        int4,
  height       int4,
  sort_order   int4        DEFAULT 0,
  tab_type     text,
  created_at   timestamptz DEFAULT now(),

  UNIQUE (project_id, name),
  CONSTRAINT dict_overlays_tab_type_check CHECK (tab_type IS NULL OR tab_type = ANY(ARRAY['plan','facades','landscaping']))
);
CREATE INDEX idx_overlays_project ON dict_overlays (project_id);

CREATE TABLE dict_works (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order int4        NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dict_works_project ON dict_works (project_id);

-- -------------------------------------------------
-- cells
-- -------------------------------------------------
CREATE TABLE cells (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name               text        NOT NULL,
  work_stage_id      uuid        REFERENCES dict_work_stages(id) ON DELETE SET NULL,
  building_id        uuid        REFERENCES dict_buildings(id) ON DELETE SET NULL,
  floor_id           uuid        REFERENCES dict_floors(id) ON DELETE SET NULL,
  work_type_id       uuid        REFERENCES dict_work_types(id) ON DELETE SET NULL,
  construction_id    uuid        REFERENCES dict_constructions(id) ON DELETE SET NULL,
  set_id             uuid        REFERENCES dict_sets(id) ON DELETE SET NULL,
  work_id            uuid        REFERENCES dict_works(id) ON DELETE SET NULL,
  status             text        NOT NULL DEFAULT 'Новый',
  cell_type          text        NOT NULL DEFAULT 'registry',
  request_work_type  text,
  created_by         uuid        REFERENCES users(id),
  assigned_to        uuid        REFERENCES users(id),
  assigned_by        uuid        REFERENCES users(id),
  original_sender_id uuid        REFERENCES users(id),
  description        text,
  is_final_signed    boolean     DEFAULT false,
  tag                text,
  manual_tag         text,
  send_type          text,
  progress_percent   int4,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),

  CONSTRAINT cells_progress_check CHECK (progress_percent >= 0 AND progress_percent <= 100)
);

CREATE INDEX idx_cells_project_id                       ON cells (project_id);
CREATE INDEX idx_cells_status                           ON cells (status);
CREATE INDEX idx_cells_assigned_to                      ON cells (assigned_to);
CREATE INDEX idx_cells_assigned_by                      ON cells (assigned_by);
CREATE INDEX idx_cells_building_id                      ON cells (building_id);
CREATE INDEX idx_cells_floor_id                         ON cells (floor_id);
CREATE INDEX idx_cells_work_type_id                     ON cells (work_type_id);
CREATE INDEX idx_cells_construction_id                  ON cells (construction_id);
CREATE INDEX idx_cells_set_id                           ON cells (set_id);
CREATE INDEX idx_cells_project_status                   ON cells (project_id, status);
CREATE INDEX idx_cells_project_assigned                 ON cells (project_id, assigned_to);
CREATE INDEX idx_cells_project_type_assigned_status     ON cells (project_id, cell_type, assigned_to, status);

-- -------------------------------------------------
-- DICTIONARY JUNCTION TABLES
-- -------------------------------------------------

CREATE TABLE dict_building_work_types (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id  uuid NOT NULL REFERENCES dict_buildings(id) ON DELETE CASCADE,
  work_type_id uuid NOT NULL REFERENCES dict_work_types(id) ON DELETE CASCADE,
  UNIQUE (building_id, work_type_id)
);
CREATE INDEX idx_bwt_building  ON dict_building_work_types (building_id);
CREATE INDEX idx_bwt_work_type ON dict_building_work_types (work_type_id);

CREATE TABLE dict_work_stage_buildings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_stage_id uuid NOT NULL REFERENCES dict_work_stages(id) ON DELETE CASCADE,
  building_id   uuid NOT NULL REFERENCES dict_buildings(id) ON DELETE CASCADE,
  UNIQUE (work_stage_id, building_id)
);
CREATE INDEX idx_wsb_work_stage ON dict_work_stage_buildings (work_stage_id);
CREATE INDEX idx_wsb_building   ON dict_work_stage_buildings (building_id);

CREATE TABLE dict_work_stage_work_types (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_stage_id uuid NOT NULL REFERENCES dict_work_stages(id) ON DELETE CASCADE,
  work_type_id  uuid NOT NULL REFERENCES dict_work_types(id) ON DELETE CASCADE,
  UNIQUE (work_stage_id, work_type_id)
);
CREATE INDEX idx_wswt_work_stage ON dict_work_stage_work_types (work_stage_id);
CREATE INDEX idx_wswt_work_type  ON dict_work_stage_work_types (work_type_id);

CREATE TABLE dict_work_type_constructions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_type_id    uuid NOT NULL REFERENCES dict_work_types(id) ON DELETE CASCADE,
  construction_id uuid NOT NULL REFERENCES dict_constructions(id) ON DELETE CASCADE,
  UNIQUE (work_type_id, construction_id)
);
CREATE INDEX idx_wtc_work_type    ON dict_work_type_constructions (work_type_id);
CREATE INDEX idx_wtc_construction ON dict_work_type_constructions (construction_id);

CREATE TABLE dict_work_type_floors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_type_id uuid NOT NULL REFERENCES dict_work_types(id) ON DELETE CASCADE,
  floor_id     uuid NOT NULL REFERENCES dict_floors(id) ON DELETE CASCADE,
  UNIQUE (work_type_id, floor_id)
);
CREATE INDEX idx_wtf_work_type ON dict_work_type_floors (work_type_id);
CREATE INDEX idx_wtf_floor     ON dict_work_type_floors (floor_id);

CREATE TABLE dict_work_type_overlays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_type_id uuid NOT NULL REFERENCES dict_work_types(id) ON DELETE CASCADE,
  overlay_id   uuid NOT NULL REFERENCES dict_overlays(id) ON DELETE CASCADE,
  UNIQUE (work_type_id, overlay_id)
);
CREATE INDEX idx_wto_work_type ON dict_work_type_overlays (work_type_id);
CREATE INDEX idx_wto_overlay   ON dict_work_type_overlays (overlay_id);

CREATE TABLE dict_work_type_sets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_type_id uuid NOT NULL REFERENCES dict_work_types(id) ON DELETE CASCADE,
  set_id       uuid NOT NULL REFERENCES dict_sets(id) ON DELETE CASCADE,
  UNIQUE (work_type_id, set_id)
);

CREATE TABLE dict_overlay_buildings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_id  uuid NOT NULL REFERENCES dict_overlays(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES dict_buildings(id) ON DELETE CASCADE,
  UNIQUE (overlay_id, building_id)
);
CREATE INDEX idx_ob_overlay  ON dict_overlay_buildings (overlay_id);
CREATE INDEX idx_ob_building ON dict_overlay_buildings (building_id);

CREATE TABLE dict_overlay_constructions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_id      uuid NOT NULL REFERENCES dict_overlays(id) ON DELETE CASCADE,
  construction_id uuid NOT NULL REFERENCES dict_constructions(id) ON DELETE CASCADE,
  UNIQUE (overlay_id, construction_id)
);
CREATE INDEX idx_oc_overlay      ON dict_overlay_constructions (overlay_id);
CREATE INDEX idx_oc_construction ON dict_overlay_constructions (construction_id);

CREATE TABLE dict_overlay_floors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_id uuid NOT NULL REFERENCES dict_overlays(id) ON DELETE CASCADE,
  floor_id   uuid NOT NULL REFERENCES dict_floors(id) ON DELETE CASCADE,
  UNIQUE (overlay_id, floor_id)
);
CREATE INDEX idx_of_overlay ON dict_overlay_floors (overlay_id);
CREATE INDEX idx_of_floor   ON dict_overlay_floors (floor_id);

CREATE TABLE dict_overlay_works (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_id uuid NOT NULL REFERENCES dict_overlays(id) ON DELETE CASCADE,
  work_id    uuid NOT NULL REFERENCES dict_works(id) ON DELETE CASCADE,
  UNIQUE (overlay_id, work_id)
);

CREATE TABLE dict_building_floors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES dict_buildings(id) ON DELETE CASCADE,
  floor_id    uuid NOT NULL REFERENCES dict_floors(id) ON DELETE CASCADE,
  UNIQUE (building_id, floor_id)
);
CREATE INDEX idx_dbf_building ON dict_building_floors (building_id);
CREATE INDEX idx_dbf_floor    ON dict_building_floors (floor_id);

CREATE TABLE dict_building_work_type_floors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id   uuid NOT NULL REFERENCES dict_buildings(id) ON DELETE CASCADE,
  work_type_id  uuid NOT NULL REFERENCES dict_work_types(id) ON DELETE CASCADE,
  floor_id      uuid NOT NULL REFERENCES dict_floors(id) ON DELETE CASCADE,
  UNIQUE (building_id, work_type_id, floor_id)
);
CREATE INDEX idx_dbwtf_building  ON dict_building_work_type_floors (building_id);
CREATE INDEX idx_dbwtf_work_type ON dict_building_work_type_floors (work_type_id);
CREATE INDEX idx_dbwtf_bwt       ON dict_building_work_type_floors (building_id, work_type_id);

-- -------------------------------------------------
-- AXIS GRIDS
-- -------------------------------------------------

CREATE TABLE dict_axis_grids (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order int4        NOT NULL DEFAULT 0,
  axis_order text        NOT NULL DEFAULT 'vh',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_axis_grids_project ON dict_axis_grids (project_id);

CREATE TABLE dict_axis_grid_axes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_id    uuid        NOT NULL REFERENCES dict_axis_grids(id) ON DELETE CASCADE,
  direction  text        NOT NULL,
  name       text        NOT NULL,
  sort_order int4        NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT axis_grid_axes_direction_check CHECK (direction IN ('vertical','horizontal'))
);
CREATE INDEX idx_axis_grid_axes_grid ON dict_axis_grid_axes (grid_id);

CREATE TABLE dict_overlay_axis_grids (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_id uuid        NOT NULL REFERENCES dict_overlays(id) ON DELETE CASCADE,
  grid_id    uuid        NOT NULL REFERENCES dict_axis_grids(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (overlay_id, grid_id)
);

CREATE TABLE overlay_axis_points (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_grid_id uuid    NOT NULL REFERENCES dict_overlay_axis_grids(id) ON DELETE CASCADE,
  axis_id         uuid    NOT NULL REFERENCES dict_axis_grid_axes(id) ON DELETE CASCADE,
  point1_x        float8  NOT NULL,
  point1_y        float8  NOT NULL,
  point2_x        float8  NOT NULL,
  point2_y        float8  NOT NULL,
  project_id      uuid    REFERENCES projects(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (overlay_grid_id, axis_id)
);
CREATE INDEX idx_axis_points_project ON overlay_axis_points (project_id);

-- -------------------------------------------------
-- CELL-RELATED TABLES
-- -------------------------------------------------

CREATE TABLE cell_files (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id      uuid        NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
  file_name    text        NOT NULL,
  file_size    int8        NOT NULL DEFAULT 0,
  mime_type    text,
  storage_path text        NOT NULL,
  uploaded_by  uuid        NOT NULL REFERENCES users(id),
  category     text        NOT NULL DEFAULT 'general',
  uploaded_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_cell_files_cell_id ON cell_files (cell_id);
CREATE UNIQUE INDEX cell_files_supervision_unique ON cell_files (cell_id) WHERE category = 'supervision_approval';

CREATE TABLE cell_file_versions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id        uuid        NOT NULL REFERENCES cell_files(id) ON DELETE CASCADE,
  version_number int4        NOT NULL DEFAULT 1,
  file_name      text        NOT NULL,
  file_size      int8,
  mime_type      text,
  storage_path   text        NOT NULL,
  uploaded_by    uuid        NOT NULL REFERENCES users(id),
  notes          text,
  uploaded_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (file_id, version_number)
);
CREATE INDEX idx_cell_file_versions_file ON cell_file_versions (file_id);

CREATE TABLE cell_comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id    uuid        NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id),
  text       text,
  file_name  text,
  file_path  text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cell_comments_cell ON cell_comments (cell_id);

CREATE TABLE cell_comment_files (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id   uuid        NOT NULL REFERENCES cell_comments(id) ON DELETE CASCADE,
  file_name    text        NOT NULL,
  file_size    int8        NOT NULL DEFAULT 0,
  mime_type    text        NOT NULL DEFAULT 'application/octet-stream',
  storage_path text        NOT NULL,
  uploaded_by  uuid        NOT NULL REFERENCES users(id),
  uploaded_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_cell_comment_files_comment ON cell_comment_files (comment_id);

CREATE TABLE cell_public_comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id    uuid        NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id),
  text       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cell_public_comments_cell ON cell_public_comments (cell_id);

CREATE TABLE cell_history (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id    uuid        NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id),
  action     text        NOT NULL,
  details    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cell_history_cell         ON cell_history (cell_id);
CREATE INDEX idx_cell_history_action       ON cell_history (action);
CREATE INDEX idx_cell_history_created      ON cell_history (created_at);
CREATE INDEX idx_cell_history_cell_created ON cell_history (cell_id, created_at DESC);

CREATE TABLE cell_shares (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id      uuid        NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
  from_user_id uuid        NOT NULL REFERENCES users(id),
  to_user_id   uuid        NOT NULL REFERENCES users(id),
  message      text,
  share_type   text,
  is_read      boolean     DEFAULT false,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX idx_cell_shares_cell_id      ON cell_shares (cell_id);
CREATE INDEX idx_cell_shares_from_user    ON cell_shares (from_user_id);
CREATE INDEX idx_cell_shares_to_user      ON cell_shares (to_user_id);
CREATE INDEX idx_cell_shares_acknowledge  ON cell_shares (to_user_id, share_type) WHERE share_type = 'acknowledge';

CREATE TABLE cell_signatures (
  id         uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id    uuid             NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
  user_id    uuid             NOT NULL REFERENCES users(id),
  status     signature_status NOT NULL DEFAULT 'На согласовании',
  comment    text,
  signed_at  timestamptz,
  created_at timestamptz      NOT NULL DEFAULT now()
);
CREATE INDEX idx_cell_signatures_cell        ON cell_signatures (cell_id);
CREATE INDEX idx_cell_signatures_user        ON cell_signatures (user_id);
CREATE INDEX idx_cell_signatures_user_status ON cell_signatures (user_id, status);

CREATE TABLE cell_archives (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id    uuid        NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (cell_id, user_id)
);
CREATE INDEX idx_cell_archives_user ON cell_archives (user_id);

CREATE TABLE cell_overlay_masks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_id         uuid        NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
  overlay_id      uuid        NOT NULL REFERENCES dict_overlays(id) ON DELETE CASCADE,
  polygon_points  jsonb       NOT NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX idx_com_cell    ON cell_overlay_masks (cell_id);
CREATE INDEX idx_com_overlay ON cell_overlay_masks (overlay_id);

-- -------------------------------------------------
-- GRO TABLES
-- -------------------------------------------------

CREATE TABLE gro_cells (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  building_id uuid        REFERENCES dict_buildings(id) ON DELETE SET NULL,
  floor_id    uuid        REFERENCES dict_floors(id) ON DELETE SET NULL,
  description text,
  created_by  uuid        REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_gro_cells_project  ON gro_cells (project_id);
CREATE INDEX idx_gro_cells_building ON gro_cells (building_id);
CREATE INDEX idx_gro_cells_floor    ON gro_cells (floor_id);

CREATE TABLE gro_cell_files (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gro_cell_id  uuid        NOT NULL REFERENCES gro_cells(id) ON DELETE CASCADE,
  file_name    text        NOT NULL,
  file_size    int8        NOT NULL DEFAULT 0,
  mime_type    text        NOT NULL DEFAULT 'application/octet-stream',
  storage_path text        NOT NULL,
  uploaded_by  uuid        NOT NULL REFERENCES users(id),
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_gro_cell_files_cell ON gro_cell_files (gro_cell_id);

CREATE TABLE gro_cell_file_versions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id        uuid        NOT NULL REFERENCES gro_cell_files(id) ON DELETE CASCADE,
  version_number int4        NOT NULL DEFAULT 1,
  file_name      text        NOT NULL,
  file_size      int8        NOT NULL DEFAULT 0,
  mime_type      text        NOT NULL DEFAULT 'application/octet-stream',
  storage_path   text        NOT NULL,
  uploaded_by    uuid        NOT NULL REFERENCES users(id),
  notes          text,
  uploaded_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_gro_file_versions_file ON gro_cell_file_versions (file_id);

-- -------------------------------------------------
-- SUPPORT TABLES
-- -------------------------------------------------

CREATE TABLE support_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id  uuid        NOT NULL REFERENCES users(id),
  text       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_messages_project         ON support_messages (project_id, created_at);
CREATE INDEX idx_support_messages_project_created ON support_messages (project_id, created_at DESC);

CREATE TABLE support_message_files (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   uuid        NOT NULL REFERENCES support_messages(id) ON DELETE CASCADE,
  file_name    text        NOT NULL,
  file_size    int8        NOT NULL DEFAULT 0,
  mime_type    text        NOT NULL DEFAULT 'application/octet-stream',
  storage_path text        NOT NULL,
  uploaded_by  uuid        NOT NULL REFERENCES users(id),
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_message_files_msg ON support_message_files (message_id);

CREATE TABLE support_blocked_users (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id),
  blocked_by uuid        NOT NULL REFERENCES users(id),
  blocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX idx_support_blocked_project ON support_blocked_users (project_id);

CREATE TABLE support_read_status (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES users(id),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX idx_support_read_status_user         ON support_read_status (user_id);
CREATE INDEX idx_support_read_status_project_user ON support_read_status (project_id, user_id);

-- -------------------------------------------------
-- FILE SHARES
-- -------------------------------------------------

CREATE TABLE file_shares (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by      uuid        NOT NULL REFERENCES users(id),
  comment         text,
  status          text        NOT NULL DEFAULT 'draft',
  building_id     uuid        REFERENCES dict_buildings(id) ON DELETE SET NULL,
  floor_id        uuid        REFERENCES dict_floors(id) ON DELETE SET NULL,
  work_type_id    uuid        REFERENCES dict_work_types(id) ON DELETE SET NULL,
  construction_id uuid        REFERENCES dict_constructions(id) ON DELETE SET NULL,
  work_id         uuid        REFERENCES dict_works(id) ON DELETE SET NULL,
  tag             text,
  manual_tag      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  trashed_at      timestamptz,

  CONSTRAINT file_shares_status_check CHECK (status IN ('draft','sent','trashed'))
);
CREATE INDEX idx_file_shares_project     ON file_shares (project_id);
CREATE INDEX idx_file_shares_created_by  ON file_shares (created_by);
CREATE INDEX idx_fs_building             ON file_shares (building_id);
CREATE INDEX idx_fs_work_type            ON file_shares (work_type_id);
CREATE INDEX idx_fs_floor                ON file_shares (floor_id);
CREATE INDEX idx_fs_construction         ON file_shares (construction_id);
CREATE INDEX idx_fs_work                 ON file_shares (work_id);

CREATE TABLE file_share_recipients (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id   uuid    NOT NULL REFERENCES file_shares(id) ON DELETE CASCADE,
  user_id    uuid    NOT NULL REFERENCES users(id),
  is_read    boolean NOT NULL DEFAULT false,
  trashed_at timestamptz,
  UNIQUE (share_id, user_id)
);
CREATE INDEX idx_file_share_recipients_user  ON file_share_recipients (user_id);
CREATE INDEX idx_file_share_recipients_share ON file_share_recipients (share_id);

CREATE TABLE file_share_files (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id     uuid        NOT NULL REFERENCES file_shares(id) ON DELETE CASCADE,
  file_name    text        NOT NULL,
  file_size    bigint      NOT NULL,
  mime_type    text        NOT NULL DEFAULT 'application/octet-stream',
  storage_path text        NOT NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_file_share_files_share ON file_share_files (share_id);

CREATE TABLE file_share_overlay_masks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id        uuid        NOT NULL REFERENCES file_shares(id) ON DELETE CASCADE,
  overlay_id      uuid        NOT NULL REFERENCES dict_overlays(id) ON DELETE CASCADE,
  polygon_points  jsonb       NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fsom_share   ON file_share_overlay_masks (share_id);
CREATE INDEX idx_fsom_overlay ON file_share_overlay_masks (overlay_id);

-- -------------------------------------------------
-- PUSH SUBSCRIPTIONS
-- -------------------------------------------------

CREATE TABLE push_subscriptions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL,
  p256dh     text        NOT NULL,
  auth_key   text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX idx_push_sub_user ON push_subscriptions (user_id);

-- -------------------------------------------------
-- NOTIFICATIONS
-- -------------------------------------------------

CREATE TABLE notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text        NOT NULL,
  body       text        NOT NULL,
  url        text        NOT NULL DEFAULT '/',
  is_read    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user        ON notifications (user_id);
CREATE INDEX idx_notif_user_unread ON notifications (user_id, is_read) WHERE NOT is_read;
CREATE INDEX idx_notif_created     ON notifications (created_at DESC);

-- -------------------------------------------------
-- REFRESH TOKENS
-- -------------------------------------------------

CREATE TABLE refresh_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text        NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens (token_hash);


-- ============================
-- 4. FUNCTIONS
-- ============================

-- -------------------------------------------------
-- Утилиты: updated_at
-- -------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -------------------------------------------------
-- Auth helpers (адаптированы: p_user_id вместо auth.uid())
-- -------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_portal_admin(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT is_portal_admin FROM public.users WHERE id = p_user_id),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_global_reader(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT is_global_reader FROM public.users WHERE id = p_user_id),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_project_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE AS $$
  SELECT project_id FROM public.project_members WHERE user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_user_project_role(p_user_id uuid, p_project_id uuid)
RETURNS project_role_type LANGUAGE sql STABLE AS $$
  SELECT project_role FROM public.project_members
  WHERE project_id = p_project_id AND user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_teammate_user_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE AS $$
  SELECT DISTINCT pm.user_id
  FROM public.project_members pm
  WHERE pm.project_id IN (
    SELECT project_id FROM public.project_members WHERE user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_admin_of(p_user_id uuid, p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND project_role = 'Администратор проекта'
  );
$$;

-- -------------------------------------------------
-- get_role_default
-- -------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_role_default(p_role project_role_type, p_permission text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $function$
BEGIN
  IF p_role IS NULL THEN
    RETURN p_permission IN (
      'can_view_tasks', 'can_view_cell', 'can_view_files_block',
      'can_view_remarks_block', 'can_view_supervision_block', 'can_view_scan_block',
      'can_view_process_block', 'can_view_comments_block',
      'can_preview_files', 'can_download_files', 'can_print'
    );
  END IF;

  IF p_permission IN (
    'can_view_tasks', 'can_view_cell', 'can_view_files_block',
    'can_view_remarks_block', 'can_view_supervision_block', 'can_view_scan_block',
    'can_view_process_block', 'can_view_comments_block',
    'can_preview_files', 'can_download_files', 'can_print'
  ) THEN
    RETURN true;
  END IF;

  CASE p_role
    WHEN 'Администратор' THEN
      RETURN true;
    WHEN 'Администратор проекта' THEN
      RETURN p_permission NOT IN ('can_change_status', 'can_change_gro_status', 'can_change_request_status');
    WHEN 'Исполнитель проекта' THEN
      RETURN p_permission IN (
        'can_create_cells', 'can_edit_cell', 'can_edit_mask',
        'can_add_update_files', 'can_add_update_supervision', 'can_add_update_scan',
        'can_add_comments', 'can_send_cells', 'can_archive',
        'can_create_gro', 'can_edit_gro', 'can_add_gro_files'
      );
    WHEN 'Проверяющий проекта' THEN
      RETURN p_permission IN ('can_sign', 'can_remark', 'can_acknowledge', 'can_add_comments');
    WHEN 'Исполнитель и Проверяющий проекта' THEN
      RETURN p_permission IN (
        'can_create_cells', 'can_edit_cell', 'can_edit_mask',
        'can_add_update_files', 'can_add_update_supervision', 'can_add_update_scan',
        'can_add_comments', 'can_send_cells', 'can_archive',
        'can_sign', 'can_remark', 'can_acknowledge',
        'can_create_gro', 'can_edit_gro', 'can_add_gro_files'
      );
    WHEN 'Комментатор проекта' THEN
      RETURN p_permission IN ('can_add_comments', 'can_acknowledge');
    WHEN 'Читатель проекта' THEN
      RETURN false;
    WHEN 'Авторский надзор' THEN
      RETURN p_permission IN ('can_supervise', 'can_add_update_supervision', 'can_add_comments');
    WHEN 'Производитель работ' THEN
      RETURN p_permission IN ('can_add_comments', 'can_acknowledge');
    ELSE
      RETURN false;
  END CASE;
END;
$function$;

-- -------------------------------------------------
-- has_permission (адаптирован: p_user_id вместо auth.uid())
-- -------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_project_id uuid, p_permission text)
RETURNS boolean LANGUAGE plpgsql STABLE AS $function$
DECLARE
  v_individual BOOLEAN;
  v_portal_perm BOOLEAN;
  v_role project_role_type;
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND is_portal_admin = true) THEN
    RETURN true;
  END IF;

  SELECT project_role INTO v_role
  FROM public.project_members
  WHERE project_id = p_project_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_role = 'Администратор' THEN
    RETURN true;
  END IF;

  IF v_role = 'Администратор проекта' THEN
    IF p_permission IN ('can_change_status', 'can_change_gro_status', 'can_change_request_status') THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  SELECT (to_jsonb(up) ->> p_permission)::boolean INTO v_individual
  FROM public.user_permissions up
  WHERE project_id = p_project_id AND user_id = p_user_id;

  IF v_individual IS NOT NULL THEN
    RETURN v_individual;
  END IF;

  IF v_role IS NOT NULL THEN
    SELECT (to_jsonb(prp) ->> p_permission)::boolean INTO v_portal_perm
    FROM public.portal_role_permissions prp
    WHERE role = v_role;

    IF v_portal_perm IS NOT NULL THEN
      RETURN v_portal_perm;
    END IF;
  END IF;

  RETURN public.get_role_default(v_role, p_permission);
END;
$function$;

-- -------------------------------------------------
-- Auth / User management
-- -------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.is_portal_admin = OLD.is_portal_admin;
  NEW.is_global_reader = OLD.is_global_reader;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.change_my_password(p_user_id uuid, new_password text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Не авторизован');
  END IF;
  IF length(new_password) < 6 THEN
    RETURN json_build_object('success', false, 'error', 'Пароль должен быть не менее 6 символов');
  END IF;

  UPDATE public.users
  SET password_hash = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_must_change_password(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.users SET must_change_password = false WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_password_reset(p_caller_id uuid, target_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  v_is_admin BOOLEAN;
  v_temp_password TEXT;
BEGIN
  SELECT is_portal_admin INTO v_is_admin FROM public.users WHERE id = p_caller_id;
  IF v_is_admin IS NOT TRUE THEN
    RETURN json_build_object('success', false, 'error', 'Только администратор портала может сбрасывать пароли');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = target_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Пользователь не найден');
  END IF;

  v_temp_password := left(gen_random_uuid()::text, 8);

  UPDATE public.users
  SET password_hash = crypt(v_temp_password, gen_salt('bf')),
      must_change_password = true,
      updated_at = now()
  WHERE id = target_user_id;

  RETURN json_build_object('success', true, 'temp_password', v_temp_password);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_user_completely(p_caller_id uuid, target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public' AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = p_caller_id AND is_portal_admin = true
  ) THEN
    RAISE EXCEPTION 'Only portal admins can delete users';
  END IF;

  -- CASCADE handles most deletions via FK, but nullify non-cascade refs
  UPDATE cells SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE cells SET assigned_to = NULL WHERE assigned_to = target_user_id;
  UPDATE cells SET assigned_by = NULL WHERE assigned_by = target_user_id;
  UPDATE cells SET original_sender_id = NULL WHERE original_sender_id = target_user_id;
  UPDATE gro_cells SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE projects SET created_by = NULL WHERE created_by = target_user_id;

  DELETE FROM users WHERE id = target_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_users_for_login(query text)
RETURNS TABLE(id uuid, display_name text) LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  RETURN QUERY
    SELECT u.id, u.display_name
    FROM public.users u
    WHERE LOWER(u.last_name) LIKE LOWER(query) || '%'
    ORDER BY u.last_name, u.first_name
    LIMIT 20;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_email_for_login(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE v_email TEXT;
BEGIN
  SELECT u.email INTO v_email FROM public.users u WHERE u.id = p_user_id;
  RETURN v_email;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_portal_admin_emails()
RETURNS TABLE(admin_email text, admin_name text) LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  RETURN QUERY
    SELECT u.email,
      u.last_name ||
        CASE WHEN u.first_name <> '' THEN ' ' || LEFT(u.first_name, 1) || '.' ELSE '' END ||
        CASE WHEN u.middle_name IS NOT NULL AND u.middle_name <> '' THEN LEFT(u.middle_name, 1) || '.' ELSE '' END
    FROM public.users u WHERE u.is_portal_admin = true;
END;
$function$;

-- -------------------------------------------------
-- Project management
-- -------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_project_with_owner(p_user_id uuid, p_project_id uuid, p_name text, p_description text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO public.projects (id, name, description, created_by)
  VALUES (p_project_id, p_name, p_description, p_user_id);

  INSERT INTO public.project_members (project_id, user_id, role, project_role)
  VALUES (p_project_id, p_user_id, 'admin', 'Администратор проекта');

  RETURN p_project_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_projects_for_registration()
RETURNS TABLE(id uuid, name text) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, name FROM public.projects ORDER BY name;
$$;

CREATE OR REPLACE FUNCTION public.get_project_organizations_for_reg(p_project_id uuid)
RETURNS TABLE(id uuid, name text) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, name FROM public.project_organizations
  WHERE project_id = p_project_id ORDER BY sort_order, name;
$$;

-- -------------------------------------------------
-- Project member triggers
-- -------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_portal_admin_member()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.user_id AND is_portal_admin = true) THEN
    IF NEW.project_role IS DISTINCT FROM OLD.project_role THEN
      RAISE EXCEPTION 'Нельзя изменить роль администратора портала';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_portal_admin_member_delete()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = OLD.user_id AND is_portal_admin = true) THEN
    RAISE EXCEPTION 'Нельзя удалить администратора портала из проекта';
  END IF;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_perms_on_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
BEGIN
  IF OLD.project_role IS DISTINCT FROM NEW.project_role THEN
    DELETE FROM user_permissions WHERE project_id = NEW.project_id AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- -------------------------------------------------
-- Seeding functions
-- -------------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_default_statuses(p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.project_statuses WHERE project_id = p_project_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.project_statuses (project_id, name, color_key, sort_order, is_default) VALUES
    (p_project_id, 'Новый',                  'light_gray',   0, true),
    (p_project_id, 'На проверке',            'yellow_muted', 1, true),
    (p_project_id, 'Замечания',              'light_red',    2, true),
    (p_project_id, 'Подписано',              'pistachio',    3, true),
    (p_project_id, 'Подписано с замечанием', 'orange',       4, true),
    (p_project_id, 'Окончательно утверждён', 'green',        5, true),
    (p_project_id, 'У авторского надзора',   'cyan',         6, true),
    (p_project_id, 'Согласовано',            'blue',         7, true),
    (p_project_id, 'На исправление',         'red',          8, true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.seed_default_dictionaries(p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  INSERT INTO public.project_organizations (project_id, name, sort_order) VALUES
    (p_project_id, 'СУ-10', 0), (p_project_id, 'СУ-90', 1);

  INSERT INTO public.dict_buildings (project_id, name, sort_order) VALUES
    (p_project_id, 'Строительная площадка', 0), (p_project_id, 'Котлован', 1),
    (p_project_id, 'Автостоянка', 2), (p_project_id, 'Корпус 1', 3),
    (p_project_id, 'Благоустройство', 4), (p_project_id, 'Другое', 5);

  INSERT INTO public.dict_work_types (project_id, name, sort_order) VALUES
    (p_project_id, 'Исходная поверхность', 0), (p_project_id, 'Ситуационный план', 1),
    (p_project_id, 'Бытовой городок', 2), (p_project_id, 'Дороги и площадки', 3),
    (p_project_id, 'Кран', 4), (p_project_id, 'Шпунт', 5),
    (p_project_id, 'Стена в грунте', 6), (p_project_id, 'Объем грунта', 7),
    (p_project_id, 'Грунтовое основание', 8), (p_project_id, 'Песчаное основание', 9),
    (p_project_id, 'Бетонная подготовка', 10), (p_project_id, 'Защитная стяжка', 11),
    (p_project_id, 'Монолит', 12), (p_project_id, 'Кладка', 13),
    (p_project_id, 'Полы', 14), (p_project_id, 'Фасад', 15);

  INSERT INTO public.dict_floors (project_id, name, sort_order) VALUES
    (p_project_id, '-3 этаж', 0), (p_project_id, '-2 этаж', 1),
    (p_project_id, '-1 этаж', 2), (p_project_id, '1 этаж', 3),
    (p_project_id, '2 этаж', 4), (p_project_id, 'тех. этаж', 5),
    (p_project_id, '3 этаж', 6), (p_project_id, '4 этаж', 7),
    (p_project_id, '5 этаж', 8), (p_project_id, '6 этаж', 9),
    (p_project_id, '7 этаж', 10), (p_project_id, '8 этаж', 11),
    (p_project_id, '9 этаж', 12), (p_project_id, '10 этаж', 13),
    (p_project_id, '11 этаж', 14), (p_project_id, '12 этаж', 15),
    (p_project_id, '13 этаж', 16), (p_project_id, '14 этаж', 17),
    (p_project_id, '15 этаж', 18), (p_project_id, 'кровля', 19),
    (p_project_id, 'вид А', 20), (p_project_id, 'вид Б', 21),
    (p_project_id, 'вид В', 22), (p_project_id, 'вид Г', 23);

  INSERT INTO public.dict_constructions (project_id, name, sort_order) VALUES
    (p_project_id, 'ФП', 0), (p_project_id, 'ВК', 1),
    (p_project_id, 'ПП', 2), (p_project_id, 'Кронштейны', 3),
    (p_project_id, 'Направляющие', 4), (p_project_id, 'Зона 1', 5),
    (p_project_id, 'Зона 2', 6);

  INSERT INTO public.dict_sets (project_id, name, sort_order) VALUES
    (p_project_id, 'АОСР', 0), (p_project_id, 'АООК', 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.seed_cell_action_permissions(p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
DECLARE
  v_status TEXT;
  v_role TEXT;
  v_statuses TEXT[];
  v_roles TEXT[] := ARRAY['Администратор проекта', '__cell_creator__', '__inbox_task__', '__others__'];
  v_editable TEXT[] := ARRAY['Новый', 'Замечания', 'Подписано с замечанием', 'На исправление'];
  v_is_edit BOOLEAN;
  v_is_final BOOLEAN;
BEGIN
  SELECT array_agg(name ORDER BY sort_order) INTO v_statuses
  FROM project_statuses WHERE project_id = p_project_id;

  IF v_statuses IS NULL THEN
    v_statuses := ARRAY['Новый', 'На проверке', 'Замечания', 'Подписано', 'Подписано с замечанием', 'Окончательно утверждён'];
  END IF;

  FOREACH v_status IN ARRAY v_statuses LOOP
    v_is_final := (v_status = 'Окончательно утверждён');
    v_is_edit := (v_status = ANY(v_editable));

    FOREACH v_role IN ARRAY v_roles LOOP
      IF EXISTS (SELECT 1 FROM cell_action_permissions WHERE project_id = p_project_id AND role_context = v_role AND status_name = v_status) THEN
        CONTINUE;
      END IF;

      IF v_role = 'Администратор проекта' THEN
        INSERT INTO cell_action_permissions (project_id, role_context, status_name,
          edit_info, edit_mask, edit_description, add_update_files, delete_files, delete_cell,
          sign_remark, supervise, attach_supervision, attach_scan_archive)
        VALUES (p_project_id, v_role, v_status,
          NOT v_is_final, NOT v_is_final, NOT v_is_final, NOT v_is_final, NOT v_is_final, NOT v_is_final,
          NOT v_is_final, NOT v_is_final, NOT v_is_final, NOT v_is_final);
      ELSIF v_role = '__cell_creator__' THEN
        INSERT INTO cell_action_permissions (project_id, role_context, status_name,
          edit_info, edit_mask, edit_description, add_update_files, delete_files, delete_cell,
          sign_remark, supervise, attach_supervision, attach_scan_archive)
        VALUES (p_project_id, v_role, v_status,
          v_is_edit AND NOT v_is_final, v_is_edit AND NOT v_is_final, NOT v_is_final,
          v_is_edit AND NOT v_is_final, v_is_edit AND NOT v_is_final, v_status = 'Новый',
          false, false, NOT v_is_final, NOT v_is_final);
      ELSIF v_role = '__inbox_task__' THEN
        INSERT INTO cell_action_permissions (project_id, role_context, status_name,
          edit_info, edit_mask, edit_description, add_update_files, delete_files, delete_cell,
          sign_remark, supervise, attach_supervision, attach_scan_archive)
        VALUES (p_project_id, v_role, v_status,
          false, false, false, false, false, false,
          NOT v_is_final, NOT v_is_final, NOT v_is_final, false);
      ELSIF v_role = '__others__' THEN
        INSERT INTO cell_action_permissions (project_id, role_context, status_name,
          edit_info, edit_mask, edit_description, add_update_files, delete_files, delete_cell,
          sign_remark, supervise, attach_supervision, attach_scan_archive)
        VALUES (p_project_id, v_role, v_status,
          false, false, false, false, false, false,
          false, false, false, false);
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_project_created_seed_statuses()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.seed_default_statuses(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_project_created_seed_dictionaries()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.seed_default_dictionaries(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_seed_cap_on_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  PERFORM seed_cell_action_permissions(NEW.project_id);
  RETURN NEW;
END;
$$;

-- -------------------------------------------------
-- Auth startup RPC
-- -------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_auth_startup_data(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN jsonb_build_object(
    'profile', (
      SELECT jsonb_build_object(
        'is_portal_admin',      is_portal_admin,
        'is_global_reader',     is_global_reader,
        'must_change_password', must_change_password,
        'last_name',            last_name,
        'first_name',           first_name,
        'middle_name',          middle_name
      ) FROM public.users WHERE id = p_user_id
    ),
    'portal_role_permissions', (
      SELECT COALESCE(jsonb_agg(to_jsonb(prp)), '[]'::jsonb)
      FROM public.portal_role_permissions prp
    ),
    'memberships', (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object(
          'project_id',          pm.project_id,
          'project_role',        pm.project_role,
          'role',                pm.role,
          'project_name',        p.name,
          'project_description', p.description
        )), '[]'::jsonb
      )
      FROM public.project_members pm
      JOIN public.projects p ON p.id = pm.project_id
      WHERE pm.user_id = p_user_id
    )
  );
END;
$$;

-- -------------------------------------------------
-- File share helpers
-- -------------------------------------------------

CREATE OR REPLACE FUNCTION public.fileshare_auto_cleanup()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE file_shares
  SET status = 'trashed', trashed_at = now()
  WHERE status IN ('sent', 'draft')
    AND created_at < now() - interval '14 days'
    AND trashed_at IS NULL;

  UPDATE file_share_recipients r
  SET trashed_at = now()
  FROM file_shares s
  WHERE r.share_id = s.id AND s.status = 'trashed' AND r.trashed_at IS NULL;

  DELETE FROM file_shares
  WHERE status = 'trashed' AND trashed_at < now() - interval '7 days';
END;
$$;

-- -------------------------------------------------
-- Notifications helpers
-- -------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid, p_title text, p_body text, p_url text DEFAULT '/'
) RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, title, body, url)
  VALUES (p_user_id, p_title, p_body, p_url);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications WHERE is_read = true AND created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------
-- Notification trigger functions (без push, только INSERT INTO notifications)
-- -------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_notify_cell_share()
RETURNS trigger AS $$
DECLARE
  v_cell_name text; v_sender_name text; v_action text; v_project_id uuid; v_body text;
BEGIN
  SELECT c.name, c.project_id INTO v_cell_name, v_project_id
  FROM cells c WHERE c.id = NEW.cell_id;

  SELECT coalesce(u.last_name || ' ' || left(u.first_name, 1) || '.', 'Пользователь')
  INTO v_sender_name FROM users u WHERE u.id = NEW.from_user_id;

  v_action := CASE NEW.share_type
    WHEN 'review' THEN 'на проверку' WHEN 'acknowledge' THEN 'на ознакомление'
    WHEN 'supervision' THEN 'на контроль' ELSE 'задачу' END;

  v_body := v_sender_name || ' отправил(а) ' || v_action || ': ' || coalesce(v_cell_name, 'Без названия');

  PERFORM create_notification(NEW.to_user_id, 'Новая задача', v_body, '/projects/' || v_project_id || '/tasks');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_notify_cell_signature()
RETURNS trigger AS $$
DECLARE
  v_cell_name text; v_signer_name text; v_creator_id uuid; v_project_id uuid;
  v_status_text text; v_body text;
BEGIN
  SELECT c.name, c.created_by, c.project_id INTO v_cell_name, v_creator_id, v_project_id
  FROM cells c WHERE c.id = NEW.cell_id;

  IF v_creator_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT coalesce(u.last_name || ' ' || left(u.first_name, 1) || '.', 'Пользователь')
  INTO v_signer_name FROM users u WHERE u.id = NEW.user_id;

  v_status_text := CASE NEW.status
    WHEN 'Подписано' THEN 'подписал(а)' WHEN 'Отклонено' THEN 'отклонил(а)'
    WHEN 'Подписано с замечанием' THEN 'подписал(а) с замечанием'
    WHEN 'Ознакомлен' THEN 'ознакомился(-ась)' WHEN 'Согласовано' THEN 'согласовал(а)'
    ELSE 'обработал(а)' END;

  v_body := v_signer_name || ' ' || v_status_text;

  PERFORM create_notification(v_creator_id, coalesce(v_cell_name, 'Ячейка'), v_body, '/projects/' || v_project_id || '/tasks');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_notify_file_share()
RETURNS trigger AS $$
DECLARE
  v_sender_name text; v_comment text; v_project_id uuid; v_share_status text; v_body text;
BEGIN
  SELECT fs.comment, fs.project_id, fs.status,
    coalesce(u.last_name || ' ' || left(u.first_name, 1) || '.', 'Пользователь')
  INTO v_comment, v_project_id, v_share_status, v_sender_name
  FROM file_shares fs JOIN users u ON u.id = fs.created_by
  WHERE fs.id = NEW.share_id;

  IF v_share_status != 'sent' THEN RETURN NEW; END IF;

  v_body := v_sender_name || ' отправил(а) файл' ||
    CASE WHEN v_comment IS NOT NULL AND v_comment != '' THEN ': ' || left(v_comment, 80) ELSE '' END;

  PERFORM create_notification(NEW.user_id, 'Новый файл', v_body, '/projects/' || v_project_id || '/fileshare');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_notify_cell_comment()
RETURNS trigger AS $$
DECLARE
  v_cell_name text; v_creator_id uuid; v_assigned_to uuid; v_project_id uuid;
  v_commenter_name text; v_body text;
BEGIN
  SELECT c.name, c.created_by, c.assigned_to, c.project_id
  INTO v_cell_name, v_creator_id, v_assigned_to, v_project_id
  FROM cells c WHERE c.id = NEW.cell_id;

  SELECT coalesce(u.last_name || ' ' || left(u.first_name, 1) || '.', 'Пользователь')
  INTO v_commenter_name FROM users u WHERE u.id = NEW.user_id;

  v_body := v_commenter_name || ' к «' || coalesce(left(v_cell_name, 40), 'ячейке') || '»: ' || left(NEW.text, 60);

  IF v_creator_id IS NOT NULL AND v_creator_id != NEW.user_id THEN
    PERFORM create_notification(v_creator_id, 'Комментарий', v_body, '/projects/' || v_project_id || '/tasks');
  END IF;

  IF v_assigned_to IS NOT NULL AND v_assigned_to != NEW.user_id AND v_assigned_to != v_creator_id THEN
    PERFORM create_notification(v_assigned_to, 'Комментарий', v_body, '/projects/' || v_project_id || '/tasks');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_notify_request_event()
RETURNS trigger AS $$
DECLARE
  v_cell_type text; v_cell_name text; v_project_id uuid;
  v_created_by uuid; v_assigned_to uuid;
  v_actor_name text; v_title text; v_body text; v_url text;
  v_target_user uuid;
BEGIN
  IF NEW.action NOT IN (
    'created', 'status_changed', 'request_executed',
    'request_rejected', 'request_forwarded', 'request_remarks'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT c.cell_type, c.name, c.project_id, c.created_by, c.assigned_to
  INTO v_cell_type, v_cell_name, v_project_id, v_created_by, v_assigned_to
  FROM cells c WHERE c.id = NEW.cell_id;

  IF v_cell_type != 'request' THEN RETURN NEW; END IF;

  SELECT coalesce(u.last_name || ' ' || left(u.first_name, 1) || '.', 'Пользователь')
  INTO v_actor_name FROM users u WHERE u.id = NEW.user_id;

  v_url := '/projects/' || v_project_id || '/requests';

  CASE NEW.action
    WHEN 'created' THEN
      v_title := 'Новая заявка';
      v_body := v_actor_name || ' создал(а) заявку: ' || coalesce(left(v_cell_name, 60), 'Без названия');
      FOR v_target_user IN
        SELECT pm.user_id FROM project_members pm
        WHERE pm.project_id = v_project_id
          AND pm.user_id != NEW.user_id
          AND has_permission(pm.user_id, v_project_id, 'can_execute_requests')
      LOOP
        PERFORM create_notification(v_target_user, v_title, v_body, v_url);
      END LOOP;
      RETURN NEW;

    WHEN 'request_executed' THEN
      v_title := 'Заявка выполнена';
      v_body := v_actor_name || ' выполнил(а): ' || coalesce(left(v_cell_name, 60), 'Без названия');
      v_target_user := v_created_by;

    WHEN 'request_rejected' THEN
      v_title := 'Заявка отклонена';
      v_body := v_actor_name || ' отклонил(а): ' || coalesce(left(v_cell_name, 60), 'Без названия');
      v_target_user := v_created_by;

    WHEN 'request_remarks' THEN
      v_title := 'Замечание по заявке';
      v_body := v_actor_name || ' добавил(а) замечание: ' || coalesce(left(v_cell_name, 60), 'Без названия');
      v_target_user := v_created_by;

    WHEN 'request_forwarded' THEN
      v_title := 'Заявка переадресована';
      v_body := v_actor_name || ' переадресовал(а): ' || coalesce(left(v_cell_name, 60), 'Без названия');
      v_target_user := v_assigned_to;

    WHEN 'status_changed' THEN
      IF NEW.user_id = v_created_by THEN RETURN NEW; END IF;
      v_title := 'Статус заявки изменён';
      v_body := v_actor_name || ': ' || coalesce(left(v_cell_name, 40), 'Заявка') ||
        ' → ' || coalesce((NEW.details->>'to')::text, '');
      v_target_user := v_created_by;

    ELSE
      RETURN NEW;
  END CASE;

  IF v_target_user IS NOT NULL AND v_target_user != NEW.user_id THEN
    PERFORM create_notification(v_target_user, v_title, v_body, v_url);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------
-- Axis points auto-fill project_id
-- -------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_axis_point_set_project_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.project_id IS NULL THEN
    SELECT ovl.project_id INTO NEW.project_id
    FROM dict_overlay_axis_grids oag
    JOIN dict_overlays ovl ON ovl.id = oag.overlay_id
    WHERE oag.id = NEW.overlay_grid_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================
-- 5. TRIGGERS
-- ============================

-- updated_at triggers
CREATE TRIGGER on_cells_updated    BEFORE UPDATE ON cells    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER on_users_updated    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER on_projects_updated BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER user_permissions_updated_at BEFORE UPDATE ON user_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- User protection (prevent non-admin from changing admin flags)
CREATE TRIGGER protect_user_fields_trigger BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION protect_profile_fields();

-- Project member protection
CREATE TRIGGER trg_protect_portal_admin        BEFORE UPDATE ON project_members FOR EACH ROW EXECUTE FUNCTION protect_portal_admin_member();
CREATE TRIGGER trg_protect_portal_admin_delete BEFORE DELETE ON project_members FOR EACH ROW EXECUTE FUNCTION protect_portal_admin_member_delete();
CREATE TRIGGER trg_reset_perms_on_role         AFTER UPDATE  ON project_members FOR EACH ROW EXECUTE FUNCTION reset_perms_on_role_change();

-- Project seeding
CREATE TRIGGER trg_project_created_seed_statuses     AFTER INSERT ON projects          FOR EACH ROW EXECUTE FUNCTION on_project_created_seed_statuses();
CREATE TRIGGER trg_project_created_seed_dictionaries AFTER INSERT ON projects          FOR EACH ROW EXECUTE FUNCTION on_project_created_seed_dictionaries();
CREATE TRIGGER trg_seed_cap_on_status                AFTER INSERT ON project_statuses  FOR EACH ROW EXECUTE FUNCTION trigger_seed_cap_on_status();

-- Notification triggers (без push — push отправляется из Node.js)
CREATE TRIGGER trg_cell_share_notify     AFTER INSERT ON cell_shares           FOR EACH ROW EXECUTE FUNCTION trg_notify_cell_share();
CREATE TRIGGER trg_cell_signature_notify AFTER INSERT ON cell_signatures       FOR EACH ROW EXECUTE FUNCTION trg_notify_cell_signature();
CREATE TRIGGER trg_file_share_notify     AFTER INSERT ON file_share_recipients FOR EACH ROW EXECUTE FUNCTION trg_notify_file_share();
CREATE TRIGGER trg_cell_comment_notify   AFTER INSERT ON cell_comments         FOR EACH ROW EXECUTE FUNCTION trg_notify_cell_comment();
CREATE TRIGGER trg_request_event_notify  AFTER INSERT ON cell_history          FOR EACH ROW EXECUTE FUNCTION trg_notify_request_event();

-- Axis points project_id auto-fill
CREATE TRIGGER trg_axis_point_project BEFORE INSERT ON overlay_axis_points FOR EACH ROW EXECUTE FUNCTION trg_axis_point_set_project_id();


-- ============================
-- КОНЕЦ СХЕМЫ
-- ============================
