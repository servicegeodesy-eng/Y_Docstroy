-- ============================================================================
-- 014: cell_id nullable в cell_overlay_masks (для масок работ монтажа)
-- Выполнить вручную в SQL Editor
-- ============================================================================

ALTER TABLE cell_overlay_masks ALTER COLUMN cell_id DROP NOT NULL;
