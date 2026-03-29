-- ============================================================================
-- 013: Маски для работ + процент выполнения
-- Выполнить вручную в SQL Editor
-- ============================================================================

-- Расширяем cell_overlay_masks — добавляем work_id для привязки к монтажу
ALTER TABLE cell_overlay_masks ADD COLUMN IF NOT EXISTS work_id uuid REFERENCES installation_works(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cell_overlay_masks_work ON cell_overlay_masks (work_id) WHERE work_id IS NOT NULL;

-- Процент выполнения работы (вычисляется из использованных материалов)
-- used_qty / required_qty по всем материалам работы
CREATE OR REPLACE FUNCTION get_work_progress(p_work_id uuid)
RETURNS numeric AS $$
DECLARE
  v_total_required numeric;
  v_total_used numeric;
BEGIN
  SELECT coalesce(sum(required_qty), 0), coalesce(sum(used_qty), 0)
  INTO v_total_required, v_total_used
  FROM installation_materials
  WHERE work_id = p_work_id;

  IF v_total_required = 0 THEN RETURN 0; END IF;
  RETURN round((v_total_used / v_total_required) * 100, 1);
END;
$$ LANGUAGE plpgsql;
