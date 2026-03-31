-- 018: Расширение модуля Монтаж
-- manual_tag для работ, документы завершения с метками, файлы к поступлению/процессу

-- Метка для работ (по аналогии с реестром)
ALTER TABLE installation_works
  ADD COLUMN IF NOT EXISTS manual_tag TEXT;

-- Колонка available_qty для прямого учёта поступлений (без заявок)
ALTER TABLE installation_materials
  ADD COLUMN IF NOT EXISTS available_qty NUMERIC(12,3) NOT NULL DEFAULT 0;

-- Файлы привязаны к конкретному действию (поступление/процесс)
-- В installation_files category уже есть: 'during' (по умолчанию)
-- Добавим 'delivery' (поступление), 'usage' (процесс), 'completion' (завершение)
-- + ссылка на конкретный материал
ALTER TABLE installation_files
  ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES installation_materials(id) ON DELETE SET NULL;

-- Документы завершения (отдельное хранилище от файлов работы)
CREATE TABLE IF NOT EXISTS installation_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES installation_works(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  manual_tag TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installation_documents_work ON installation_documents(work_id);
