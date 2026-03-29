-- Связь зон процесса строительства с видами работ
-- Позволяет назначить каждой зоне (roof, frame, earthwork и т.д.) виды работ из справочника
-- Выполнить вручную в Supabase SQL Editor

CREATE TABLE dict_zone_work_types (
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

CREATE INDEX idx_dict_zone_work_types_project ON dict_zone_work_types (project_id, zone_type);

-- RLS
ALTER TABLE dict_zone_work_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zone_work_types_select" ON dict_zone_work_types
  FOR SELECT USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "zone_work_types_insert" ON dict_zone_work_types
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT pm.project_id FROM project_members pm
      WHERE pm.user_id = auth.uid() AND pm.role IN ('admin', 'portal_admin')
    )
  );

CREATE POLICY "zone_work_types_delete" ON dict_zone_work_types
  FOR DELETE USING (
    project_id IN (
      SELECT pm.project_id FROM project_members pm
      WHERE pm.user_id = auth.uid() AND pm.role IN ('admin', 'portal_admin')
    )
  );
