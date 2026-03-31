-- ============================================================================
-- 016: Материалы работ без привязки к заявкам
-- Позволяет создавать работы с материалами напрямую (без выбора заявок)
-- ============================================================================

-- Делаем order_item_id опциональным
ALTER TABLE installation_materials
  ALTER COLUMN order_item_id DROP NOT NULL;

-- Добавляем прямые ссылки на материал и единицу измерения
ALTER TABLE installation_materials
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES dict_materials(id),
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES dict_units(id),
  ADD COLUMN IF NOT EXISTS material_name text,
  ADD COLUMN IF NOT EXISTS unit_name text;

-- Убираем UNIQUE constraint (work_id, order_item_id) т.к. order_item_id может быть NULL
ALTER TABLE installation_materials DROP CONSTRAINT IF EXISTS installation_materials_work_id_order_item_id_key;

-- Новый уникальный индекс: если order_item_id задан, пара work_id+order_item_id уникальна
CREATE UNIQUE INDEX IF NOT EXISTS idx_installation_materials_work_order
  ON installation_materials (work_id, order_item_id)
  WHERE order_item_id IS NOT NULL;

-- Также делаем order_item_id опциональным в material_dispositions
ALTER TABLE material_dispositions
  ALTER COLUMN order_item_id DROP NOT NULL;

-- Добавляем поле completion_comment к installation_works для комментария при перерасходе
ALTER TABLE installation_works
  ADD COLUMN IF NOT EXISTS completion_comment text;
