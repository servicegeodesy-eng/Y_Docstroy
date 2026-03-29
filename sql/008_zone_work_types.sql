-- Связь зон процесса строительства с видами работ
-- Позволяет назначить каждой зоне (roof, frame, earthwork и т.д.) виды работ из справочника
-- Выполнить вручную в Supabase SQL Editor

CREATE TABLE IF NOT EXISTS dict_zone_work_types (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  zone_type    text NOT NULL,
  work_type_id uuid NOT NULL REFERENCES dict_work_types(id) ON DELETE CASCADE,

  UNIQUE (project_id, zone_type, work_type_id),
  CONSTRAINT dict_zone_work_types_zone_check CHECK (zone_type = ANY(ARRAY[
    'plan', 'facades', 'landscaping',
    'roof', 'floors', 'walls', 'frame',
    'territory', 'earthwork', 'foundation', 'shoring', 'piles'
  ]))
);

CREATE INDEX IF NOT EXISTS idx_dict_zone_work_types_project ON dict_zone_work_types (project_id, zone_type);

-- Очистка RLS (если была создана при первом запуске с ошибкой)
ALTER TABLE dict_zone_work_types DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "zone_work_types_select" ON dict_zone_work_types;
DROP POLICY IF EXISTS "zone_work_types_insert" ON dict_zone_work_types;
DROP POLICY IF EXISTS "zone_work_types_delete" ON dict_zone_work_types;
